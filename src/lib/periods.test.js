// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePeriodEnd, periodsPerYear, toISODate, daysBetween, startOfToday } from './periods.js'

const at = (y, m, d) => new Date(y, m - 1, d)

test('periodsPerYear mapping', () => {
  assert.equal(periodsPerYear('annual'), 1)
  assert.equal(periodsPerYear('semiannual'), 2)
  assert.equal(periodsPerYear('quarterly'), 4)
  assert.equal(periodsPerYear('monthly'), 12)
  assert.equal(periodsPerYear('one_time'), null)
})

test('annual calendar resets next Jan 1', () => {
  const end = computePeriodEnd('annual', 'calendar', 1, at(2026, 6, 23))
  assert.equal(toISODate(end), '2027-01-01')
})

test('semiannual calendar: before Jul resets Jul 1', () => {
  const end = computePeriodEnd('semiannual', 'calendar', 1, at(2026, 3, 15))
  assert.equal(toISODate(end), '2026-07-01')
})

test('semiannual calendar: after Jul resets next Jan 1', () => {
  const end = computePeriodEnd('semiannual', 'calendar', 1, at(2026, 9, 1))
  assert.equal(toISODate(end), '2027-01-01')
})

test('quarterly calendar boundaries Jan/Apr/Jul/Oct', () => {
  assert.equal(toISODate(computePeriodEnd('quarterly', 'calendar', 1, at(2026, 2, 1))), '2026-04-01')
  assert.equal(toISODate(computePeriodEnd('quarterly', 'calendar', 1, at(2026, 5, 1))), '2026-07-01')
  assert.equal(toISODate(computePeriodEnd('quarterly', 'calendar', 1, at(2026, 8, 1))), '2026-10-01')
  assert.equal(toISODate(computePeriodEnd('quarterly', 'calendar', 1, at(2026, 11, 1))), '2027-01-01')
})

test('monthly calendar resets first of next month', () => {
  assert.equal(toISODate(computePeriodEnd('monthly', 'calendar', 1, at(2026, 6, 23))), '2026-07-01')
  assert.equal(toISODate(computePeriodEnd('monthly', 'calendar', 1, at(2026, 12, 10))), '2027-01-01')
})

test('boundary day rolls to the NEXT boundary (strictly after today)', () => {
  // On Jul 1 itself, the *current* period already started; next reset is Jan 1.
  assert.equal(toISODate(computePeriodEnd('semiannual', 'calendar', 1, at(2026, 7, 1))), '2027-01-01')
})

test('cardmember_year annual uses anniversary month', () => {
  // Anniversary in March; on Jun 23 the next reset is next March 1.
  assert.equal(toISODate(computePeriodEnd('annual', 'cardmember_year', 3, at(2026, 6, 23))), '2027-03-01')
  // Before the anniversary month this year -> this year's March.
  assert.equal(toISODate(computePeriodEnd('annual', 'cardmember_year', 3, at(2026, 1, 10))), '2026-03-01')
})

test('cardmember_year quarterly steps every 3 months from anniversary', () => {
  // Anniversary Feb (month 2): boundaries Feb/May/Aug/Nov.
  assert.equal(toISODate(computePeriodEnd('quarterly', 'cardmember_year', 2, at(2026, 6, 23))), '2026-08-01')
})

test('one_time has no reset', () => {
  assert.equal(computePeriodEnd('one_time', 'calendar', 1, at(2026, 6, 23)), null)
})

test('daysBetween + startOfToday are whole local days', () => {
  const a = startOfToday(at(2026, 6, 23))
  const b = at(2026, 7, 1)
  assert.equal(daysBetween(a, b), 8)
})
