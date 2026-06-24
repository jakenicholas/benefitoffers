// Transaction -> benefit/offer matching, and deriving "% used" from matched
// spend. Keyword matching is scoped per card (the same "uber" keyword exists on
// both Amex cards; the card a charge came from disambiguates it).

import { computePeriodStart, computePeriodEnd, parseISODate } from './periods.js'

function norm(s) {
  return (s || '').toString().toLowerCase()
}

// Best benefit for a description among a card's benefits: the one whose matched
// keyword is longest wins (so "uber one" beats "uber").
export function bestBenefitMatch(description, benefits) {
  const d = norm(description)
  let bestId = null
  let bestKw = null
  let bestLen = 0
  for (const b of benefits) {
    for (const kw of b.matchKeywords || []) {
      const k = norm(kw)
      if (k && d.includes(k) && k.length > bestLen) {
        bestId = b.id
        bestKw = kw
        bestLen = k.length
      }
    }
  }
  return bestId ? { benefitId: bestId, keyword: bestKw } : null
}

// Best offer for a description by merchant substring.
export function bestOfferMatch(description, offers) {
  const d = norm(description)
  let bestId = null
  let bestLen = 0
  for (const o of offers) {
    const m = norm(o.merchant)
    if (m.length > 2 && d.includes(m) && m.length > bestLen) {
      bestId = o.id
      bestLen = m.length
    }
  }
  return bestId ? { offerId: bestId } : null
}

// Attach suggested benefitId/offerId to each parsed row for one card.
// rows: [{date, description, amount, kind}] ; returns the same rows enriched.
export function suggestForCard(rows, cardId, benefits, offers) {
  const cardBenefits = benefits.filter((b) => b.cardId === cardId)
  const cardOffers = offers.filter((o) => o.cardId === cardId || o.cardId == null)
  return rows.map((r) => {
    const out = { ...r, cardId, benefitId: null, offerId: null }
    if (r.kind === 'spend') {
      const bm = bestBenefitMatch(r.description, cardBenefits)
      if (bm) out.benefitId = bm.benefitId
      const om = bestOfferMatch(r.description, cardOffers)
      if (om) out.offerId = om.offerId
    }
    return out
  })
}

// Used amount for a benefit, derived from matched spend within its current
// period (capped at the benefit's value). one_time benefits sum all matched
// spend with no period bound.
export function usageFromTransactions(benefit, card, transactions, now = new Date()) {
  const start = computePeriodStart(benefit.cadence, benefit.resetBasis, card?.anniversaryMonth, now)
  const end = computePeriodEnd(benefit.cadence, benefit.resetBasis, card?.anniversaryMonth, now)
  let sum = 0
  for (const t of transactions) {
    if (t.benefitId !== benefit.id || t.kind !== 'spend' || t.ignored) continue
    const dt = parseISODate(t.date)
    if (start && dt && dt < start) continue
    if (end && dt && dt >= end) continue
    sum += Number(t.amount) || 0
  }
  return Math.min(Number(benefit.amount) || 0, sum)
}

// Recompute usedThisPeriod from transactions, but ONLY for benefits that have at
// least one matched transaction — benefits tracked purely by hand keep their
// manual value.
export function recomputeUsage(state, now = new Date()) {
  const cardById = Object.fromEntries(state.cards.map((c) => [c.id, c]))
  const matched = new Set(
    (state.transactions || []).filter((t) => t.benefitId && !t.ignored).map((t) => t.benefitId)
  )
  return {
    ...state,
    benefits: state.benefits.map((b) => {
      if (!matched.has(b.id)) return b
      return { ...b, usedThisPeriod: usageFromTransactions(b, cardById[b.cardId], state.transactions, now) }
    })
  }
}

// Quick summary for the import review screen.
export function summarize(rows) {
  const spend = rows.filter((r) => r.kind === 'spend')
  const matchedBenefit = rows.filter((r) => r.benefitId).length
  const matchedOffer = rows.filter((r) => r.offerId).length
  return {
    total: rows.length,
    spend: spend.length,
    credits: rows.length - spend.length,
    matchedBenefit,
    matchedOffer
  }
}
