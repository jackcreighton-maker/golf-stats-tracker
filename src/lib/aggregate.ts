import type { Course, Round } from '../types'
import { roundStats } from './derived'
import { roundTotals } from './scoring'
import { roundSG } from './strokesGained'

export interface AggregateStats {
  rounds: number
  avgGross: number
  avgToPar: number
  avgPoints: number
  avgPutts: number
  girPct: number | null
  firPct: number | null
  scramblePct: number | null
  /** Out-of-position tee shots per round, and as a % of driving holes */
  outOfPositionPerRound: number
  outOfPositionPct: number | null
  threePuttsPerRound: number
  blowUpsPerRound: number
  penaltiesPerRound: number
  avgToParByPar: Record<3 | 4 | 5, number | null>
  /** Per-round average SG by category, over rounds that have data for it */
  sg: Record<'tee' | 'approach' | 'shortGame' | 'putting', { perRound: number; rounds: number } | null>
  /** Chronological (oldest → newest) trend series */
  trends: { toPar: number[]; points: number[]; putts: number[] }
}

export function aggregate(roundsNewestFirst: Round[], courses: Map<string, Course>): AggregateStats | null {
  const usable = roundsNewestFirst.filter((r) => courses.has(r.courseId))
  if (usable.length === 0) return null
  const chrono = [...usable].reverse()

  let gross = 0, toPar = 0, points = 0, putts = 0
  let gir = 0, girEl = 0, fir = 0, firEl = 0, scr = 0, scrEl = 0
  let oop = 0, drivingHoles = 0
  let threePutts = 0, blowUps = 0, penalties = 0
  const byPar: Record<3 | 4 | 5, { total: number; holes: number }> = { 3: { total: 0, holes: 0 }, 4: { total: 0, holes: 0 }, 5: { total: 0, holes: 0 } }
  const sgAcc = {
    tee: { value: 0, rounds: 0 },
    approach: { value: 0, rounds: 0 },
    shortGame: { value: 0, rounds: 0 },
    putting: { value: 0, rounds: 0 },
  }
  const trends: AggregateStats['trends'] = { toPar: [], points: [], putts: [] }

  for (const r of chrono) {
    const course = courses.get(r.courseId)!
    const t = roundTotals(r, course)
    const s = roundStats(r, course)
    gross += t.gross
    toPar += t.toPar
    points += t.points
    putts += t.putts
    gir += s.girCount; girEl += s.girEligible
    fir += s.firCount; firEl += s.firEligible
    scr += s.scrambleSuccesses; scrEl += s.scrambleChances
    oop += s.outOfPosition; drivingHoles += s.drivingHoles
    threePutts += s.threePutts
    blowUps += s.blowUps
    penalties += s.penalties
    for (const p of [3, 4, 5] as const) {
      byPar[p].total += s.byPar[p].avgToPar * s.byPar[p].holes
      byPar[p].holes += s.byPar[p].holes
    }
    const sg = roundSG(r, course)
    for (const k of ['tee', 'approach', 'shortGame', 'putting'] as const) {
      const v = sg[k]
      if (v) {
        // Scale partial-data rounds up to a per-round (18-hole-equivalent) figure
        sgAcc[k].value += (v.value / v.holes) * 18
        sgAcc[k].rounds++
      }
    }
    trends.toPar.push(t.toPar)
    trends.points.push(t.points)
    trends.putts.push(t.putts)
  }

  const n = chrono.length
  return {
    rounds: n,
    avgGross: gross / n,
    avgToPar: toPar / n,
    avgPoints: points / n,
    avgPutts: putts / n,
    girPct: girEl ? (gir / girEl) * 100 : null,
    firPct: firEl ? (fir / firEl) * 100 : null,
    scramblePct: scrEl ? (scr / scrEl) * 100 : null,
    outOfPositionPerRound: oop / n,
    outOfPositionPct: drivingHoles ? (oop / drivingHoles) * 100 : null,
    threePuttsPerRound: threePutts / n,
    blowUpsPerRound: blowUps / n,
    penaltiesPerRound: penalties / n,
    avgToParByPar: {
      3: byPar[3].holes ? byPar[3].total / byPar[3].holes : null,
      4: byPar[4].holes ? byPar[4].total / byPar[4].holes : null,
      5: byPar[5].holes ? byPar[5].total / byPar[5].holes : null,
    },
    sg: Object.fromEntries(
      (['tee', 'approach', 'shortGame', 'putting'] as const).map((k) => [
        k,
        sgAcc[k].rounds ? { perRound: sgAcc[k].value / sgAcc[k].rounds, rounds: sgAcc[k].rounds } : null,
      ]),
    ) as AggregateStats['sg'],
    trends,
  }
}

export interface HolePerformance {
  hole: number
  par: number
  strokeIndex: number
  rounds: number
  avgToPar: number
}

/** Average score to par per hole at one course, across the given rounds. */
export function holePerformance(rounds: Round[], course: Course): HolePerformance[] {
  return course.holes.map((info) => {
    let total = 0
    let n = 0
    for (const r of rounds) {
      if (r.courseId !== course.id) continue
      const e = r.holes[info.number - 1]
      if (e?.score != null && !e.pickedUp) {
        total += e.score - info.par
        n++
      }
    }
    return { hole: info.number, par: info.par, strokeIndex: info.strokeIndex, rounds: n, avgToPar: n ? total / n : 0 }
  })
}
