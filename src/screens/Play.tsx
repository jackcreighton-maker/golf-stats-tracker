import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { useCourse } from '../courseStore'
import { roundTotals, strokesReceived } from '../lib/scoring'
import { holePlayOrder, type ApproachBucket, type HoleEntry, type PuttBucket, type TeeResult } from '../types'
import { APPROACH_BUCKET_LABELS, PUTT_BUCKET_LABELS } from '../lib/buckets'
import type { Navigate } from '../App'

export default function Play({
  navigate,
  roundId,
  backHandlerRef,
}: {
  navigate: Navigate
  roundId: number
  backHandlerRef: { current: (() => boolean) | null }
}) {
  const round = useLiveQuery(() => db.rounds.get(roundId), [roundId])
  const course = useCourse(round?.courseId ?? null)
  const [orderIndex, setOrderIndex] = useState<number | null>(null)

  // Resume at the first hole without a score — anchored once when the round loads,
  // so entering a score doesn't auto-advance the screen.
  useEffect(() => {
    if (round && orderIndex === null) {
      const order = holePlayOrder(round.startingHole)
      const first = order.findIndex((h) => round.holes[h - 1].score == null && !round.holes[h - 1].pickedUp)
      setOrderIndex(first === -1 ? 0 : first)
    }
  }, [round, orderIndex])

  // Back gesture → previous hole; App sends us Home when this returns false (first hole).
  useEffect(() => {
    backHandlerRef.current = () => {
      if (orderIndex != null && orderIndex > 0) {
        setOrderIndex(orderIndex - 1)
        return true
      }
      return false
    }
    return () => {
      backHandlerRef.current = null
    }
  }, [backHandlerRef, orderIndex])

  if (!round || !course || orderIndex === null) return <div className="screen" />

  const order = holePlayOrder(round.startingHole)
  const idx = orderIndex
  const holeNo = order[idx]
  const entry = round.holes[holeNo - 1]
  const info = course.holes[holeNo - 1]
  const tee = course.tees.find((t) => t.name === round.teeName)
  const dist = tee?.distances?.[holeNo - 1]
  const strokes = strokesReceived(round.playingHandicap, info.strokeIndex)
  const totals = roundTotals(round, course)

  async function update(patch: Partial<HoleEntry>) {
    const holes = [...round!.holes]
    holes[holeNo - 1] = { ...holes[holeNo - 1], ...patch }
    await db.rounds.update(roundId, { holes })
  }

  /** Committing a score also commits the default 2 putts if putts untouched. */
  function commitScore(score: number) {
    const patch: Partial<HoleEntry> = { score, pickedUp: false }
    if (entry.putts == null) patch.putts = 2
    update(patch)
  }

  const displayScore = entry.score ?? info.par
  const scoreCommitted = entry.score != null

  /** Commit the shown score (defaults to par) if the hole hasn't been entered yet. */
  async function saveCurrentHole() {
    if (entry.score == null && !entry.pickedUp) {
      const patch: Partial<HoleEntry> = { score: displayScore }
      if (entry.putts == null) patch.putts = 2
      await update(patch)
    }
  }

  function goToIndex(i: number) {
    if (i >= 0 && i < 18) setOrderIndex(i)
  }

  async function next() {
    await saveCurrentHole()
    goToIndex(idx + 1)
  }

  async function finish() {
    await saveCurrentHole()
    // The current hole is saved above, so exclude it from the missing count.
    const missing = round!.holes.filter((h) => h.hole !== holeNo && h.score == null && !h.pickedUp).length
    if (missing > 0 && !window.confirm(`${missing} hole${missing > 1 ? 's' : ''} without a score. Finish anyway?`)) return
    await db.rounds.update(roundId, { status: 'complete' })
    navigate({ name: 'summary', roundId, from: 'play' })
  }

  return (
    <div className="screen">
      <div className="play-header">
        <div>
          <div className="hole-no">Hole {holeNo}</div>
          <div className="hole-meta">
            Par {info.par} · SI {info.strokeIndex}
            {dist != null ? ` · ${dist} m` : ''}
            {strokes !== 0 ? ` · ${strokes > 0 ? '●'.repeat(Math.min(strokes, 3)) : '○'}` : ''}
          </div>
        </div>
        <div className="running">
          <div className="big">{totals.toPar >= 0 ? '+' : ''}{totals.toPar}</div>
          <div className="hole-meta">{totals.points} pts · {idx + 1}/18</div>
        </div>
      </div>

      <div className="card">
        <h2>Score {!scoreCommitted && <span className="muted">(tap to confirm {info.par})</span>}</h2>
        <div className="stepper">
          <button onClick={() => commitScore(Math.max(1, displayScore - 1))}>−</button>
          <button className="value" style={{ color: scoreCommitted ? 'var(--text)' : 'var(--muted)' }} onClick={() => commitScore(displayScore)}>
            {entry.pickedUp ? '—' : displayScore}
            <span className="sub">{entry.pickedUp ? 'picked up' : scoreCommitted ? toParLabel(entry.score! - info.par) : 'not saved yet'}</span>
          </button>
          <button onClick={() => commitScore(displayScore + 1)}>+</button>
        </div>
      </div>

      <div className="card">
        <h2>Putts</h2>
        <div className="stepper">
          <button onClick={() => update({ putts: Math.max(0, (entry.putts ?? 2) - 1) })}>−</button>
          <span className="value" style={{ color: entry.putts != null ? 'var(--text)' : 'var(--muted)' }}>
            {entry.putts ?? 2}
          </span>
          <button onClick={() => update({ putts: (entry.putts ?? 2) + 1 })}>+</button>
        </div>
      </div>

      {info.par >= 4 && (
        <div className="card">
          <h2>Tee shot</h2>
          <div className="seg">
            {(
              [
                ['left', '← Left'],
                ['fairway', 'Fairway'],
                ['right', 'Right →'],
                ['penalty', 'OB / hazard'],
              ] as [TeeResult, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                className={entry.teeResult === val ? `on${val === 'penalty' ? ' warn' : ''}` : ''}
                onClick={() => update({ teeResult: entry.teeResult === val ? 'na' : val })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="seg" style={{ marginTop: 6 }}>
            <button
              className={entry.teeOutOfPosition ? 'on warn' : ''}
              onClick={() => update({ teeOutOfPosition: !entry.teeOutOfPosition })}
            >
              Out of position
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="seg">
          <button className={entry.bunker ? 'on' : ''} onClick={() => update({ bunker: !entry.bunker })}>
            Bunker
          </button>
          <button
            className={entry.penalties > 0 ? 'on warn' : ''}
            onClick={() => update({ penalties: entry.penalties > 0 ? 0 : 1 })}
          >
            {entry.penalties > 1 ? `${entry.penalties}× penalty` : 'Penalty'}
          </button>
          {entry.penalties > 0 && (
            <button onClick={() => update({ penalties: entry.penalties + 1 })}>+1</button>
          )}
          <button
            className={entry.pickedUp ? 'on warn' : ''}
            onClick={() => update({ pickedUp: !entry.pickedUp })}
          >
            Picked up
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="optional-label">Optional — distances</h2>
        <div className="field" style={{ marginBottom: 10 }}>
          <label className="small muted">Approach from</label>
          <div className="seg">
            {(Object.keys(APPROACH_BUCKET_LABELS) as ApproachBucket[]).map((b) => (
              <button
                key={b}
                className={entry.approachBucket === b ? 'on' : ''}
                onClick={() => update({ approachBucket: entry.approachBucket === b ? undefined : b })}
              >
                {APPROACH_BUCKET_LABELS[b]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="small muted">First putt from</label>
          <div className="seg">
            {(Object.keys(PUTT_BUCKET_LABELS) as PuttBucket[]).map((b) => (
              <button
                key={b}
                className={entry.firstPuttBucket === b ? 'on' : ''}
                onClick={() => update({ firstPuttBucket: entry.firstPuttBucket === b ? undefined : b })}
              >
                {PUTT_BUCKET_LABELS[b]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hole-nav">
        <button className="btn btn-secondary" disabled={idx <= 0} style={idx <= 0 ? { opacity: 0.4 } : undefined} onClick={() => goToIndex(idx - 1)}>
          ‹ Prev
        </button>
        {idx < 17 ? (
          <button className="btn btn-primary" onClick={next}>Next ›</button>
        ) : (
          <button className="btn btn-primary" onClick={finish}>Finish round ✓</button>
        )}
      </div>

      <div className="hole-nav">
        <button className="btn btn-secondary" onClick={() => navigate({ name: 'home' })}>Save & exit</button>
        {idx < 17 && (
          <button className="btn btn-secondary" onClick={finish}>Finish early</button>
        )}
      </div>
    </div>
  )
}

function toParLabel(toPar: number): string {
  if (toPar === 0) return 'par'
  if (toPar === -1) return 'birdie'
  if (toPar === -2) return 'eagle'
  if (toPar <= -3) return 'albatross!'
  if (toPar === 1) return 'bogey'
  if (toPar === 2) return 'double'
  return `+${toPar}`
}
