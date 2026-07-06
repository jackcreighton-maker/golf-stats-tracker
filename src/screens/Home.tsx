import { useLiveQuery } from 'dexie-react-hooks'
import db, { getSettings } from '../db'
import { useCourses } from '../courseStore'
import { roundTotals } from '../lib/scoring'
import type { Navigate } from '../App'
import Sparkline from '../components/Sparkline'

export default function Home({ navigate }: { navigate: Navigate }) {
  const settings = useLiveQuery(getSettings, [])
  const courses = useCourses()
  const activeRound = useLiveQuery(() => db.rounds.where('status').equals('active').first(), [])
  const recentRounds = useLiveQuery(
    () => db.rounds.where('status').equals('complete').reverse().sortBy('date').then((r) => r.slice(0, 10)),
    [],
  )

  const courseById = new Map((courses ?? []).map((c) => [c.id, c]))
  const last = recentRounds?.[0]
  const lastCourse = last ? courseById.get(last.courseId) : undefined
  const lastTotals = last && lastCourse ? roundTotals(last, lastCourse) : undefined

  const pointsTrend = (recentRounds ?? [])
    .filter((r) => courseById.get(r.courseId))
    .map((r) => roundTotals(r, courseById.get(r.courseId)!).points)
    .reverse()

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Golf Stats</h1>
        {settings?.handicapIndex != null && (
          <span className="badge verified">HCP {settings.handicapIndex.toFixed(1)}</span>
        )}
      </div>

      {activeRound ? (
        <button className="btn btn-primary btn-big btn-block" onClick={() => navigate({ name: 'play', roundId: activeRound.id! })}>
          ▶ Resume round — {courseById.get(activeRound.courseId)?.name ?? 'course'}
        </button>
      ) : (
        <button className="btn btn-primary btn-big btn-block" onClick={() => navigate({ name: 'new-round' })}>
          + New round
        </button>
      )}

      {lastTotals && lastCourse && (
        <div className="card">
          <h2>Last round</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{lastCourse.name}</div>
              <div className="muted small">{last!.date} · {last!.teeName}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{lastTotals.gross}</div>
              <div className="muted small">
                {lastTotals.toPar >= 0 ? '+' : ''}{lastTotals.toPar} · {lastTotals.points} pts
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-block"
            style={{ marginTop: 12 }}
            onClick={() => navigate({ name: 'summary', roundId: last!.id!, from: 'list' })}
          >
            View scorecard
          </button>
        </div>
      )}

      {pointsTrend.length >= 2 && (
        <div className="card">
          <h2>Stableford, last {pointsTrend.length} rounds</h2>
          <Sparkline values={pointsTrend} />
        </div>
      )}

      {recentRounds && recentRounds.length > 0 && (
        <div className="card">
          <h2>Recent rounds</h2>
          <div className="list">
            {recentRounds.slice(0, 5).map((r) => {
              const c = courseById.get(r.courseId)
              const t = c ? roundTotals(r, c) : undefined
              return (
                <button key={r.id} className="list-item" style={{ boxShadow: 'none', padding: '10px 0', borderRadius: 0 }}
                  onClick={() => navigate({ name: 'summary', roundId: r.id!, from: 'list' })}>
                  <span>
                    <span className="title">{c?.name ?? r.courseId}</span>
                    <span className="muted small" style={{ display: 'block' }}>{r.date}</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>
                    {t ? `${t.gross} (${t.toPar >= 0 ? '+' : ''}${t.toPar})` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {recentRounds && recentRounds.length === 0 && !activeRound && (
        <div className="card muted">
          No rounds yet. Start your first round and your stats will build from there.
        </div>
      )}
    </div>
  )
}
