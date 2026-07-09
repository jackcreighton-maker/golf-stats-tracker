export default function Sparkline({ values, height = 56 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null
  const w = 300
  const h = height
  const pad = 6
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1)
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad)
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const lastVal = values[values.length - 1]
  return (
    <svg className="sparkline" style={{ height }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(lastVal)} r="3.5" fill="var(--green)" />
    </svg>
  )
}
