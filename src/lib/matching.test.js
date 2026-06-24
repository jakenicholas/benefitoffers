// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTransactions, parseCSV, parseOFX, normalizeDate } from './importTxns.js'
import {
  bestBenefitMatch, suggestForCard, usageFromTransactions, recomputeUsage, summarize
} from './matching.js'

const benefits = [
  { id: 'b_uber', cardId: 'c1', name: 'Uber Cash', amount: 15, cadence: 'monthly', resetBasis: 'calendar', matchKeywords: ['uber'] },
  { id: 'b_uberone', cardId: 'c1', name: 'Uber One', amount: 120, cadence: 'annual', resetBasis: 'calendar', matchKeywords: ['uber one'] },
  { id: 'b_saks', cardId: 'c1', name: 'Saks', amount: 50, cadence: 'semiannual', resetBasis: 'calendar', matchKeywords: ['saks'] }
]
const cards = [{ id: 'c1', anniversaryMonth: null }]

test('normalizeDate handles common formats', () => {
  assert.equal(normalizeDate('06/01/2026'), '2026-06-01')
  assert.equal(normalizeDate('2026-06-01'), '2026-06-01')
  assert.equal(normalizeDate('6/1/26'), '2026-06-01')
})

test('parseCSV (Chase-style: negative = spend)', () => {
  const csv = [
    'Transaction Date,Post Date,Description,Category,Type,Amount',
    '06/01/2026,06/02/2026,UBER EATS,Food,Sale,-15.00',
    '06/03/2026,06/04/2026,PAYMENT THANK YOU,,Payment,200.00'
  ].join('\n')
  const { rows } = parseCSV(csv, { spendSign: -1 })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].kind, 'spend')
  assert.equal(rows[0].amount, 15)
  assert.equal(rows[1].kind, 'credit') // Type=Payment
})

test('parseCSV (Amex-style: positive = spend via issuer)', () => {
  const csv = 'Date,Description,Amount\n06/01/2026,SAKS FIFTH AVE,50.00'
  const { rows } = parseTransactions(csv, { issuer: 'American Express' })
  assert.equal(rows[0].kind, 'spend')
  assert.equal(rows[0].amount, 50)
})

test('parseOFX reads STMTTRN, debit = spend', () => {
  const ofx = `<OFX><STMTTRN><TRNAMT>-15.00<DTPOSTED>20260601120000<NAME>UBER EATS</STMTTRN></OFX>`
  const { rows } = parseOFX(ofx)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'spend')
  assert.equal(rows[0].date, '2026-06-01')
})

test('bestBenefitMatch prefers the longer keyword (uber one > uber)', () => {
  assert.equal(bestBenefitMatch('UBER ONE MEMBERSHIP', benefits).benefitId, 'b_uberone')
  assert.equal(bestBenefitMatch('UBER EATS SF', benefits).benefitId, 'b_uber')
  assert.equal(bestBenefitMatch('STARBUCKS', benefits), null)
})

test('suggestForCard only matches spend rows', () => {
  const rows = [
    { date: '2026-06-01', description: 'UBER EATS', amount: 15, kind: 'spend' },
    { date: '2026-06-02', description: 'UBER refund', amount: 15, kind: 'credit' }
  ]
  const out = suggestForCard(rows, 'c1', benefits, [])
  assert.equal(out[0].benefitId, 'b_uber')
  assert.equal(out[1].benefitId, null)
})

test('usageFromTransactions caps at benefit amount within period', () => {
  const now = new Date(2026, 5, 15) // Jun 2026
  const txns = [
    { benefitId: 'b_uber', kind: 'spend', amount: 9, date: '2026-06-03' },
    { benefitId: 'b_uber', kind: 'spend', amount: 12, date: '2026-06-10' }, // sum 21, cap 15
    { benefitId: 'b_uber', kind: 'spend', amount: 15, date: '2026-05-10' }  // prior month, excluded
  ]
  assert.equal(usageFromTransactions(benefits[0], cards[0], txns, now), 15)
})

test('recomputeUsage only touches benefits with matched txns', () => {
  const now = new Date(2026, 5, 15)
  const state = {
    cards,
    benefits: [
      { ...benefits[0], usedThisPeriod: 0 },
      { ...benefits[2], usedThisPeriod: 30 } // manual, no txns -> untouched
    ],
    transactions: [{ benefitId: 'b_uber', kind: 'spend', amount: 10, date: '2026-06-05' }]
  }
  const out = recomputeUsage(state, now)
  assert.equal(out.benefits[0].usedThisPeriod, 10)
  assert.equal(out.benefits[1].usedThisPeriod, 30)
})

test('summarize counts spend/credits/matches', () => {
  const s = summarize([
    { kind: 'spend', benefitId: 'b_uber' },
    { kind: 'spend', benefitId: null },
    { kind: 'credit', benefitId: null }
  ])
  assert.equal(s.total, 3)
  assert.equal(s.spend, 2)
  assert.equal(s.credits, 1)
  assert.equal(s.matchedBenefit, 1)
})
