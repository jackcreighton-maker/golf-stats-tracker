import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { getSettings } from '../db'
import { useCourses } from '../courseStore'
import { aggregate, holePerformance } from '../lib/aggregate'
import { focusAreas } from '../lib/benchmarks'
import { distanceStats } from '../lib/distanceStats'
import { direction, rollingAvg } from '../lib/trends'
import { APPROACH_BUCKETS, APPROACH_BUCKET_LABELS, PUTT_BUCKETS, PUTT_BUCKET_LABELS } from '../lib/buckets'
import Sparkline from '../components/Sparkline'
import BandBars from '../components/BandBars'
import type { Navigate } from '../App'

type Window = 5 | 10 | 20 | 0 // 0 = all

function KpiTile({
  label,
  value,
  sub,
  series,
  higherIsBetter,
}: {
  label: string
  value: string
  sub?: string
  series: number[]
  higherIsBetter: boolean
}) {
  const dir = direction(series)
  const showArrow = dir === 'up' || dir === 'down'
  const good = showArrow && (dir === 'up') === higherIsBetter
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="val">
        {value}
        {showArrow && (
          <span className={`trend ${good ? 'up' : 'down'}`} style={{ marginLeft: 6, fontSize: '0.85rem' }}>
            {dir === 'up' ? '▲' : '▼'}
          </span>
        )}
      </div>
      {sub && <div className="muted small">{sub}</div>}
      {series.length >= 4 && (
        <div style={{ marginTop: 6 }}>
          <Sparkline values={rollingAvg(series, 5)} height={28} />
        </div>
      )}
    </div>
  )
}

