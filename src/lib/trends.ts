// Small trend helpers for the KPI tiles. Series are chronological (oldest → newest).

/** Trailing moving average; window is clamped to the available length. */
export function rollingAvg(series: number[], window = 5): number[] {
  return series.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = series.slice(start, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export type TrendDirection = 'up' | 'down' | 'flat' | null

/**
 * Direction of change comparing the recent half of the series to the earlier half.
 * `null` when there isn't enough data (< minPoints) to say anything.
 * `up`/`down` describe the raw numeric movement — the caller decides whether up is good.
 */
export function direction(series: number[], minPoints = 4): TrendDirection {
  if (series.length < minPoints) return null
  const mid = Math.floor(series.length / 2)
  const earlier = series.slice(0, mid)
  const recent = series.slice(mid)
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const delta = avg(recent) - avg(earlier)
  const scale = Math.max(1e-9, Math.abs(avg(earlier)))
  if (Math.abs(delta) / scale < 0.03) return 'flat'
  return delta > 0 ? 'up' : 'down'
}
