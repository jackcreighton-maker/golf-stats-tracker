export interface BandDatum {
  label: string
  /** 0–100, or null when there's no data for this band */
  pct: number | null
  /** small trailing note, e.g. hole count */
  caption?: string
}

/** Simple horizontal %-bars for distance-band breakdowns. */
export default function BandBars({ bands, emptyText }: { bands: BandDatum[]; emptyText?: string }) {
  if (!bands.some((b) => b.pct != null)) {
    return <div className="muted small">{emptyText ?? 'No data yet — fill the optional distance fields during rounds.'}</div>
  }
  return (
    <div>
      {bands.map((b) => (
        <div className="band-row" key={b.label}>
          <span className="band-lbl">{b.label}</span>
          <div className="band-track">
            {b.pct != null && <div className="band-fill" style={{ width: `${Math.max(2, Math.min(100, b.pct))}%` }} />}
          </div>
          <span className="band-val">
            {b.pct != null ? `${Math.round(b.pct)}%` : '—'}
            {b.caption ? <span className="muted"> {b.caption}</span> : null}
          </span>
        </div>
      ))}
    </div>
  )
}
