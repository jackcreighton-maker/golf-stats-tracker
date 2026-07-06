import type { RoundSG } from '../lib/strokesGained'

const LABELS: [keyof Omit<RoundSG, 'vsBenchmark'>, string][] = [
  ['tee', 'Off the tee'],
  ['approach', 'Approach'],
  ['shortGame', 'Short game'],
  ['putting', 'Putting'],
]

/** Horizontal diverging bars for strokes gained per category. */
export default function SGBars({ sg, scale = 4 }: { sg: RoundSG; scale?: number }) {
  const rows = LABELS.filter(([k]) => sg[k] != null)
  if (rows.length === 0) {
    return <div className="muted small">No strokes-gained data — fill the optional distance fields during a round.</div>
  }
  return (
    <div>
      {rows.map(([key, label]) => {
        const { value, holes } = sg[key]!
        const width = Math.min(50, (Math.abs(value) / scale) * 50)
        return (
          <div className="sg-bar-row" key={key}>
            <span className="lbl">{label} <span style={{ opacity: 0.6 }}>({holes})</span></span>
            <div className="sg-track">
              <div className="zero" />
              <div className={`bar ${value >= 0 ? 'pos' : 'neg'}`} style={{ width: `${width}%` }} />
            </div>
            <span className="num" style={{ color: value >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {value >= 0 ? '+' : ''}{value.toFixed(1)}
            </span>
          </div>
        )
      })}
      <div className="muted small" style={{ marginTop: 6 }}>
        Approximate, vs a scratch benchmark. (n) = holes with data.
      </div>
    </div>
  )
}
