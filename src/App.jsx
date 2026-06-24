import { useEffect, useMemo, useRef, useState } from 'react'
import {
  loadState, saveState, normalizeState, emptyState, uid, clearState
} from './lib/storage.js'
import {
  enrichBenefits, sortByUrgency, groupByCard, cardROI,
  totalRemaining, countUrgent, searchBenefits, searchOffers
} from './lib/selectors.js'
import { recomputeUsage } from './lib/matching.js'
import { money } from './lib/format.js'
import seed from './data/cards.seed.json'

import Modal from './components/Modal.jsx'
import BenefitItem from './components/BenefitItem.jsx'
import CardForm from './components/CardForm.jsx'
import BenefitForm from './components/BenefitForm.jsx'
import OfferForm from './components/OfferForm.jsx'
import OffersTab from './components/OffersTab.jsx'
import UseBenefitSheet from './components/UseBenefitSheet.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import ImportSheet from './components/ImportSheet.jsx'

export default function App() {
  const [state, setState] = useState(loadState)
  const [tab, setTab] = useState('dashboard') // 'dashboard' | 'offers'
  const [grouped, setGrouped] = useState(true)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState({}) // cardId -> bool
  const [modal, setModal] = useState(null) // {type, payload}
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  // Persist + keep periods normalized on every change.
  function commit(nextRaw) {
    const next = normalizeState(nextRaw)
    saveState(next)
    setState(next)
  }

  // Re-normalize once on mount in case the app was opened on a new day and a
  // period has rolled over since data was last written.
  useEffect(() => {
    commit(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  // ---- Mutations ----
  function upsertCard(card) {
    const isNew = !card.id
    commit((() => {
      const c = card.id ? card : { ...card, id: uid('card') }
      const exists = state.cards.some((x) => x.id === c.id)
      return {
        ...state,
        cards: exists ? state.cards.map((x) => (x.id === c.id ? c : x)) : [...state.cards, c]
      }
    })())
    showToast(isNew ? 'Card added — now add its benefits' : 'Card saved')
  }
  function deleteCard(cardId) {
    commit({
      ...state,
      cards: state.cards.filter((c) => c.id !== cardId),
      benefits: state.benefits.filter((b) => b.cardId !== cardId),
      offers: state.offers.map((o) => (o.cardId === cardId ? { ...o, cardId: null } : o))
    })
  }
  function upsertBenefit(ben) {
    const b = ben.id ? ben : { ...ben, id: uid('ben') }
    const exists = state.benefits.some((x) => x.id === b.id)
    commit({
      ...state,
      benefits: exists ? state.benefits.map((x) => (x.id === b.id ? b : x)) : [...state.benefits, b]
    })
  }
  function deleteBenefit(id) {
    commit({ ...state, benefits: state.benefits.filter((b) => b.id !== id) })
  }
  function upsertOffer(offer) {
    const o = offer.id ? offer : { ...offer, id: uid('offer') }
    const exists = state.offers.some((x) => x.id === o.id)
    commit({
      ...state,
      offers: exists ? state.offers.map((x) => (x.id === o.id ? o : x)) : [...state.offers, o]
    })
  }
  function deleteOffer(id) {
    commit({ ...state, offers: state.offers.filter((o) => o.id !== id) })
  }
  function toggleOffer(offer) {
    commit({ ...state, offers: state.offers.map((o) => (o.id === offer.id ? { ...o, activated: !o.activated } : o)) })
  }

  // Import parsed + suggested transaction rows for one card, then derive
  // benefit usage from the matched spend.
  function importTransactions(cardId, rows) {
    const newTxns = rows.map((r) => ({
      cardId,
      date: r.date,
      description: r.description,
      amount: r.amount,
      kind: r.kind,
      benefitId: r.benefitId || null,
      offerId: r.offerId || null,
      ignored: false
    }))
    const redeemed = new Map()
    for (const t of newTxns) {
      if (t.offerId && t.kind === 'spend' && !redeemed.has(t.offerId)) redeemed.set(t.offerId, t.date)
    }
    const next = {
      ...state,
      transactions: [...(state.transactions || []), ...newTxns],
      offers: state.offers.map((o) =>
        redeemed.has(o.id) ? { ...o, redeemedDate: o.redeemedDate || redeemed.get(o.id), activated: true } : o
      )
    }
    commit(recomputeUsage(next, new Date()))
    const matched = newTxns.filter((t) => t.benefitId).length
    showToast(`Imported ${newTxns.length} — ${matched} matched to benefits`)
  }

  function clearTransactions() {
    commit({ ...state, transactions: [] })
  }

  function loadSeed() {
    // Merge seed without clobbering existing items (dedupe by id).
    const haveCard = new Set(state.cards.map((c) => c.id))
    const haveBen = new Set(state.benefits.map((b) => b.id))
    const haveOffer = new Set(state.offers.map((o) => o.id))
    commit({
      ...state,
      cards: [...state.cards, ...seed.cards.filter((c) => !haveCard.has(c.id))],
      benefits: [...state.benefits, ...seed.benefits.filter((b) => !haveBen.has(b.id))],
      offers: [...state.offers, ...(seed.offers || []).filter((o) => !haveOffer.has(o.id))]
    })
  }

  function replaceState(next) {
    commit(next)
  }
  function clearAll() {
    clearState()
    setState(emptyState())
  }

  // ---- Derived ----
  const now = new Date()
  const enriched = useMemo(() => enrichBenefits(state, now), [state]) // eslint-disable-line
  const filteredBenefits = useMemo(() => searchBenefits(enriched, query), [enriched, query])
  const offers = useMemo(() => searchOffers(state, query), [state, query])

  const remaining = totalRemaining(enriched)
  const urgent = countUrgent(enriched)

  const isEmpty = state.cards.length === 0 && state.benefits.length === 0

  // ---- Render helpers ----
  const flatList = sortByUrgency(filteredBenefits)
  const groups = groupByCard(state, filteredBenefits)
  // When searching, hide cards with no matching benefits; otherwise show every
  // card (including brand-new ones that have no benefits yet).
  const visibleGroups = query ? groups.filter((g) => g.benefits.length > 0) : groups

  return (
    <div className="app">
      <header className="app-header">
        <h1>Card Perks</h1>
        <button className="icon-btn" aria-label="Settings" onClick={() => setModal({ type: 'settings' })}>⚙︎</button>
      </header>

      <input
        className="search"
        placeholder="Search benefits, cards, offers…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {tab === 'dashboard' && (
        <>
          <div className="summary">
            <div className="stat">
              <div className="label">Unused value</div>
              <div className="value green">{money(remaining)}</div>
            </div>
            <div className="stat">
              <div className="label">Resetting soon</div>
              <div className="value">{urgent}</div>
            </div>
          </div>

          <div className="toggle-row">
            <button className={grouped ? 'active' : ''} onClick={() => setGrouped(true)}>By card</button>
            <button className={!grouped ? 'active' : ''} onClick={() => setGrouped(false)}>What’s expiring</button>
          </div>

          {isEmpty ? (
            <div className="empty">
              <div>No cards yet.</div>
              <button className="btn" onClick={loadSeed}>Load sample data</button>
              <div className="hint" style={{ marginTop: 10 }}>…or tap ＋ to add your own card.</div>
            </div>
          ) : grouped ? (
            visibleGroups.length === 0 ? (
              <div className="empty">No benefits match “{query}”.</div>
            ) : (
              visibleGroups.map((g) => (
                <CardGroup
                  key={g.card?.id || 'orphan'}
                  group={g}
                  enriched={enriched}
                  collapsed={!!collapsed[g.card?.id]}
                  onToggleCollapse={() =>
                    setCollapsed((c) => ({ ...c, [g.card?.id]: !c[g.card?.id] }))
                  }
                  onEditCard={(card) => setModal({ type: 'card', payload: card })}
                  onTapBenefit={(b) => setModal({ type: 'use', payload: b })}
                  onAddBenefit={(cardId) => setModal({ type: 'benefit', defaultCardId: cardId })}
                />
              ))
            )
          ) : flatList.length === 0 ? (
            <div className="empty">
              {query
                ? `No benefits match “${query}”.`
                : 'No benefits yet — switch to “By card” to add some.'}
            </div>
          ) : (
            flatList.map((b) => (
              <BenefitItem key={b.id} benefit={b} onTap={(x) => setModal({ type: 'use', payload: x })} />
            ))
          )}
        </>
      )}

      {tab === 'offers' && (
        <OffersTab
          offers={offers}
          onToggle={toggleOffer}
          onTap={(o) => setModal({ type: 'offer', payload: o })}
        />
      )}

      {/* FAB */}
      <button className="fab" aria-label="Add" onClick={() => setModal({ type: 'add' })}>+</button>

      {/* Bottom nav */}
      <nav className="tabbar">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
          <span className="ico">◎</span> Benefits
        </button>
        <button className={tab === 'offers' ? 'active' : ''} onClick={() => setTab('offers')}>
          <span className="ico">🏷</span> Offers
        </button>
      </nav>

      {/* Modals */}
      {modal?.type === 'add' && (
        <Modal title="Add" onClose={() => setModal(null)}>
          <button className="btn" onClick={() => setModal({ type: 'card' })}>New card</button>
          <button className="btn secondary" style={{ marginTop: 8 }}
            onClick={() => setModal(state.cards.length ? { type: 'benefit' } : { type: 'card' })}>
            New benefit
          </button>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setModal({ type: 'offer' })}>
            New offer
          </button>
          <button className="btn ghost" style={{ marginTop: 8 }}
            onClick={() => setModal(state.cards.length ? { type: 'import' } : { type: 'card' })}>
            ⤓ Import transactions (sync usage)
          </button>
        </Modal>
      )}

      {modal?.type === 'import' && (
        <Modal title="Import transactions" onClose={() => setModal(null)}>
          <ImportSheet
            cards={state.cards}
            benefits={state.benefits}
            offers={state.offers}
            onImport={importTransactions}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'card' && (
        <Modal title={modal.payload ? 'Edit card' : 'New card'} onClose={() => setModal(null)}>
          <CardForm card={modal.payload} onSave={upsertCard} onDelete={deleteCard} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === 'benefit' && (
        <Modal title={modal.payload ? 'Edit benefit' : 'New benefit'} onClose={() => setModal(null)}>
          <BenefitForm
            benefit={modal.payload}
            cards={state.cards}
            defaultCardId={modal.defaultCardId}
            onSave={upsertBenefit}
            onDelete={deleteBenefit}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'offer' && (
        <Modal title={modal.payload ? 'Edit offer' : 'New offer'} onClose={() => setModal(null)}>
          <OfferForm
            offer={modal.payload}
            cards={state.cards}
            onSave={upsertOffer}
            onDelete={deleteOffer}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'use' && (
        <Modal onClose={() => setModal(null)}>
          <UseBenefitSheet
            benefit={modal.payload}
            onSave={upsertBenefit}
            onEdit={() => setModal({ type: 'benefit', payload: modal.payload })}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === 'settings' && (
        <Modal title="Settings & backup" onClose={() => setModal(null)}>
          <SettingsSheet
            state={state}
            onReplaceState={replaceState}
            onLoadSeed={loadSeed}
            onClear={clearAll}
            onToast={showToast}
            onImport={() => setModal({ type: 'import' })}
            onClearTransactions={clearTransactions}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ---- Collapsible card group with ROI line ----
function CardGroup({ group, enriched, collapsed, onToggleCollapse, onEditCard, onTapBenefit, onAddBenefit }) {
  const { card, benefits } = group
  const roi = card ? cardROI(card, enriched) : null
  const groupRemaining = benefits.reduce((s, b) => s + (b.remainingAmount || 0), 0)

  return (
    <div className="card-group">
      <div className="card-group-head">
        <div onClick={onToggleCollapse} style={{ flex: 1 }}>
          <div className="ttl">
            {card ? card.name : 'Unassigned'}{' '}
            <span className="sub">· {money(groupRemaining)} left</span>
          </div>
          {roi && roi.fee != null && (
            <div className={`roi-line ${roi.captured < roi.fee ? 'under' : ''}`}>
              Captured <b>{money(roi.captured)}</b> of {money(roi.fee)} annual fee
            </div>
          )}
        </div>
        {card && (
          <button className="icon-btn" style={{ marginRight: 6 }} aria-label="Edit card"
            onClick={(e) => { e.stopPropagation(); onEditCard(card) }}>✎</button>
        )}
        <span className="chevron" onClick={onToggleCollapse}>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <>
          {benefits.map((b) => (
            <BenefitItem key={b.id} benefit={b} showCard={false} onTap={onTapBenefit} />
          ))}
          {benefits.length === 0 && (
            <div className="empty-benefits">No benefits yet.</div>
          )}
          {card && onAddBenefit && (
            <button className="add-benefit-btn" onClick={() => onAddBenefit(card.id)}>
              ＋ Add benefit
            </button>
          )}
        </>
      )}
    </div>
  )
}
