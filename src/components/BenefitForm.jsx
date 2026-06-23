import { useState } from 'react'
import { CADENCES, CADENCE_LABELS, RESET_BASES, RESET_BASIS_LABELS } from '../lib/periods.js'

export default function BenefitForm({ benefit, cards, defaultCardId, onSave, onDelete, onClose }) {
  const editing = Boolean(benefit)
  const [cardId, setCardId] = useState(benefit?.cardId || defaultCardId || cards[0]?.id || '')
  const [name, setName] = useState(benefit?.name || '')
  const [description, setDescription] = useState(benefit?.description || '')
  const [amount, setAmount] = useState(benefit?.amount ?? '')
  const [cadence, setCadence] = useState(benefit?.cadence || 'annual')
  const [resetBasis, setResetBasis] = useState(benefit?.resetBasis || 'calendar')
  const [usedThisPeriod, setUsedThisPeriod] = useState(benefit?.usedThisPeriod ?? 0)
  const [notes, setNotes] = useState(benefit?.notes || '')
  const [verify, setVerify] = useState(Boolean(benefit?.verify))

  const selectedCard = cards.find((c) => c.id === cardId)
  const needsAnniversary = resetBasis === 'cardmember_year' && selectedCard && !selectedCard.anniversaryMonth

  function submit(e) {
    e.preventDefault()
    if (!name.trim() || !cardId) return
    onSave({
      ...benefit,
      cardId,
      name: name.trim(),
      description: description.trim(),
      amount: Number(amount) || 0,
      cadence,
      resetBasis,
      usedThisPeriod: Math.max(0, Number(usedThisPeriod) || 0),
      notes: notes.trim(),
      verify,
      // Force a period recompute on save.
      currentPeriodEnd: null
    })
    onClose()
  }

  if (cards.length === 0) {
    return <p className="empty">Add a card first, then attach benefits to it.</p>
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Card</label>
        <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Benefit name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hotel Credit" autoFocus />
      </div>
      <div className="field">
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Prepaid Fine Hotels + Resorts bookings" />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Amount ($)</label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="300" />
        </div>
        <div className="field">
          <label>Used so far ($)</label>
          <input type="number" inputMode="decimal" value={usedThisPeriod} onChange={(e) => setUsedThisPeriod(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Cadence</label>
          <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
            {CADENCES.map((c) => (
              <option key={c} value={c}>{CADENCE_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Reset basis</label>
          <select value={resetBasis} onChange={(e) => setResetBasis(e.target.value)} disabled={cadence === 'one_time'}>
            {RESET_BASES.map((b) => (
              <option key={b} value={b}>{RESET_BASIS_LABELS[b]}</option>
            ))}
          </select>
        </div>
      </div>
      {needsAnniversary && (
        <div className="hint" style={{ color: 'var(--amber)' }}>
          ⚠ This card has no anniversary month set, so the cardmember-year reset falls back to January. Edit the card to set it.
        </div>
      )}
      <div className="field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" />
      </div>
      <div className="field">
        <div className="checkbox-row">
          <input id="verify" type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
          <label htmlFor="verify" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>
            Flag “verify” (amounts/terms unconfirmed)
          </label>
        </div>
      </div>

      <button type="submit" className="btn" style={{ marginTop: 8 }}>
        {editing ? 'Save benefit' : 'Add benefit'}
      </button>
      {editing && (
        <button
          type="button"
          className="btn danger"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm('Delete this benefit?')) {
              onDelete(benefit.id)
              onClose()
            }
          }}
        >
          Delete benefit
        </button>
      )}
    </form>
  )
}
