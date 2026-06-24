// Normalize SimpleFIN `/accounts` JSON into the transaction shape the matching
// engine already understands. SimpleFIN is the only piece of Phase 2 with real
// parsing; the Cloudflare Worker is a dumb cache, so all the testable logic
// lives here on the client and is covered by the repo test suite.
//
// SimpleFIN amounts are strings; negative = money out (a purchase/spend),
// positive = money in (statement credit, refund, payment). `posted` is unix
// epoch seconds.

export function simplefinDate(epochSeconds) {
  if (!epochSeconds && epochSeconds !== 0) return null
  const dt = new Date(Number(epochSeconds) * 1000)
  if (Number.isNaN(dt.getTime())) return null
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// -> { accounts: [{ id, name, org, balance }], transactions: [normalized] }
export function normalizeSimplefin(json) {
  const accounts = []
  const transactions = []
  const list = Array.isArray(json?.accounts) ? json.accounts : []
  for (const acct of list) {
    const accountId = acct.id
    accounts.push({
      id: accountId,
      name: acct.name || 'Account',
      org: acct.org?.name || acct.org?.domain || '',
      balance: acct.balance
    })
    for (const t of acct.transactions || []) {
      if (t.pending) continue
      const amt = Number(t.amount)
      if (Number.isNaN(amt)) continue
      const date = simplefinDate(t.posted)
      if (!date) continue
      transactions.push({
        externalId: String(t.id || `${accountId}:${t.posted}:${t.amount}`),
        accountId,
        date,
        description: (t.description || t.payee || 'Transaction').replace(/\s+/g, ' ').trim(),
        amount: Math.abs(amt),
        kind: amt < 0 ? 'spend' : 'credit'
      })
    }
  }
  return { accounts, transactions, errors: json?.errors || [] }
}
