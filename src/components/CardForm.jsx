import { useState } from 'react'
import { MONTHS } from '../lib/format.js'

export default function CardForm({ card, onSave, onDelete, onClose }) {
  const editing = Boolean(card)
  const [name, setName] = useState(card?.name || '')
  const [issuer, setIssuer] = useState(card?.issuer || '')
  const [annualFee, setAnnualFee] = useState(card?.annualFee ?? '')
  const [last4, setLast4] = useState(card?.last4 || '')
  const [anniversaryMonth, setAnniversaryMonth] = useState(card?.anniversaryMonth || '')

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      ...card,
      name: name.trim(),
      issuer: issuer.trim(),
      annualFee: annualFee === '' ? null : Number(annualFee),
      last4: last4.trim(),
      anniversaryMonth: anniversaryMonth === '' ? null : Number(anniversaryMonth)
    })
    onClose()
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Card name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amex Platinum" autoFocus />
      </div>
      <div className="field">
        <label>Issuer</label>
        <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="American Express" />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Annual fee</label>
          <input type="number" inputMode="decimal" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} placeholder="695" />
        </div>
        <div className="field">
          <label>Last 4 (optional)</label>
          <input value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="1234" maxLength={4} />
        </div>
      </div>
      <div className="field">
        <label>Anniversary month</label>
        <select value={anniversaryMonth} onChange={(e) => setAnniversaryMonth(e.target.value)}>
          <option value="">— none / calendar only —</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <div className="hint">Needed for benefits that reset on your cardmember (anniversary) year.</div>
      </div>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button type="submit" className="btn">{editing ? 'Save card' : 'Add card'}</button>
      </div>
      {editing && (
        <button
          type="button"
          className="btn danger"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm('Delete this card and all of its benefits?')) {
              onDelete(card.id)
              onClose()
            }
          }}
        >
          Delete card
        </button>
      )}
    </form>
  )
}
