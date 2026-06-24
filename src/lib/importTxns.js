// Parse exported transaction files into a normalized list the matching engine
// can consume. Supports CSV (Amex / Chase / Apple Card exports) and OFX/QFX.
//
// Normalized row shape:
//   { date: 'YYYY-MM-DD', description: string, amount: number (>=0), kind: 'spend' | 'credit' }
//
// `kind` is what matters downstream: 'spend' = a purchase (counts toward a
// benefit/offer), 'credit' = money back (statement credit, refund, payment).
// Sign conventions differ by issuer, so callers pass `spendSign` (the sign a
// purchase has in this file) which we derive from the selected card's issuer;
// the UI also offers a manual flip.

// ---- CSV ----------------------------------------------------------------

// Minimal RFC-4180-ish line splitter: handles quoted fields and escaped quotes.
function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function findCol(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase())
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h === cand)
    if (idx !== -1) return idx
  }
  // fall back to "contains"
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand))
    if (idx !== -1) return idx
  }
  return -1
}

// Parse a date cell in common formats -> 'YYYY-MM-DD' (or null).
export function normalizeDate(s) {
  if (!s) return null
  s = s.trim()
  let m
  // ISO
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`
  // MM/DD/YYYY or M/D/YY
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    let [, mo, d, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const dt = new Date(t)
    const y = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  return null
}

function parseAmount(s) {
  if (s == null) return NaN
  // strip currency symbols, spaces, thousands separators; keep sign + dot
  const cleaned = String(s).replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-') return NaN
  return Number(cleaned)
}

// Classify by an explicit Type column if the file has one.
function kindFromType(typeStr) {
  if (!typeStr) return null
  const t = typeStr.toLowerCase()
  if (/(payment|return|refund|credit|adjustment|reversal)/.test(t)) return 'credit'
  if (/(sale|purchase|debit)/.test(t)) return 'spend'
  return null
}

export function parseCSV(text, { spendSign = -1 } = {}) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { rows: [], warnings: ['File has no data rows.'] }

  const headers = splitCsvLine(lines[0])
  const dateIdx = findCol(headers, ['transaction date', 'trans date', 'date', 'posted date', 'post date'])
  const descIdx = findCol(headers, ['description', 'merchant', 'name', 'payee', 'details'])
  const amtIdx = findCol(headers, ['amount (usd)', 'amount', 'debit', 'value'])
  const typeIdx = findCol(headers, ['type', 'transaction type'])

  const warnings = []
  if (dateIdx === -1) warnings.push('No date column found.')
  if (descIdx === -1) warnings.push('No description column found.')
  if (amtIdx === -1) warnings.push('No amount column found.')
  if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) return { rows: [], warnings }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const date = normalizeDate(cells[dateIdx])
    const description = (cells[descIdx] || '').replace(/\s+/g, ' ').trim()
    const rawAmt = parseAmount(cells[amtIdx])
    if (!date || !description || Number.isNaN(rawAmt)) continue

    let kind = typeIdx !== -1 ? kindFromType(cells[typeIdx]) : null
    if (!kind) kind = Math.sign(rawAmt) === spendSign ? 'spend' : 'credit'
    rows.push({ date, description, amount: Math.abs(rawAmt), kind })
  }
  if (rows.length === 0) warnings.push('No rows could be parsed — check the column format.')
  return { rows, warnings }
}

// ---- OFX / QFX ----------------------------------------------------------

function ofxTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'))
  return m ? m[1].trim() : ''
}

export function parseOFX(text) {
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  const rows = []
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0]
    const amt = parseAmount(ofxTag(block, 'TRNAMT'))
    const dposted = ofxTag(block, 'DTPOSTED')
    const name = ofxTag(block, 'NAME') || ofxTag(block, 'MEMO')
    if (Number.isNaN(amt) || !dposted) continue
    // OFX dates: YYYYMMDD...
    const dm = dposted.match(/^(\d{4})(\d{2})(\d{2})/)
    const date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : normalizeDate(dposted)
    if (!date) continue
    // OFX is standardized: debits (spend) are negative.
    const kind = amt < 0 ? 'spend' : 'credit'
    rows.push({ date, description: (name || '').replace(/\s+/g, ' ').trim() || 'Transaction', amount: Math.abs(amt), kind })
  }
  return { rows, warnings: rows.length ? [] : ['No <STMTTRN> entries found.'] }
}

// ---- Dispatcher ---------------------------------------------------------

// issuer is used only to guess CSV sign convention (Amex: purchases positive).
export function parseTransactions(text, { issuer = '' } = {}) {
  const trimmed = (text || '').trim()
  if (!trimmed) return { rows: [], warnings: ['Nothing to parse.'], format: null }
  if (/<OFX>|<STMTTRN>/i.test(trimmed)) {
    return { ...parseOFX(trimmed), format: 'ofx' }
  }
  const spendSign = /american express|amex/i.test(issuer) ? 1 : -1
  return { ...parseCSV(trimmed, { spendSign }), format: 'csv' }
}
