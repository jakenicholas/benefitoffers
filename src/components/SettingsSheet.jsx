import { useRef, useState } from 'react'
import { exportJSON, importJSON } from '../lib/storage.js'

export default function SettingsSheet({ state, onReplaceState, onLoadSeed, onClear, onToast, onClose, onImport, onSync, onClearTransactions }) {
  const fileRef = useRef(null)
  const [error, setError] = useState('')

  function doExport() {
    const data = exportJSON(state)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `card-perks-backup-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    onToast('Backup downloaded')
  }

  function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const next = importJSON(String(reader.result))
        onReplaceState(next)
        onToast('Data imported')
        onClose()
      } catch (err) {
        setError(err.message || 'Could not import this file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const counts = `${state.cards.length} cards · ${state.benefits.length} benefits · ${state.offers.length} offers`

  return (
    <div>
      <p className="hint" style={{ marginTop: 0 }}>{counts}</p>

      <div className="section-label">Backup</div>
      <button className="btn secondary" onClick={doExport}>Export to JSON</button>
      <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>
        Import from JSON…
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPickFile} />
      {error && <div className="hint" style={{ color: 'var(--red)' }}>{error}</div>}

      <div className="section-label" style={{ marginTop: 18 }}>Sync usage from transactions</div>
      <button className="btn secondary" onClick={() => { onSync(); }}>
        ⟳ Bank sync (auto, Amex/Chase)…
      </button>
      <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => { onImport(); }}>
        ⤓ Import file (any card, incl. Apple)…
      </button>
      <div className="hint">
        {state.transactions?.length
          ? `${state.transactions.length} transactions imported. Benefit usage is derived from matched spend.`
          : 'Import a CSV/OFX export from Amex, Chase, or Apple Card to auto-fill how much of each benefit you’ve used.'}
      </div>
      {state.transactions?.length > 0 && (
        <button
          className="btn ghost"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm('Remove all imported transactions? Benefit amounts already computed stay until you edit them.')) {
              onClearTransactions()
              onToast('Transactions cleared')
            }
          }}
        >
          Clear imported transactions
        </button>
      )}

      <div className="section-label" style={{ marginTop: 18 }}>Seed data</div>
      <button
        className="btn ghost"
        onClick={() => {
          if (confirm('Load the sample card/benefit set? This adds to your current data.')) {
            onLoadSeed()
            onToast('Seed data loaded')
            onClose()
          }
        }}
      >
        Load sample cards & benefits
      </button>
      <div className="hint">Common cards with placeholder amounts flagged “verify”. Correct them to your terms.</div>

      <div className="section-label" style={{ marginTop: 18 }}>Danger zone</div>
      <button
        className="btn danger"
        onClick={() => {
          if (confirm('Delete ALL local data? Export a backup first if unsure.')) {
            onClear()
            onToast('All data cleared')
            onClose()
          }
        }}
      >
        Clear all data
      </button>

      <p className="hint" style={{ marginTop: 18 }}>
        All data lives only in this browser/device (localStorage). No login, no servers, no bank connections.
      </p>
    </div>
  )
}
