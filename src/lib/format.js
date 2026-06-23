// Small display helpers.

export function money(n) {
  const v = Number(n) || 0
  // No cents unless needed.
  return v % 1 === 0 ? `$${v.toLocaleString()}` : `$${v.toFixed(2)}`
}

export function resetText(remainingDays, isDone) {
  if (remainingDays === null) return 'no reset'
  if (isDone) return `resets in ${remainingDays}d`
  if (remainingDays <= 0) return 'resets today'
  if (remainingDays === 1) return 'resets in 1 day'
  return `resets in ${remainingDays} days`
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return iso
  return `${MONTHS[m - 1]?.slice(0, 3)} ${d}, ${y}`
}
