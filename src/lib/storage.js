// localStorage persistence + the data model normalization / period-rollover logic.
//
// Single user, single device. The whole app state is one JSON blob under one key.

import { computePeriodEnd, toISODate, parseISODate, periodsPerYear } from './periods.js'

const STORAGE_KEY = 'cardPerks.v1'
export const SCHEMA_VERSION = 1

// ---- ID generation -------------------------------------------------------

export function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36)
  return `${prefix}_${time}${rand}`
}

// ---- Empty / default state ----------------------------------------------

export function emptyState() {
  return { version: SCHEMA_VERSION, cards: [], benefits: [], offers: [] }
}

// ---- Load / save ---------------------------------------------------------

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return normalizeState(parsed)
  } catch (err) {
    console.error('Failed to load state, starting empty', err)
    return emptyState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Failed to save state', err)
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY)
}

// ---- Normalization + period rollover ------------------------------------

// Ensure the loaded blob has the expected shape and that every benefit's
// usedThisPeriod / currentPeriodEnd are up to date. If a stored period has
// ended, reset usage to 0 and roll the period forward. Returns a new state.
export function normalizeState(input, now = new Date()) {
  const state = {
    version: SCHEMA_VERSION,
    cards: Array.isArray(input?.cards) ? input.cards.map(normalizeCard) : [],
    benefits: Array.isArray(input?.benefits) ? input.benefits : [],
    offers: Array.isArray(input?.offers) ? input.offers : []
  }

  const cardById = Object.fromEntries(state.cards.map((c) => [c.id, c]))

  state.benefits = state.benefits.map((b) => {
    const benefit = normalizeBenefit(b)
    const card = cardById[benefit.cardId]
    return rolloverBenefit(benefit, card, now)
  })

  state.offers = state.offers.map(normalizeOffer)

  return state
}

function normalizeCard(c) {
  return {
    id: c.id || uid('card'),
    name: c.name || 'Untitled card',
    issuer: c.issuer || '',
    annualFee: c.annualFee === null || c.annualFee === undefined || c.annualFee === ''
      ? null
      : Number(c.annualFee),
    last4: c.last4 || '',
    // Anniversary month (1-12) is required for cardmember_year benefits.
    anniversaryMonth: c.anniversaryMonth ? Number(c.anniversaryMonth) : null
  }
}

function normalizeBenefit(b) {
  return {
    id: b.id || uid('ben'),
    cardId: b.cardId || null,
    name: b.name || 'Untitled benefit',
    description: b.description || '',
    amount: Number(b.amount) || 0,
    cadence: b.cadence || 'annual',
    resetBasis: b.resetBasis || 'calendar',
    usedThisPeriod: Number(b.usedThisPeriod) || 0,
    currentPeriodEnd: b.currentPeriodEnd || null,
    notes: b.notes || '',
    verify: Boolean(b.verify)
  }
}

function normalizeOffer(o) {
  return {
    id: o.id || uid('offer'),
    cardId: o.cardId || null,
    merchant: o.merchant || 'Untitled offer',
    value: o.value === '' || o.value === null || o.value === undefined ? null : Number(o.value),
    expires: o.expires || null,
    activated: Boolean(o.activated),
    notes: o.notes || ''
  }
}

// Roll a single benefit's period forward if it has lapsed since last open.
export function rolloverBenefit(benefit, card, now = new Date()) {
  const periods = periodsPerYear(benefit.cadence)
  benefit = { ...benefit, periodsPerYear: periods }

  // one_time benefits never reset.
  if (benefit.cadence === 'one_time') {
    if (!benefit.currentPeriodEnd) benefit.currentPeriodEnd = null
    return benefit
  }

  const computedEnd = computePeriodEnd(
    benefit.cadence,
    benefit.resetBasis,
    card?.anniversaryMonth,
    now
  )
  const computedISO = computedEnd ? toISODate(computedEnd) : null

  // First time we've seen this benefit, or stored end is missing.
  if (!benefit.currentPeriodEnd) {
    return { ...benefit, currentPeriodEnd: computedISO }
  }

  const storedEnd = parseISODate(benefit.currentPeriodEnd)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // If the stored period boundary has arrived/passed, the period rolled over:
  // reset usage and adopt the freshly computed boundary.
  if (storedEnd && storedEnd <= today) {
    return { ...benefit, usedThisPeriod: 0, currentPeriodEnd: computedISO }
  }

  // Period still active — keep stored usage, but keep the boundary in sync
  // in case cadence/basis was edited.
  return { ...benefit, currentPeriodEnd: computedISO }
}

// ---- Export / import -----------------------------------------------------

export function exportJSON(state) {
  return JSON.stringify(
    { version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...stripDerived(state) },
    null,
    2
  )
}

// Remove derived fields so exports stay clean.
function stripDerived(state) {
  return {
    cards: state.cards,
    benefits: state.benefits.map(({ periodsPerYear: _pp, ...rest }) => rest),
    offers: state.offers
  }
}

// Parse + validate an imported JSON string. Throws on invalid input.
export function importJSON(text) {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Not a valid backup file.')
  }
  if (!Array.isArray(parsed.cards) && !Array.isArray(parsed.benefits) && !Array.isArray(parsed.offers)) {
    throw new Error('File does not look like a Card Perks backup (no cards/benefits/offers).')
  }
  return normalizeState(parsed)
}
