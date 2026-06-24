// benefitoffers sync worker — a thin, single-user proxy in front of SimpleFIN.
//
// It holds the SimpleFIN access URL (a secret that can read your transactions),
// pulls transactions on a daily cron, caches the raw JSON in D1, and serves it
// to your app behind a bearer token. No business logic lives here — the app
// normalizes + matches client-side (see src/lib/simplefin.js + matching.js).

const DAYS = 86400
const LOOKBACK_DAYS = 120

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400'
  }
}

function json(body, env, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) }
  })
}

function authed(request, env) {
  const h = request.headers.get('Authorization') || ''
  const token = h.replace(/^Bearer\s+/i, '')
  return env.API_TOKEN && token === env.API_TOKEN
}

// ---- D1 helpers ----------------------------------------------------------

async function kvGet(env, key) {
  const row = await env.DB.prepare('SELECT value FROM kv WHERE key = ?').bind(key).first()
  return row ? row.value : null
}
async function kvSet(env, key, value) {
  await env.DB.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value).run()
}
async function saveSnapshot(env, jsonText) {
  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare('INSERT INTO snapshot (id, json, fetched_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at')
    .bind(jsonText, now).run()
  return now
}
async function getSnapshot(env) {
  return env.DB.prepare('SELECT json, fetched_at FROM snapshot WHERE id = 1').first()
}

// ---- SimpleFIN ----------------------------------------------------------

// Claim a setup token (base64 of a one-time claim URL) -> persistent access URL.
async function claimSetupToken(setupToken) {
  const claimUrl = atob(setupToken.trim())
  const res = await fetch(claimUrl, { method: 'POST' })
  if (!res.ok) throw new Error(`Claim failed (${res.status})`)
  return (await res.text()).trim()
}

// Split basic-auth credentials out of the access URL and GET a path.
async function accessFetch(accessUrl, path) {
  const u = new URL(accessUrl)
  const auth = 'Basic ' + btoa(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`)
  u.username = ''
  u.password = ''
  const base = u.toString().replace(/\/$/, '')
  const res = await fetch(base + path, { headers: { Authorization: auth } })
  if (!res.ok) throw new Error(`SimpleFIN ${path} -> ${res.status}`)
  return res
}

async function pullAccounts(env, { balancesOnly = false } = {}) {
  const accessUrl = await kvGet(env, 'access_url')
  if (!accessUrl) throw new Error('not_connected')
  const start = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * DAYS
  const qs = balancesOnly ? '?balances-only=1' : `?start-date=${start}`
  const res = await accessFetch(accessUrl, '/accounts' + qs)
  return res.text()
}

// ---- Routing -------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) })

    if (!authed(request, env)) return json({ error: 'unauthorized' }, env, 401)

    try {
      // POST /api/connect { setupToken }
      if (url.pathname === '/api/connect' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}))
        if (!body.setupToken) return json({ error: 'missing setupToken' }, env, 400)
        const accessUrl = await claimSetupToken(body.setupToken)
        await kvSet(env, 'access_url', accessUrl)
        const accountsJson = await pullAccounts(env, { balancesOnly: true })
        return json({ ok: true, accounts: JSON.parse(accountsJson).accounts || [] }, env)
      }

      // GET /api/status
      if (url.pathname === '/api/status' && request.method === 'GET') {
        const connected = Boolean(await kvGet(env, 'access_url'))
        const snap = await getSnapshot(env)
        return json({ connected, lastFetched: snap?.fetched_at || null }, env)
      }

      // POST /api/sync  -> fresh pull, cache, return raw SimpleFIN JSON
      if (url.pathname === '/api/sync' && request.method === 'POST') {
        const text = await pullAccounts(env)
        await saveSnapshot(env, text)
        return new Response(text, { headers: { 'Content-Type': 'application/json', ...cors(env) } })
      }

      // GET /api/snapshot -> last cached pull (no live call)
      if (url.pathname === '/api/snapshot' && request.method === 'GET') {
        const snap = await getSnapshot(env)
        if (!snap) return json({ accounts: [], fetched_at: null }, env)
        const payload = JSON.parse(snap.json)
        payload.fetched_at = snap.fetched_at
        return json(payload, env)
      }

      return json({ error: 'not_found' }, env, 404)
    } catch (err) {
      const code = err.message === 'not_connected' ? 409 : 500
      return json({ error: err.message || 'error' }, env, code)
    }
  },

  // Daily refresh so the app has fresh data without a manual sync.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const text = await pullAccounts(env)
        await saveSnapshot(env, text)
      } catch (err) {
        console.error('cron sync failed:', err.message)
      }
    })())
  }
}