export default function Stats({ navigate }: { navigate: Navigate }) {
  const courses = useCourses()
  const settings = useLiveQuery(getSettings, [])
  const [windowSize, setWindowSize] = useState<Window>(0)
  const [courseFilter, setCourseFilter] = useState<string>('')

  const allRounds = useLiveQuery(() => db.rounds.where('status').equals('complete').reverse().sortBy('date'), [])

  if (!allRounds || !courses) return <div className="screen" />

  const courseMap = new Map(courses.map((c) => [c.id, c]))
  let rounds = courseFilter ? allRounds.filter((r) => r.courseId === courseFilter) : allRounds
  if (windowSize) rounds = rounds.slice(0, windowSize)

  const agg = aggregate(rounds, courseMap)
  const handicap = settings?.handicapIndex ?? rounds[0]?.playingHandicap ?? 15
  const focus = agg ? focusAreas(agg, handicap) : []
  const dist = distanceStats(rounds, courseMap)

  const filterCourse = courseFilter ? courseMap.get(courseFilter) : undefined
  const perHole = filterCourse ? holePerformance(rounds, filterCourse).filter((h) => h.rounds > 0) : []
  const worstHoles = [...perHole].sort((a, b) => b.avgToPar - a.avgToPar).slice(0, 3)
  const playedCourseIds = new Set(allRounds.map((r) => r.courseId))

  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—')

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Stats</h1>
        {agg && <span className="muted small">{agg.rounds} round{agg.rounds === 1 ? '' : 's'}</span>}
      </div>

      <div className="seg">
        {([5, 10, 20, 0] as Window[]).map((w) => (
          <button key={w} className={windowSize === w ? 'on' : ''} onClick={() => setWindowSize(w)}>
            {w === 0 ? 'All' : `Last ${w}`}
          </button>
        ))}
      </div>

      <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
        <option value="">All courses</option>
        {courses.filter((c) => playedCourseIds.has(c.id)).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {!agg ? (
        <div className="card muted">No completed rounds{courseFilter ? ' at this course' : ''} yet.</div>
      ) : (
        <>
          {focus.length > 0 && (
            <div className="card">
              <h2>Work on</h2>
              {focus.map((f, i) => (
                <div key={f.key} className="focus-row" style={{ borderBottom: i < focus.length - 1 ? '1px solid var(--border)' : undefined }}>
                  <span className="rank">{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {f.label} {f.trendingWrongWay && <span className="flag">▼ trending worse</span>}
                    </div>
                    <div className="muted small">{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="stat-grid">
            <div className="stat-tile">
              <div className="label">Avg score</div>
              <div className="val">{agg.avgGross.toFixed(1)}</div>
              <div className="muted small">{agg.avgToPar >= 0 ? '+' : ''}{agg.avgToPar.toFixed(1)} to par</div>
            </div>
            <div className="stat-tile">
              <div className="label">Handicap diff.</div>
              <div className="val">{agg.avgDifferential != null ? agg.avgDifferential.toFixed(1) : '—'}</div>
              <div className="muted small">{agg.avgDifferential != null ? 'course-adjusted' : 'needs CR/slope'}</div>
            </div>
          </div>

          <div className="stat-grid">
            <KpiTile label="Points /rd" value={agg.avgPoints.toFixed(1)} series={agg.series.points} higherIsBetter />
            <KpiTile label="Putts /rd" value={agg.avgPutts.toFixed(1)} series={agg.series.putts} higherIsBetter={false} />
            <KpiTile label="GIR" value={agg.girPct != null ? `${agg.girPct.toFixed(0)}%` : '—'} series={agg.series.gir} higherIsBetter />
            <KpiTile label="Fairways" value={agg.firPct != null ? `${agg.firPct.toFixed(0)}%` : '—'} series={agg.series.fir} higherIsBetter />
            <KpiTile label="Errors /rd" value={agg.errorsPerRound.toFixed(1)} sub="pen + 3-putt + OOP" series={agg.series.errors} higherIsBetter={false} />
          </div>

          <div className="card">
            <h2>Shots given away (per round)</h2>
            <div className="stat-grid">
              <div className="stat-tile"><div className="label">3-putts</div><div className="val">{agg.threePuttsPerRound.toFixed(1)}</div></div>
              <div className="stat-tile"><div className="label">Penalties</div><div className="val">{agg.penaltiesPerRound.toFixed(1)}</div></div>
              <div className="stat-tile"><div className="label">Blow-ups</div><div className="val">{agg.blowUpsPerRound.toFixed(1)}</div><div className="muted small">double or worse</div></div>
              <div className="stat-tile"><div className="label">Out of position</div><div className="val">{agg.outOfPositionPerRound.toFixed(1)}</div><div className="muted small">{agg.outOfPositionPct != null ? `${agg.outOfPositionPct.toFixed(0)}% of drives` : 'off tee'}</div></div>
            </div>
          </div>

          <div className="card">
            <h2>Scoring by hole type</h2>
            {([3, 4, 5] as const).map((p) => (
              <div key={p} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="muted">Par {p}s</span>
                <span style={{ fontWeight: 700 }}>
                  {agg.avgToParByPar[p] != null ? `${agg.avgToParByPar[p]! >= 0 ? '+' : ''}${agg.avgToParByPar[p]!.toFixed(2)}` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Putting by first-putt distance</h2>
            {dist.puttingHoles === 0 ? (
              <div className="muted small">No data yet — tap the optional first-putt distance during rounds.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="scorecard">
                  <thead>
                    <tr><th style={{ textAlign: 'left' }}>From</th><th>Holes</th><th>1-putt</th><th>3-putt</th><th>Avg</th></tr>
                  </thead>
                  <tbody>
                    {PUTT_BUCKETS.map((b) => {
                      const p = dist.putting[b]
                      return (
                        <tr key={b}>
                          <td style={{ textAlign: 'left' }}>{PUTT_BUCKET_LABELS[b]}</td>
                          <td className="muted">{p.holes || '·'}</td>
                          <td className={p.holes && p.onePutt / p.holes >= 0.5 ? 'score-birdie' : ''}>{p.holes ? pct(p.onePutt, p.holes) : '·'}</td>
                          <td className={p.holes && p.threePutt / p.holes >= 0.25 ? 'score-double' : ''}>{p.holes ? pct(p.threePutt, p.holes) : '·'}</td>
                          <td>{p.holes ? (p.totalPutts / p.holes).toFixed(2) : '·'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Greens hit by approach distance</h2>
            <BandBars
              bands={APPROACH_BUCKETS.map((b) => {
                const a = dist.approach[b]
                return { label: APPROACH_BUCKET_LABELS[b], pct: a.holes ? (a.gir / a.holes) * 100 : null, caption: a.holes ? `(${a.holes})` : '' }
              })}
            />
          </div>

          {filterCourse && perHole.length > 0 && (
            <div className="card">
              <h2>Hole by hole at {filterCourse.name}</h2>
              {worstHoles.length > 0 && (
                <div className="small" style={{ marginBottom: 8 }}>
                  Costliest: {worstHoles.map((h) => `#${h.hole} (+${h.avgToPar.toFixed(1)})`).join(', ')}
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table className="scorecard">
                  <thead>
                    <tr><th>Hole</th>{perHole.map((h) => <th key={h.hole}>{h.hole}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="muted">Avg ±</td>
                      {perHole.map((h) => (
                        <td key={h.hole} className={h.avgToPar >= 1.5 ? 'score-double' : h.avgToPar <= 0 ? 'score-birdie' : ''}>
                          {h.avgToPar.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button className="btn btn-secondary btn-block" onClick={() => navigate({ name: 'home' })}>
            Back to home
          </button>
        </>
      )}
    </div>
  )
}
