import type { AggregateStats } from './aggregate'
import { direction } from './trends'

// Approximate amateur targets (18-hole round) by handicap band. Rough but useful as
// a "where should I be" reference; easy to tune. Higher-is-better noted per metric.

export type Band = 5 | 10 | 15 | 20 | 25
const BANDS: Band[] = [5, 10, 15, 20, 25]

export type MetricKey = 'gir' | 'fir' | 'putts' | 'threePutts' | 'scrambling' | 'penalties'

interface MetricDef {
  key: MetricKey
  label: string
  higherIsBetter: boolean
  targets: Record<Band, number>
  value: (a: AggregateStats) => number | null
  series: (a: AggregateStats) => number[]
  format: (v: number) => string
}

const METRICS: MetricDef[] = [
  {
    key: 'gir',
    label: 'Greens in regulation',
    higherIsBetter: true,
    targets: { 5: 50, 10: 39, 15: 28, 20: 20, 25: 14 },
    value: (a) => a.girPct,
    series: (a) => a.series.gir,
    format: (v) => `${v.toFixed(0)}%`,
  },
  {
    key: 'fir',
    label: 'Fairways',
    higherIsBetter: true,
    targets: { 5: 62, 10: 57, 15: 52, 20: 46, 25: 40 },
    value: (a) => a.firPct,
    series: (a) => a.series.fir,
    format: (v) => `${v.toFixed(0)}%`,
  },
  {
    key: 'putts',
    label: 'Putts per round',
    higherIsBetter: false,
    targets: { 5: 31, 10: 32.5, 15: 34, 20: 35.5, 25: 36.5 },
    value: (a) => a.avgPutts,
    series: (a) => a.series.putts,
    format: (v) => v.toFixed(1),
  },
  {
    key: 'threePutts',
    label: 'Three-putts',
    higherIsBetter: false,
    targets: { 5: 1.5, 10: 2.2, 15: 3, 20: 3.8, 25: 4.5 },
    value: (a) => a.threePuttsPerRound,
    series: (a) => a.series.threePutts,
    format: (v) => `${v.toFixed(1)}/rd`,
  },
  {
    key: 'scrambling',
    label: 'Scrambling',
    higherIsBetter: true,
    targets: { 5: 40, 10: 30, 15: 22, 20: 16, 25: 12 },
    value: (a) => a.scramblePct,
    series: (a) => a.series.scrambling,
    format: (v) => `${v.toFixed(0)}%`,
  },
  {
    key: 'penalties',
    label: 'Penalties',
    higherIsBetter: false,
    targets: { 5: 1.5, 10: 2.3, 15: 3, 20: 4, 25: 5 },
    value: (a) => a.penaltiesPerRound,
    series: (a) => a.series.penalties,
    format: (v) => `${v.toFixed(1)}/rd`,
  },
]

export function nearestBand(handicap: number): Band {
  return BANDS.reduce((best, b) => (Math.abs(b - handicap) < Math.abs(best - handicap) ? b : best), BANDS[0])
}

export interface FocusItem {
  key: MetricKey
  label: string
  value: number
  target: number
  /** Normalised shortfall vs target (0+); higher = further behind. */
  severity: number
  trendingWrongWay: boolean
  /** e.g. "35.2/rd · target 34" */
  detail: string
}

/**
 * Rank the metrics the golfer is furthest behind their handicap target on.
 * Returns up to `max` items worse than target, most severe first.
 */
export function focusAreas(agg: AggregateStats, handicap: number, max = 3): FocusItem[] {
  const band = nearestBand(handicap)
  const items: FocusItem[] = []

  for (const m of METRICS) {
    const value = m.value(agg)
    if (value == null) continue
    const target = m.targets[band]
    const deficit = m.higherIsBetter ? target - value : value - target
    if (deficit <= 0) continue // meeting or beating target
    const severity = deficit / Math.max(1e-9, Math.abs(target))
    if (severity < 0.05) continue // within noise of target

    const dir = direction(m.series(agg))
    const trendingWrongWay = m.higherIsBetter ? dir === 'down' : dir === 'up'

    items.push({
      key: m.key,
      label: m.label,
      value,
      target,
      severity,
      trendingWrongWay,
      detail: `${m.format(value)} · target ${m.format(target)}`,
    })
  }

  return items.sort((a, b) => b.severity - a.severity).slice(0, max)
}
