import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSimplefin, simplefinDate } from './simplefin.js'

const sample = {
  errors: [],
  accounts: [
    {
      org: { name: 'American Express' },
      id: 'ACT-amex-plat',
      name: 'Platinum Card',
      balance: '-2410.55',
      transactions: [
        { id: 'T1', posted: 1748822400, amount: '-15.00', description: 'UBER EATS' }, // spend
        { id: 'T2', posted: 1748908800, amount: '50.00', description: 'STATEMENT CREDIT' }, // credit
        { id: 'T3', posted: 1748995200, amount: '-9.99', description: 'UBER ONE', pending: true } // pending -> skip
      ]
    }
  ]
}

test('simplefinDate converts epoch seconds to local YYYY-MM-DD', () => {
  // 1748822400 = 2025-06-02 (UTC midnight); just assert format + parseability
  assert.match(simplefinDate(1748822400), /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(simplefinDate(null), null)
})

test('normalizeSimplefin maps accounts + transactions, signs, skips pending', () => {
  const { accounts, transactions } = normalizeSimplefin(sample)
  assert.equal(accounts.length, 1)
  assert.equal(accounts[0].org, 'American Express')
  assert.equal(transactions.length, 2) // pending dropped
  const uber = transactions.find((t) => t.externalId === 'T1')
  assert.equal(uber.kind, 'spend')
  assert.equal(uber.amount, 15)
  assert.equal(uber.accountId, 'ACT-amex-plat')
  const credit = transactions.find((t) => t.externalId === 'T2')
  assert.equal(credit.kind, 'credit')
  assert.equal(credit.amount, 50)
})

test('normalizeSimplefin tolerates empty/garbage input', () => {
  assert.deepEqual(normalizeSimplefin(null).transactions, [])
  assert.deepEqual(normalizeSimplefin({}).accounts, [])
})
