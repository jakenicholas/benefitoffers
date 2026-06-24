import { useEffect, useState } from 'react'
import {
  loadSyncConfig, saveSyncConfig, isConfigured,
  connectBank, getStatus, syncNow, buildSyncedTransactions, guessCardForAccount
} from '../lib/sync.js'

// Phase 2: connect the Cloudflare/SimpleFIN sync worker, map accounts to cards,
// and pull transactions automatically. Apple Card can't be aggregated — keep
// importing it via the file importer.
export default function SyncSheet({ cards, state, onApply, onToast }) {
  const [cfg, setCfg] = useState(loadSyncConfig)
  const [setupToken, setSetupToken] = useState('')
  const [accounts, setAccounts] = useState(null)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const accountMap = cfg.accountMap || {}

  useEffect(() => {
    if (isConfigured(cfg)) {
      getStatus(cfg).then(setStatus).catch(() => setStatus(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(patch) {
    const next = { ...cfg, ...patch }
    setCfg(next)
    saveSyncConfig(next)
  }

  async function run(label, fn) {
    setBusy(label); setError('')
    try { return await fn() }
    catch (err) { setError(err.message || 'Failed.'); return null }
    finally { setBusy('') }
  }

  async function doConnect() {
    const res = await run('connect', () => connectBank(cfg, setupToken))
    if (!res) return
    const accts = res.accounts || []
    setAccounts(accts)
    // auto-suggest a card per account
    const map = { ...accountMap }
    for (const a of accts) if (!map[a.id]) map[a.id] = guessCardForAccount(a, cards)
    update({ accountMap: map })
    setSetupToken('')
    onToast(`Connected — ${accts.length} accounts`)
    getStatus(cfg).then(setStatus).catch(() => {})
  }

  async function doSync() {
    const raw = await run('sync', () => syncNow(cfg))
    if (!raw) return
    const newTxns = buildSyncedTransactions(raw, cfg.accountMap || {}, state)
    const n = onApply(newTxns)
    update({ lastSync: Date.now() })
    onToast(n ? `Synced — ${n} new transactions` : 'Synced — nothing new')
    if (raw.accounts) setAccounts(raw.accounts)
  }

  const configured = isConfigured(cfg)

  return (
    <div>
      <p className="hint" style={{ marginTop: 0 }}>
        Auto-sync Amex &amp; Chase via your Cloudflare worker + SimpleFIN. One-time setup; after that
        it refreshes daily on its own. <b>Apple Card can’t be aggregated</b> — keep using file import for it.
      </p>

      <div className="section-label">1 · Worker</div>
      <div className="field">
        <label>Worker URL</label>
        <input value={cfg.workerUrl || ''} onChange={(e) => update({ workerUrl: e.target.value.trim() })}
          placeholder="https://benefitoffers-sync.you.workers.dev" />
      </div>
      <div className="field">
        <label>API token</label>
        <input value={cfg.token || ''} onChange={(e) => update({ token: e.target.value.trim() })}
          placeholder="the API_TOKEN secret you set" />
      </div>

      <div className="section-label" style={{ marginTop: 16 }}>2 · Connect bank (SimpleFIN)</div>
      <div className="field">
        <label>SimpleFIN setup token</label>
        <textarea value={setupToken} onChange={(e) => setSetupToken(e.target.value.trim())}
          placeholder="paste the one-time setup token from SimpleFIN" style={{ minHeight: 60 }} />
        <button className="btn secondary" style={{ marginTop: 8 }}
          disabled={!configured || !setupToken || busy === 'connect'}
          onClick={doConnect}>
          {busy === 'connect' ? 'Connecting…' : 'Connect'}
        </button>
      </div>

      {accounts && accounts.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>3 · Map accounts → cards</div>
          {accounts.map((a) => (
            <div className="field" key={a.id}>
              <label>{a.org ? `${a.org} · ` : ''}{a.name}</label>
              <select value={accountMap[a.id] || ''}
                onChange={(e) => update({ accountMap: { ...accountMap, [a.id]: e.target.value } })}>
                <option value="">— ignore this account —</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
        </>
      )}

      <div className="section-label" style={{ marginTop: 16 }}>4 · Sync</div>
      <button className="btn" disabled={!configured || busy === 'sync'} onClick={doSync}>
        {busy === 'sync' ? 'Syncing…' : 'Sync now'}
      </button>
      <div className="hint">
        {status?.connected
          ? `Bank connected.${status.lastFetched ? ` Worker last pulled ${new Date(status.lastFetched * 1000).toLocaleString()}.` : ''}`
          : configured ? 'Worker reachable — connect a bank above.' : 'Enter your worker URL + token first.'}
        {cfg.lastSync ? ` This device last synced ${new Date(cfg.lastSync).toLocaleString()}.` : ''}
      </div>

      {error && <div className="hint" style={{ color: 'var(--red)' }}>{error}</div>}

      <p className="hint" style={{ marginTop: 16 }}>
        Setup steps are in <code>worker/README.md</code>. The worker holds your SimpleFIN credentials —
        your bank password is never stored here or in this app.
      </p>
    </div>
  )
}
