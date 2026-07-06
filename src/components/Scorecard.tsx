import type { Course, Round } from '../types'
import { netScore, stablefordPoints } from '../lib/scoring'

function scoreClass(toPar: number): string {
  if (toPar <= -2) return 'score-eagle'
  if (toPar === -1) return 'score-birdie'
  if (toPar === 1) return 'score-bogey'
  if (toPar >= 2) return 'score-double'
  return ''
}

function Nine({ round, course, holes, label }: { round: Round; course: Course; holes: number[]; label: string }) {
  let gross = 0
  let pts = 0
  let par = 0
  const cells = holes.map((h) => {
    const entry = round.holes[h - 1]
    const info = course.holes[h - 1]
    par += info.par
    const points = stablefordPoints(entry, info.par, round.playingHandicap, info.strokeIndex)
    pts += points
    if (entry.score != null && !entry.pickedUp) gross += entry.score
    return { h, entry, info, points }
  })
  return (
    <table className="scorecard">
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>{label}</th>
          {cells.map((c) => <th key={c.h}>{c.h}</th>)}
          <th>Tot</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ textAlign: 'left' }} className="muted">Par</td>
          {cells.map((c) => <td key={c.h} className="muted">{c.info.par}</td>)}
          <td className="muted">{par}</td>
        </tr>
        <tr>
          <td style={{ textAlign: 'left' }}>Score</td>
          {cells.map((c) => (
            <td key={c.h} className={c.entry.score != null && !c.entry.pickedUp ? scoreClass(c.entry.score - c.info.par) : 'muted'}>
              {c.entry.pickedUp ? '–' : c.entry.score ?? '·'}
            </td>
          ))}
          <td className="tot">{gross || '·'}</td>
        </tr>
        <tr>
          <td style={{ textAlign: 'left' }} className="muted">Net</td>
          {cells.map((c) => {
            const net = netScore(c.entry, round.playingHandicap, c.info.strokeIndex)
            return <td key={c.h} className="muted">{net ?? '·'}</td>
          })}
          <td />
        </tr>
        <tr>
          <td style={{ textAlign: 'left' }} className="muted">Pts</td>
          {cells.map((c) => <td key={c.h}>{c.entry.score != null || c.entry.pickedUp ? c.points : '·'}</td>)}
          <td className="tot">{pts}</td>
        </tr>
        <tr>
          <td style={{ textAlign: 'left' }} className="muted">Putts</td>
          {cells.map((c) => <td key={c.h} className={c.entry.putts != null && c.entry.putts >= 3 ? 'score-double' : 'muted'}>{c.entry.putts ?? '·'}</td>)}
          <td className="muted">{cells.reduce((a, c) => a + (c.entry.putts ?? 0), 0) || '·'}</td>
        </tr>
      </tbody>
    </table>
  )
}

export default function Scorecard({ round, course }: { round: Round; course: Course }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowX: 'auto' }}>
      <Nine round={round} course={course} holes={[1, 2, 3, 4, 5, 6, 7, 8, 9]} label="Out" />
      <Nine round={round} course={course} holes={[10, 11, 12, 13, 14, 15, 16, 17, 18]} label="In" />
    </div>
  )
}
