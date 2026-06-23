import { useState } from 'react'
import { money, resetText, formatDate } from '../lib/format.js'

// Quick "mark used" controls for a single benefit: slider + increment buttons.
export default function UseBenefitSheet({ benefit, onSave, onEdit, onClose }) {
  const amount = Number(benefit.amount) || 0
  const [used, setUsed] = useState(Number(benefit.usedThisPeriod) || 0)
  const remaining = Math.max(0, amount - used)

  function commit(next) {
    const clamped = Math.max(0, Math.min(amount, Math.round(next * 100) / 100))
    setUsed(clamped)
  }

  function save() {
    onSave({ ...benefit, usedThisPeriod: used })
    onClose()
  }

  // Sensible quick increments based on the benefit size.
  const step = amount >= 200 ? 50 : amount >= 50 ? 25 : amount >= 20 ? 10 : 5

  return (
    <div>
      <div className="benefit-card-label" style={{ marginBottom: 2 }}>
        {benefit.card?.name || 'Unassigned'}
      </div>
      <h2 style={{ marginTop: 0 }}>{benefit.name}</h2>
      <div className="benefit-meta" style={{ marginBottom: 12 }}>
        <span>{money(amount)} total · {resetText(benefit.remainingDays, benefit.isDone)}</span>
        <span>ends {formatDate(benefit.currentPeriodEnd)}</span>
      </div>

      <div className="slider-val">{money(remaining)} <span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 400 }}>left</span></div>
      <div className="slider-wrap">
        <input
          type="range"
          min={0}
          max={amount || 1}
          step={amount > 100 ? 5 : 1}
          value={used}
          onChange={(e) => commit(Number(e.target.value))}
        />
        <div className="benefit-meta">
          <span>used {money(used)}</span>
          <span>of {money(amount)}</span>
        </div>
      </div>

      <div className="use-row">
        <button type="button" onClick={() => commit(used + step)}>+{money(step)}</button>
        <button type="button" onClick={() => commit(amount)}>Use all</button>
        <button type="button" onClick={() => commit(0)}>Reset</button>
      </div>

      <button type="button" className="btn" onClick={save}>Save</button>
      <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={onEdit}>
        Edit details
      </button>
    </div>
  )
}
