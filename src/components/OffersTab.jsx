import { money, formatDate } from '../lib/format.js'

export default function OffersTab({ offers, onToggle, onTap }) {
  if (offers.length === 0) {
    return <div className="empty">No offers yet. Tap + to add a card-linked offer.</div>
  }
  // Active (unactivated) first, then by soonest expiry.
  const sorted = [...offers].sort((a, b) => {
    if (a.activated !== b.activated) return a.activated ? 1 : -1
    return (a.expires || '9999').localeCompare(b.expires || '9999')
  })
  return (
    <div>
      {sorted.map((o) => (
        <div key={o.id} className={`offer ${o.activated ? 'activated' : ''}`}>
          <div style={{ flex: 1 }} onClick={() => onTap(o)}>
            <div className="merchant">{o.merchant}</div>
            <div className="sub">
              {o.card?.name || 'Unassigned'}
              {o.expires ? ` · expires ${formatDate(o.expires)}` : ''}
            </div>
          </div>
          {o.value != null && <div className="val">{money(o.value)}</div>}
          <label className="switch" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={o.activated} onChange={() => onToggle(o)} />
            <span className="track" />
          </label>
        </div>
      ))}
    </div>
  )
}
