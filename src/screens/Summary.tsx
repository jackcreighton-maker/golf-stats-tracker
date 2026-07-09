import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { useCourse } from '../courseStore'
import { roundTotals } from '../lib/scoring'
import { roundStats } from '../lib/derived'
import { distanceStats } from '../lib/distanceStats'
import { APPROACH_BUCKETS, APPROACH_BUCKET_LABELS } from '../lib/buckets'
import Scorecard from '../components/Scorecard'
import BandBars from '../components/BandBars'
import type { Navigate } from '../App'

function pct(n: number, of: number): string {
  return of ? `${Math.round((n / of) * 100)}%` : '—'
}

export default function Summary({ navigate, roundId, from }: { navigate: Navigate; roundId: number; from?: 'play' | 'list' }) {
  const round = useLiveQuery(() => db.rounds.get(roundId), [roundId])
  const course = useCourse(round?.courseId ?? null)

  if (!round || !course) return <div className="screen" />

  const totals = roundTotals(round, course)
  const stats = roundStats(round, course)
  const dist = distanceStats([round], new Map([[course.id, course]]))

  async function deleteRound() {
    if (!window.confirm('Delete this round? This cannot be undone.')) return
    await db.rounds.delete(roundId)
    navigate({ name: 'home' })
  }

  async function reopenRound() {
    await db.rounds.update(roundId, { status: 'active' })
    navigate({ name: 'play', roundId })
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1>{from === 'play' ? 'Round complete' : 'Round'}</h1>
        <button className="btn btn-secondary" onClick={() => navigate({ name: 'home' })}>Done</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{course.name}</div>
            <div className="muted small">{round.date} · {round.teeName} · PH {round.playingHandicap}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{totals.gross}</div>
            <div className="muted">{totals.toPar >= 0 ? '+' : ''}{totals.toPar} · {totals.points} pts</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Scorecard</h2>
        <Scorecard round={round} course={course} />
      </div>

      <div className="stat-grid">
        <div className="stat-tile"><div className="label">Putts</div><div className="val">{stats.putts}</div></div>
        <div className="stat-tile"><div className="label">GIR</div><div className="val">{pct(stats.girCount, stats.girEligible)}</div></div>
        <div className="stat-tile"><div className="label">Fairways</div><div className="val">{pct(stats.firCount, stats.firEligible)}</div></div>
        <div className="stat-tile"><div className="label">3-putts</div><div className="val">{stats.threePutts}</div></div>
        <div className="stat-tile"><div className="label">Scrambling</div><div className="val">{pct(stats.scrambleSuccesses, stats.scrambleChances)}</div></div>
        <div className="stat-tile"><div className="label">Out of position</div><div className="val">{stats.outOfPosition}</div><div className="muted small">off {stats.drivingHoles} drive{stats.drivingHoles === 1 ? '' : 's'}</div></div>
        <div className="stat-tile"><div className="label">Penalties</div><div className="val">{stats.penalties}</div></div>
        <div className="stat-tile"><div className="label">Blow-ups</div><div className="val">{stats.blowUps}</div><div className="muted small">double or worse</div></div>
      </div>

      {dist.approachHoles > 0 && (
        <div className="card">
          <h2>Greens hit by approach distance</h2>
          <BandBars
            bands={APPROACH_BUCKETS.map((b) => {
              const a = dist.approach[b]
              return { label: APPROACH_BUCKET_LABELS[b], pct: a.holes ? (a.gir / a.holes) * 100 : null, caption: a.holes ? `(${a.holes})` : '' }
            })}
          />
        </div>
      )}

      <div className="hole-nav">
        <button className="btn btn-secondary" onClick={reopenRound}>Edit round</button>
        <button className="btn btn-danger" onClick={deleteRound}>Delete</button>
      </div>
    </div>
  )
}
