import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { useCourses } from '../courseStore'
import { aggregate, holePerformance } from '../lib/aggregate'
import Sparkline from '../components/Sparkline'
import type { Navigate } from '../App'

type Window = 5 | 10 | 20 | 0 // 0 = all

export default function Stats({ navigate }: { navigate: Navigate }) {
  const courses = useCourses()
  const [windowSize, setWindowSize] = useState<Window>(0)
  const [courseFilter, setCourseFilter] = useState<string>('')

  const allRounds = useLiveQuery(
    () => db.rounds.where('status').equals('complete').reverse().sortBy('date'),
    [],
  )

  if (!allRounds || !courses) return <div className="screen" />

  const courseMap = new Map(courses.map((c) => [c.id, c]))
  let rounds = courseFilter ? allRounds.filter((r) => r.courseId === courseFilter) : allRounds
  if (windowSize) rounds = rounds.slice(0, windowSize)

  const agg = aggregate(rounds, courseMap)
  const filterCourse = courseFilter ? courseMap.get(courseFilter) : undefined
  const perHole = filterCourse ? holePerformance(rounds, filterCourse).filter((h) => h.rounds > 0) : []
  const worstHoles = [...perHole].sort((a, b) => b.avgToPar - a.avgToPar).slice(0, 3)

  const playedCourseIds = new Set(allRounds.map((r) => r.courseId))

  return (
    <div className="screen">
      <div className="topbar"><h1>Stats</h1></div>

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
          <div className="stat-grid">
            <div className="stat-tile"><div className="label">Avg score</div><div className="val">{agg.avgGross.toFixed(1)}</div><div className="muted small">{agg.avgToPar >= 0 ? '+' : ''}{agg.avgToPar.toFixed(1)} to par</div></div>
            <div className="stat-tile"><div className="label">Avg points</div><div className="val">{agg.avgPoints.toFixed(1)}</div></div>
            <div className="stat-tile"><div className="label">Avg putts</div><div className="val">{agg.avgPutts.toFixed(1)}</div><div className="muted small">{agg.threePuttsPerRound.toFixed(1)} three-putts/rd</div></div>
            <div className="stat-tile"><div className="label">GIR</div><div className="val">{agg.girPct != null ? `${agg.girPct.toFixed(0)}%` : '—'}</div></div>
            <div className="stat-tile"><div className="label">Fairways</div><div className="val">{agg.firPct != null ? `${agg.firPct.toFixed(0)}%` : '—'}</div></div>
            <div className="stat-tile"><div className="label">Scrambling</div><div className="val">{agg.scramblePct != null ? `${agg.scramblePct.toFixed(0)}%` : '—'}</div></div>
            <div className="stat-tile"><div className="label">Blow-ups /rd</div><div className="val">{agg.blowUpsPerRound.toFixed(1)}</div><div className="muted small">double or worse</div></div>
            <div className="stat-tile"><div className="label">Penalties /rd</div><div className="val">{agg.penaltiesPerRound.toFixed(1)}</div></div>
          </div>

          {agg.trends.points.length >= 2 && (
            <div className="card">
              <h2>Stableford trend</h2>
              <Sparkline values={agg.trends.points} />
            </div>
          )}
          {agg.trends.toPar.length >= 2 && (
            <div className="card">
              <h2>Score to par trend</h2>
              <Sparkline values={agg.trends.toPar.map((v) => -v)} />
              <div className="muted small">Up = better (closer to par)</div>
            </div>
          )}

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
            <h2>Strokes gained per round (approx.)</h2>
            {(['tee', 'approach', 'shortGame', 'putting'] as const).every((k) => !agg.sg[k]) ? (
              <div className="muted small">Fill the optional distance fields during rounds to unlock this.</div>
            ) : (
              (['tee', 'approach', 'shortGame', 'putting'] as const).map((k) => {
                const v = agg.sg[k]
                const label = { tee: 'Off the tee', approach: 'Approach', shortGame: 'Short game', putting: 'Putting' }[k]
                return (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="muted">{label} {v && <span className="small">({v.rounds} rds)</span>}</span>
                    <span style={{ fontWeight: 700, color: v ? (v.perRound >= 0 ? 'var(--green)' : 'var(--red)') : undefined }}>
                      {v ? `${v.perRound >= 0 ? '+' : ''}${v.perRound.toFixed(1)}` : '—'}
                    </span>
                  </div>
                )
              })
            )}
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
