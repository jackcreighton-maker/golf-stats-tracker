import type { Course, HoleEntry, Round } from '../types'

/**
 * Per-hole derived facts. Everything here is computed — never entered.
 * Holes without a score (or picked up) are excluded from rate stats.
 */
export interface HoleDerived {
  counted: boolean
  par: number
  toPar: number
  /** Green in regulation: reached the green with (par - 2) strokes or fewer, i.e. score - putts <= par - 2 */
  gir: boolean | null
  /** Fairway hit; null when not a driving hole or not recorded */
  fir: boolean | null
  /** Missed GIR — a scramble opportunity */
  scrambleChance: boolean | null
  /** Missed GIR and still made par or better */
  scrambleSuccess: boolean | null
  /** Visited a bunker and still made par or better (greenside-sand-save approximation) */
  sandSave: boolean | null
  threePutt: boolean | null
}

export function deriveHole(entry: HoleEntry, par: number): HoleDerived {
  const counted = entry.score != null && !entry.pickedUp
  const score = entry.score
  const putts = entry.putts

  const gir = counted && score != null && putts != null ? score - putts <= par - 2 : null
  const isDrivingHole = par >= 4
  const fir = isDrivingHole && entry.teeResult !== 'na' ? entry.teeResult === 'fairway' : null
  const scrambleChance = gir == null ? null : !gir
  const scrambleSuccess = scrambleChance ? score! <= par : scrambleChance == null ? null : false
  const sandSave = counted && entry.bunker ? score! <= par : null
  const threePutt = counted && putts != null ? putts >= 3 : null

  return {
    counted,
    par,
    toPar: counted ? score! - par : 0,
    gir,
    fir,
    scrambleChance,
    scrambleSuccess,
    sandSave,
    threePutt,
  }
}

export interface RoundStats {
  holes: number
  gross: number
  toPar: number
  girCount: number
  girEligible: number
  firCount: number
  firEligible: number
  putts: number
  puttHoles: number
  puttsPerGir: number | null
  threePutts: number
  scrambleChances: number
  scrambleSuccesses: number
  sandChances: number
  sandSaves: number
  penalties: number
  /** Holes at double bogey or worse */
  blowUps: number
  /** Score distribution keyed by strokes relative to par (capped at +3 = "3+") */
  distribution: Record<'eagleOrBetter' | 'birdie' | 'par' | 'bogey' | 'double' | 'worse', number>
  /** Gross average relative to par, split by hole par */
  byPar: Record<3 | 4 | 5, { holes: number; avgToPar: number }>
}

export function roundStats(round: Round, course: Course): RoundStats {
  const s: RoundStats = {
    holes: 0,
    gross: 0,
    toPar: 0,
    girCount: 0,
    girEligible: 0,
    firCount: 0,
    firEligible: 0,
    putts: 0,
    puttHoles: 0,
    puttsPerGir: null,
    threePutts: 0,
    scrambleChances: 0,
    scrambleSuccesses: 0,
    sandChances: 0,
    sandSaves: 0,
    penalties: 0,
    blowUps: 0,
    distribution: { eagleOrBetter: 0, birdie: 0, par: 0, bogey: 0, double: 0, worse: 0 },
    byPar: { 3: { holes: 0, avgToPar: 0 }, 4: { holes: 0, avgToPar: 0 }, 5: { holes: 0, avgToPar: 0 } },
  }
  let girPutts = 0
  let girPuttHoles = 0
  const byParTotals: Record<3 | 4 | 5, number> = { 3: 0, 4: 0, 5: 0 }

  for (const entry of round.holes) {
    const info = course.holes[entry.hole - 1]
    if (!info) continue
    const d = deriveHole(entry, info.par)
    s.penalties += entry.penalties
    if (!d.counted) continue

    s.holes++
    s.gross += entry.score!
    s.toPar += d.toPar

    if (d.gir != null) {
      s.girEligible++
      if (d.gir) s.girCount++
    }
    if (d.fir != null) {
      s.firEligible++
      if (d.fir) s.firCount++
    }
    if (entry.putts != null) {
      s.putts += entry.putts
      s.puttHoles++
      if (d.gir) {
        girPutts += entry.putts
        girPuttHoles++
      }
      if (d.threePutt) s.threePutts++
    }
    if (d.scrambleChance) {
      s.scrambleChances++
      if (d.scrambleSuccess) s.scrambleSuccesses++
    }
    if (entry.bunker) {
      s.sandChances++
      if (d.sandSave) s.sandSaves++
    }
    if (d.toPar >= 2) s.blowUps++

    const dist = s.distribution
    if (d.toPar <= -2) dist.eagleOrBetter++
    else if (d.toPar === -1) dist.birdie++
    else if (d.toPar === 0) dist.par++
    else if (d.toPar === 1) dist.bogey++
    else if (d.toPar === 2) dist.double++
    else dist.worse++

    const p = info.par as 3 | 4 | 5
    if (s.byPar[p]) {
      s.byPar[p].holes++
      byParTotals[p] += d.toPar
    }
  }

  for (const p of [3, 4, 5] as const) {
    s.byPar[p].avgToPar = s.byPar[p].holes ? byParTotals[p] / s.byPar[p].holes : 0
  }
  s.puttsPerGir = girPuttHoles ? girPutts / girPuttHoles : null
  return s
}
