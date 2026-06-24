import { useMemo, useState } from 'react'
import { parseTransactions } from '../lib/importTxns.js'
import { suggestForCard, summarize } from '../lib/matching.js'
import { money } from '../lib/format.js'

// Import a transaction export (CSV / OFX) for one card, preview the matches,
// and commit. Used-% is then derived from matched spend.
export default function ImportSheet({ cards, benefits, offers, onImport, onClose }) {
  const [cardId, setCardId] = useState(cards[0]?.id || '')
  const [text, setText] = useState('')
  const [flip, setFlip] = useState(false)
  const [parsed, setParsed] = useState(null) // { rows, warnings, format }
  const [error, setError] = useState('')

  const card = cards.find((c) => c.id === cardId)

  const suggested = useMemo(() => {
    if (!parsed) return []
    let rows = parsed.rows
    if (flip) rows = rows.map((r) => ({ ...r, kind: r.kind === 'spend' ? 'credit' : 'spend' }))
    return suggestForCard(rows, cardId, benefits, offers)
  }, [parsed, flip, cardId, benefits, offers])

  const summary = useMemo(() => (suggested.length ? summarize(suggested) : null), [suggested])

  function doParse(raw) {
    setError('')
    const res = parseTransactions(raw, { issuer: card?.issuer })
    if (!res.rows.length) {
      setError(res.warnings.join(' ') || 'Could not parse any transactions.')
      setParsed(null)
      return
    }
    setParsed(res)
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result || '')
      setText(raw)
      doParse(raw)
    }
    reader.readAsText(file)
  }

  function commit() {
    const usable = suggested.filter((r) => !r.ignored)
    onImport(cardId, usable)
    onClose()
  }

  const benefitName = (id) => benefits.find((b) => b.id === id)?.name
  const offerName = (id) => offers.find((o) => o.id === id)?.merchant

  return (
    <div className="import-sheet">
      <p className="hint" style={{ marginTop: 0 }}>
        Export transactions from your card (Amex/Chase: Activity → Download; Apple Card: Wallet → a
        statement → Export Transactions) and drop the CSV/OFX here. Used-% is derived from matched
        spend — approximate, and you can correct any benefit by hand afterward.
      </p>

      <div className="field">
        <label>Card</label>
        <select value={cardId} onChange={(e) => { setCardId(e.target.value); setParsed(null) }}>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Upload file</label>
        <input type="file" accept=".csv,.ofx,.qfx,.txt" onChange={onFile} />
      </div>

      <div className="field">
        <label>…or paste CSV / OFX text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Date,Description,Amount&#10;06/01/2026,UBER EATS,15.00"
          style={{ minHeight: 90 }}
        />
        <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => doParse(text)} disabled={!text.trim()}>
          Parse
        </button>
      </div>

      {error && <div className="hint" style={{ color: 'var(--red)' }}>{error}</div>}

      {summary && (
        <>
          <div className="import-summary">
            <div><b>{summary.total}</b> transactions · <b>{summary.spend}</b> spend · {summary.credits} credits</div>
            <div className="green">{summary.matchedBenefit} matched to benefits{summary.matchedOffer ? ` · ${summary.matchedOffer} to offers` : ''}</div>
          </div>

          <label className="checkbox-row" style={{ margin: '8px 0' }}>
            <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Spend/credit look reversed — flip them</span>
          </label>

          <div className="import-rows">
            {suggested.slice(0, 40).map((r, i) => (
              <div key={i} className={`import-row ${r.benefitId ? 'hit' : ''}`}>
                <div className="ir-main">
                  <div className="ir-desc">{r.description}</div>
                  <div className="ir-sub">
                    {r.date} · {r.kind === 'spend' ? '' : 'credit '}
                    {r.benefitId ? `→ ${benefitName(r.benefitId)}` : r.offerId ? `→ offer: ${offerName(r.offerId)}` : 'no match'}
                  </div>
                </div>
                <div className={`ir-amt ${r.kind === 'credit' ? 'credit' : ''}`}>
                  {r.kind === 'credit' ? '+' : ''}{money(r.amount)}
                </div>
              </div>
            ))}
            {suggested.length > 40 && <div className="hint">…and {suggested.length - 40} more.</div>}
          </div>

          <button className="btn" style={{ marginTop: 12 }} onClick={commit}>
            Import {suggested.length} transactions
          </button>
        </>
      )}
    </div>
  )
}
