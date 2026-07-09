import type { Course, Round } from '../types'
import { roundStats } from './derived'
import { roundTotals } from './scoring'

/** Course-difficulty-normalised score for one round, or null when CR/slope is missing. */
export function scoringDifferential(gross: number, tee: Course['tees'][number] | undefined): number | null {
  if (!tee || tee.courseRating == null || tee.slope == null) return null
  return ((gross - tee.courseRating) * 113) / tee.slope
}

export interface AggregateStats {
  rounds: number
  avgGross: number
  avgToPar: number
  avgPoints: number
  avgPutts: number
  girPct: number | null
  firPct: number | null
  scramblePct: number | null
  outOfPositionPerRound: number
  outOfPositionPct: number | null
  threePuttsPerRound: number
  blowUpsPerRound: number
  penaltiesPerRound: number
  /** Avoidable mistakes per round = penalties + 3-putts + out-of-position drives */
  errorsPerRound: number
  /** Average scoring differential over rounds with CR/slope, else null */
  avgDifferential: number | null
  avgToParByPar: Record<3 | 4 | 5, number | null>
  /** Per-round chronological (oldest → newest) series for KPI trends & focus flags */
  series: {
    points: number[]
    putts: number[]
    gir: number[]
    fir: number[]
    errors: number[]
    threePutts: number[]
    penalties: number[]
    scrambling: number[]
    /** Differentials only for rounds where CR/slope is known (may be shorter) */
    differential: number[]
  }
}

export function aggregate(roundsNewestFirst: Round[], courses: Map<string, Course>): AggregateStats | null {
  const usable = roundsNewestFirst.filter((r) => courses.has(r.courseId))
  if (usable.length === 0) return null
  const chrono = [...usable].reverse()

  let gross = 0, toPar = 0, points = 0, putts = 0
  let gir = 0, girEl = 0, fir = 0, firEl = 0, scr = 0, scrEl = 0
  let oop = 0, drivingHoles = 0
  let threePutts = 0, blowUps = 0, penalties = 0, errors = 0
  let diffSum = 0, diffCount = 0
  const byPar: Record<3 | 4 | 5, { total: number; holes: number }> = { 3: { total: 0, holes: 0 }, 4: { total: 0, holes: 0 }, 5: { total: 0, holes: 0 } }
  const series: AggregateStats['series'] = {
    points: [], putts: [], gir: [], fir: [], errors: [], threePutts: [], penalties: [], scrambling: [], differential: [],
  }

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
    const roundErrors = s.penalties + s.threePutts + s.outOfPosition
    errors += roundErrors

    for (const p of [3, 4, 5] as const) {
      byPar[p].total += s.byPar[p].avgToPar * s.byPar[p].holes
      byPar[p].holes += s.byPar[p].holes
    }

    const tee = course.tees.find((te) => te.name === r.teeName)
    const diff = scoringDifferential(t.gross, tee)
    if (diff != null) {
      diffSum += diff
      diffCount++
      series.differential.push(Math.round(diff * 10) / 10)
    }

    series.points.push(t.points)
    series.putts.push(t.putts)
    series.gir.push(s.girEligible ? (s.girCount / s.girEligible) * 100 : 0)
    series.fir.push(s.firEligible ? (s.firCount / s.firEligible) * 100 : 0)
    series.errors.push(roundErrors)
    series.threePutts.push(s.threePutts)
    series.penalties.push(s.penalties)
    series.scrambling.push(s.scrambleChances ? (s.scrambleSuccesses / s.scrambleChances) * 100 : 0)
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
    errorsPerRound: errors / n,
    avgDifferential: diffCount ? diffSum / diffCount : null,
    avgToParByPar: {
      3: byPar[3].holes ? byPar[3].total / byPar[3].holes : null,
      4: byPar[4].holes ? byPar[4].total / byPar[4].holes : null,
      5: byPar[5].holes ? byPar[5].total / byPar[5].holes : null,
    },
    series,
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
