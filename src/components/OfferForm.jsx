import { useState } from 'react'

export default function OfferForm({ offer, cards, onSave, onDelete, onClose }) {
  const editing = Boolean(offer)
  const [cardId, setCardId] = useState(offer?.cardId || cards[0]?.id || '')
  const [merchant, setMerchant] = useState(offer?.merchant || '')
  const [value, setValue] = useState(offer?.value ?? '')
  const [expires, setExpires] = useState(offer?.expires || '')
  const [activated, setActivated] = useState(Boolean(offer?.activated))
  const [notes, setNotes] = useState(offer?.notes || '')

  function submit(e) {
    e.preventDefault()
    if (!merchant.trim()) return
    onSave({
      ...offer,
      cardId: cardId || null,
      merchant: merchant.trim(),
      value: value === '' ? null : Number(value),
      expires: expires || null,
      activated,
      notes: notes.trim()
    })
    onClose()
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Merchant</label>
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Whole Foods" autoFocus />
      </div>
      <div className="field">
        <label>Card</label>
        <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">— unassigned —</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Value ($)</label>
          <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="25" />
        </div>
        <div className="field">
          <label>Expires</label>
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <div className="checkbox-row">
          <input id="activated" type="checkbox" checked={activated} onChange={(e) => setActivated(e.target.checked)} />
          <label htmlFor="activated" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>Activated</label>
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button type="submit" className="btn" style={{ marginTop: 8 }}>
        {editing ? 'Save offer' : 'Add offer'}
      </button>
      {editing && (
        <button
          type="button"
          className="btn danger"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm('Delete this offer?')) {
              onDelete(offer.id)
              onClose()
            }
          }}
        >
          Delete offer
        </button>
      )}
    </form>
  )
}
