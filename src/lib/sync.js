// Client for the benefitoffers sync worker (Phase 2). Talks to your Cloudflare
// Worker, which proxies SimpleFIN. Config (worker URL, bearer token, and the
// SimpleFIN-account -> card mapping) lives in localStorage, separate from the
// main data blob so it survives data import/restore.

import { normalizeSimplefin } from './simplefin.js'
import { suggestForCard } from './matching.js'

const SYNC_KEY = 'cardPerks.sync.v1'

export function loadSyncConfig() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}
  } catch {
    return {}
  }
}
export function saveSyncConfig(cfg) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(cfg))
}
export function isConfigured(cfg) {
  return Boolean(cfg?.workerUrl && cfg?.token)
}

async function api(cfg, path, opts = {}) {
  if (!isConfigured(cfg)) throw new Error('Sync not configured.')
  const res = await fetch(cfg.workerUrl.replace(/\/$/, '') + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {})
    }
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const connectBank = (cfg, setupToken) =>
  api(cfg, '/api/connect', { method: 'POST', body: JSON.stringify({ setupToken }) })
export const getStatus = (cfg) => api(cfg, '/api/status')
export const syncNow = (cfg) => api(cfg, '/api/sync', { method: 'POST' })
export const getSnapshot = (cfg) => api(cfg, '/api/snapshot')

// Turn a raw SimpleFIN payload into new, deduped, card-assigned + suggested
// transactions ready to merge into app state.
export function buildSyncedTransactions(raw, accountMap, state) {
  const { transactions } = normalizeSimplefin(raw)
  const seen = new Set((state.transactions || []).map((t) => t.externalId).filter(Boolean))
  const byCard = {}
  for (const t of transactions) {
    const cardId = accountMap?.[t.accountId]
    if (!cardId) continue // account not mapped to a card -> skip
    if (t.externalId && seen.has(t.externalId)) continue // already imported
    ;(byCard[cardId] ||= []).push(t)
  }
  const out = []
  for (const [cardId, rows] of Object.entries(byCard)) {
    for (const r of suggestForCard(rows, cardId, state.benefits, state.offers)) {
      out.push({ ...r, source: 'simplefin' })
    }
  }
  return out
}

// Best-guess mapping of a SimpleFIN account to one of the user's cards, by
// fuzzy name/issuer overlap. Returns a cardId or ''.
export function guessCardForAccount(account, cards) {
  const hay = `${account.org || ''} ${account.name || ''}`.toLowerCase()
  let best = ''
  let bestScore = 0
  for (const c of cards) {
    const tokens = `${c.name} ${c.issuer}`.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    let score = 0
    for (const w of tokens) if (hay.includes(w)) score += w.length
    if (score > bestScore) { bestScore = score; best = c.id }
  }
  return bestScore > 0 ? best : ''
}
