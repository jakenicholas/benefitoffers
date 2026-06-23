// Derived views over app state: enrich benefits with period info, sort by
// urgency, group by card, compute ROI, and run search.

import { benefitPeriodInfo } from './periods.js'

export const URGENT_DAYS = 14

// Attach computed period info to each benefit and the owning card.
export function enrichBenefits(state, now = new Date()) {
  const cardById = Object.fromEntries(state.cards.map((c) => [c.id, c]))
  return state.benefits.map((b) => {
    const card = cardById[b.cardId] || null
    const info = benefitPeriodInfo(b, card, now)
    const isUrgent =
      info.remainingAmount > 0 &&
      info.remainingDays !== null &&
      info.remainingDays <= URGENT_DAYS
    const isDone = info.remainingAmount <= 0
    return { ...b, card, ...info, isUrgent, isDone }
  })
}

// Urgency sort: still-unused value with the soonest reset floats to the top;
// fully-used benefits sink to the bottom.
export function sortByUrgency(enriched) {
  return [...enriched].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
    // Benefits with no reset (one_time) go after dated ones among unused.
    const ad = a.remainingDays === null ? Infinity : a.remainingDays
    const bd = b.remainingDays === null ? Infinity : b.remainingDays
    if (ad !== bd) return ad - bd
    return b.remainingAmount - a.remainingAmount
  })
}

// Group enriched benefits by card, preserving card order from state.
export function groupByCard(state, enriched) {
  const byCard = new Map()
  for (const card of state.cards) byCard.set(card.id, { card, benefits: [] })
  const orphan = { card: null, benefits: [] }
  for (const b of enriched) {
    const bucket = byCard.get(b.cardId)
    if (bucket) bucket.benefits.push(b)
    else orphan.benefits.push(b)
  }
  const groups = [...byCard.values()]
  if (orphan.benefits.length) groups.push(orphan)
  // Sort each card's benefits by urgency too.
  for (const g of groups) g.benefits = sortByUrgency(g.benefits)
  return groups
}

// "credits captured this year" = sum of usedThisPeriod across a card's benefits,
// scaled by how many periods occur per year (a $15 monthly credit used once is
// $15 captured; we count cumulative used in the current period only as a simple
// proxy, since we don't store history). Returns { fee, captured }.
export function cardROI(card, enriched) {
  const benefits = enriched.filter((b) => b.cardId === card.id)
  // Captured = value already used in the current period for each benefit.
  // It's an approximation (no per-period history kept) but gives a live signal.
  const captured = benefits.reduce((sum, b) => sum + (Number(b.usedThisPeriod) || 0), 0)
  return { fee: card.annualFee, captured }
}

// Total remaining unused value across all (non-done) benefits.
export function totalRemaining(enriched) {
  return enriched.reduce((sum, b) => sum + (b.remainingAmount || 0), 0)
}

export function countUrgent(enriched) {
  return enriched.filter((b) => b.isUrgent).length
}

// ---- Search --------------------------------------------------------------

function norm(s) {
  return (s || '').toString().toLowerCase()
}

export function searchBenefits(enriched, query) {
  const q = norm(query).trim()
  if (!q) return enriched
  return enriched.filter((b) =>
    norm(b.name).includes(q) ||
    norm(b.description).includes(q) ||
    norm(b.notes).includes(q) ||
    norm(b.card?.name).includes(q) ||
    norm(b.card?.issuer).includes(q)
  )
}

export function searchOffers(state, query) {
  const cardById = Object.fromEntries(state.cards.map((c) => [c.id, c]))
  const offers = state.offers.map((o) => ({ ...o, card: cardById[o.cardId] || null }))
  const q = norm(query).trim()
  if (!q) return offers
  return offers.filter((o) =>
    norm(o.merchant).includes(q) ||
    norm(o.notes).includes(q) ||
    norm(o.card?.name).includes(q)
  )
}
