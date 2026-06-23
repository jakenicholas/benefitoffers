import { money, resetText } from '../lib/format.js'

// One benefit row on the dashboard. Tapping opens the quick-use sheet.
export default function BenefitItem({ benefit, showCard = true, onTap }) {
  const amount = Number(benefit.amount) || 0
  const used = Number(benefit.usedThisPeriod) || 0
  const pct = amount > 0 ? Math.min(100, (used / amount) * 100) : 0
  const badgeClass = benefit.isDone ? 'done' : benefit.isUrgent ? 'urgent' : 'green'

  return (
    <div className={`benefit ${benefit.isUrgent ? 'urgent' : ''}`} onClick={() => onTap(benefit)}>
      <div className="benefit-top">
        <div>
          <div className="benefit-name">
            {benefit.name}
            {benefit.verify && <span className="verify-tag">verify</span>}
          </div>
          {showCard && <div className="benefit-card-label">{benefit.card?.name || 'Unassigned'}</div>}
        </div>
        <div className={`badge ${badgeClass}`}>
          <div className="amount">{benefit.isDone ? 'Used' : `${money(benefit.remainingAmount)} left`}</div>
          <div className="reset">{resetText(benefit.remainingDays, benefit.isDone)}</div>
        </div>
      </div>

      <div className="progress">
        <div className={pct >= 100 ? 'full' : ''} style={{ width: `${pct}%` }} />
      </div>
      <div className="benefit-meta">
        <span>{money(used)} of {money(amount)} used</span>
        <span>{benefit.description}</span>
      </div>
    </div>
  )
}
