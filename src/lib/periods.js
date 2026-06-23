// Period math for benefit reset cadences.
//
// A benefit "resets" on a recurring boundary determined by its cadence and
// resetBasis. We compute `currentPeriodEnd` = the next reset date (the first
// instant of the next period). "Remaining days" = that date minus today.
//
// All dates are handled as local calendar dates (no time component) so that a
// reset on "Jul 1" means Jul 1 in the user's local timezone.

export const CADENCES = ['annual', 'semiannual', 'quarterly', 'monthly', 'one_time']

export const CADENCE_LABELS = {
  annual: 'Annual',
  semiannual: 'Semiannual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  one_time: 'One-time'
}

export const RESET_BASES = ['calendar', 'cardmember_year']

export const RESET_BASIS_LABELS = {
  calendar: 'Calendar',
  cardmember_year: 'Cardmember year'
}

export function periodsPerYear(cadence) {
  switch (cadence) {
    case 'annual':
      return 1
    case 'semiannual':
      return 2
    case 'quarterly':
      return 4
    case 'monthly':
      return 12
    case 'one_time':
    default:
      return null
  }
}

// Number of months between reset boundaries for a recurring cadence.
function monthsPerPeriod(cadence) {
  switch (cadence) {
    case 'annual':
      return 12
    case 'semiannual':
      return 6
    case 'quarterly':
      return 3
    case 'monthly':
      return 1
    default:
      return null
  }
}

// Build a local date at midnight from y/m/d (month is 0-based).
function ymd(year, month, day) {
  return new Date(year, month, day, 0, 0, 0, 0)
}

// Strip time -> local midnight today.
export function startOfToday(now = new Date()) {
  return ymd(now.getFullYear(), now.getMonth(), now.getDate())
}

export function toISODate(date) {
  // YYYY-MM-DD in local time.
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return ymd(y, m - 1, d)
}

export function daysBetween(from, to) {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / 86400000)
}

// Compute the next reset boundary (start of the next period) for a benefit.
//
// cadence: one of CADENCES
// resetBasis: 'calendar' | 'cardmember_year'
// anniversaryMonth: 1-12 (only used for cardmember_year; defaults to January)
// now: reference Date (defaults to real now)
//
// Returns a Date at local midnight, or null for one_time benefits (no reset).
export function computePeriodEnd(cadence, resetBasis, anniversaryMonth = 1, now = new Date()) {
  if (cadence === 'one_time') return null

  const months = monthsPerPeriod(cadence)
  const today = startOfToday(now)
  const year = today.getFullYear()

  // Anchor month index (0-based) for the cadence cycle.
  // calendar basis anchors on January; cardmember_year on the anniversary month.
  const anchorMonth = resetBasis === 'cardmember_year'
    ? ((Number(anniversaryMonth) || 1) - 1)
    : 0

  // Walk boundaries forward from a point safely in the past until we find the
  // first boundary strictly after today. Boundaries fall on the 1st of a month
  // at (anchorMonth + k * months).
  let boundary = ymd(year - 1, anchorMonth, 1)
  // Guard against infinite loops (max ~24 months of monthly steps + buffer).
  let guard = 0
  while (boundary <= today && guard < 64) {
    boundary = ymd(boundary.getFullYear(), boundary.getMonth() + months, 1)
    guard += 1
  }
  return boundary
}

// Convenience: derive everything we need to display for a benefit given the
// owning card (for anniversaryMonth) and a reference time.
export function benefitPeriodInfo(benefit, card, now = new Date()) {
  const end = computePeriodEnd(
    benefit.cadence,
    benefit.resetBasis,
    card?.anniversaryMonth,
    now
  )
  const today = startOfToday(now)
  const remainingDays = end ? daysBetween(today, end) : null
  const remainingAmount = Math.max(0, (Number(benefit.amount) || 0) - (Number(benefit.usedThisPeriod) || 0))
  return {
    currentPeriodEnd: end ? toISODate(end) : null,
    remainingDays,
    remainingAmount
  }
}
