import { describe, expect, it } from 'vitest'
import { netScore, roundTotals, stablefordPoints, strokesReceived } from './scoring'
import { deriveHole, roundStats } from './derived'
import { aggregate, scoringDifferential, type AggregateStats } from './aggregate'
import { focusAreas } from './benchmarks'
import { distanceStats } from './distanceStats'
import { direction, rollingAvg } from './trends'
import { emptyHoleEntry, holePlayOrder, type Course, type HoleEntry, type Round } from '../types'

// A par-72 test course: SI 1..18 assigned so hole n has stroke index n.
const course: Course = {
  id: 'test',
  name: 'Test GC',
  location: 'Testville',
  parTotal: 72,
  verified: true,
  holes: Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: [4, 5, 3][i % 3] as number, // 6× each → par 72
    strokeIndex: i + 1,
  })),
  tees: [{ name: 'Yellow', color: 'gold', gender: 'male', courseRating: 70.0, slope: 120, distances: null, totalMeters: null }],
}

function entry(hole: number, patch: Partial<HoleEntry>): HoleEntry {
  return { ...emptyHoleEntry(hole), ...patch }
}

describe('strokesReceived', () => {
  it('allocates a 9 handicap one stroke on SI 1-9', () => {
    expect(strokesReceived(9, 1)).toBe(1)
    expect(strokesReceived(9, 9)).toBe(1)
    expect(strokesReceived(9, 10)).toBe(0)
    expect(strokesReceived(9, 18)).toBe(0)
  })
  it('allocates an 18 handicap one stroke everywhere', () => {
    expect(strokesReceived(18, 1)).toBe(1)
    expect(strokesReceived(18, 18)).toBe(1)
  })
  it('allocates a 24 handicap two strokes on SI 1-6, one elsewhere', () => {
    expect(strokesReceived(24, 6)).toBe(2)
    expect(strokesReceived(24, 7)).toBe(1)
    expect(strokesReceived(24, 18)).toBe(1)
  })
  it('gives back strokes for plus handicaps on the highest SI holes', () => {
    expect(strokesReceived(-2, 18)).toBe(-1)
    expect(strokesReceived(-2, 17)).toBe(-1)
    expect(strokesReceived(-2, 16)).toBe(0)
    expect(strokesReceived(-2, 1)).toBe(0)
  })
  it('handles scratch', () => {
    expect(strokesReceived(0, 1)).toBe(0)
    expect(strokesReceived(0, 18)).toBe(0)
  })
})

describe('stablefordPoints', () => {
  // Hand-computed: par 4, SI 5, playing handicap 12 → 1 stroke received.
  const par = 4
  const si = 5
  const ph = 12
  it('scores 2 points for net par', () => {
    expect(stablefordPoints(entry(1, { score: 5 }), par, ph, si)).toBe(2) // gross bogey = net par
  })
  it('scores 3 points for net birdie', () => {
    expect(stablefordPoints(entry(1, { score: 4 }), par, ph, si)).toBe(3)
  })
  it('scores 0 for net double bogey or worse', () => {
    expect(stablefordPoints(entry(1, { score: 7 }), par, ph, si)).toBe(0)
    expect(stablefordPoints(entry(1, { score: 10 }), par, ph, si)).toBe(0)
  })
  it('scores 0 when picked up', () => {
    expect(stablefordPoints(entry(1, { score: 6, pickedUp: true }), par, ph, si)).toBe(0)
  })
  it('scores 0 when no score entered', () => {
    expect(stablefordPoints(entry(1, {}), par, ph, si)).toBe(0)
  })
  it('net score matches', () => {
    expect(netScore(entry(1, { score: 5 }), ph, si)).toBe(4)
    expect(netScore(entry(1, { score: 5, pickedUp: true }), ph, si)).toBeNull()
  })
})

describe('deriveHole', () => {
  it('detects GIR from score minus putts', () => {
    // Par 4: on green in 2 (score 4, 2 putts) = GIR
    expect(deriveHole(entry(1, { score: 4, putts: 2 }), 4).gir).toBe(true)
    // Chipped on in 3, one putt (score 4, 1 putt) = no GIR
    expect(deriveHole(entry(1, { score: 4, putts: 1 }), 4).gir).toBe(false)
    // No putts entered → unknown
    expect(deriveHole(entry(1, { score: 4 }), 4).gir).toBeNull()
  })
  it('scramble = missed GIR and still par or better', () => {
    const d = deriveHole(entry(1, { score: 4, putts: 1 }), 4)
    expect(d.scrambleChance).toBe(true)
    expect(d.scrambleSuccess).toBe(true)
    const failed = deriveHole(entry(1, { score: 5, putts: 2 }), 4)
    expect(failed.scrambleChance).toBe(true)
    expect(failed.scrambleSuccess).toBe(false)
  })
  it('FIR only applies to par 4/5 with a recorded tee result', () => {
    expect(deriveHole(entry(1, { score: 3, putts: 2, teeResult: 'fairway' }), 3).fir).toBeNull()
    expect(deriveHole(entry(1, { score: 4, putts: 2, teeResult: 'left' }), 4).fir).toBe(false)
    expect(deriveHole(entry(1, { score: 4, putts: 2 }), 4).fir).toBeNull()
  })
  it('picked-up holes are not counted', () => {
    const d = deriveHole(entry(1, { score: 8, pickedUp: true }), 4)
    expect(d.counted).toBe(false)
    expect(d.gir).toBeNull()
  })
  it('three putt detection', () => {
    expect(deriveHole(entry(1, { score: 6, putts: 3 }), 4).threePutt).toBe(true)
    expect(deriveHole(entry(1, { score: 4, putts: 2 }), 4).threePutt).toBe(false)
  })
  it('out of position: only on counted driving holes, false when unset', () => {
    expect(deriveHole(entry(1, { score: 4, putts: 2, teeOutOfPosition: true }), 4).outOfPosition).toBe(true)
    expect(deriveHole(entry(1, { score: 4, putts: 2 }), 4).outOfPosition).toBe(false)
    // par 3 is not a driving hole
    expect(deriveHole(entry(1, { score: 3, putts: 2, teeOutOfPosition: true }), 3).outOfPosition).toBeNull()
    // picked up is not counted
    expect(deriveHole(entry(1, { score: 8, pickedUp: true, teeOutOfPosition: true }), 4).outOfPosition).toBeNull()
  })
})

describe('roundStats out-of-position counting', () => {
  const round: Round = {
    date: '2026-07-06',
    courseId: 'test',
    teeName: 'Yellow',
    playingHandicap: 0,
    startingHole: 1,
    status: 'complete',
    holes: [
      entry(1, { score: 4, putts: 2, teeResult: 'left', teeOutOfPosition: true }), // par 4, OOP
      entry(2, { score: 6, putts: 2, teeOutOfPosition: true }), // par 5, OOP
      entry(3, { score: 3, putts: 2, teeOutOfPosition: true }), // par 3, ignored
      entry(4, { score: 8, putts: 2, pickedUp: true, teeOutOfPosition: true }), // picked up, ignored
      ...Array.from({ length: 14 }, (_, i) => entry(i + 5, { score: course.holes[i + 4].par, putts: 2 })),
    ],
  }
  it('counts OOP only on counted driving holes', () => {
    const s = roundStats(round, course)
    expect(s.outOfPosition).toBe(2)
    // driving holes among counted: holes 1(4),2(5),5(3→no),... — count par 4/5 that were scored & not picked up
    const expectedDriving = round.holes.filter(
      (h, i) => h.score != null && !h.pickedUp && course.holes[i].par >= 4,
    ).length
    expect(s.drivingHoles).toBe(expectedDriving)
  })
})

describe('roundTotals / roundStats on a hand-computed 18-hole card', () => {
  // Playing handicap 18 → 1 stroke on every hole. Course: holes cycle par 4,5,3.
  // Player shoots bogey golf with 2 putts everywhere → net par → 2 points/hole = 36 points.
  const round: Round = {
    date: '2026-07-06',
    courseId: 'test',
    teeName: 'Yellow',
    playingHandicap: 18,
    startingHole: 1,
    status: 'complete',
    holes: Array.from({ length: 18 }, (_, i) =>
      entry(i + 1, {
        score: course.holes[i].par + 1,
        putts: 2,
        teeResult: course.holes[i].par >= 4 ? 'fairway' : 'na',
      }),
    ),
  }
  it('totals: gross 90, +18, 36 points, 36 putts', () => {
    const t = roundTotals(round, course)
    expect(t.holesEntered).toBe(18)
    expect(t.gross).toBe(90)
    expect(t.toPar).toBe(18)
    expect(t.points).toBe(36)
    expect(t.putts).toBe(36)
  })
  it('stats: 0 GIR (bogey with 2 putts misses regulation), 100% FIR, no 3-putts', () => {
    const s = roundStats(round, course)
    expect(s.holes).toBe(18)
    expect(s.girCount).toBe(0)
    expect(s.girEligible).toBe(18)
    expect(s.firCount).toBe(12)
    expect(s.firEligible).toBe(12)
    expect(s.threePutts).toBe(0)
    expect(s.blowUps).toBe(0)
    expect(s.drivingHoles).toBe(12)
    expect(s.outOfPosition).toBe(0)
    expect(s.distribution.bogey).toBe(18)
    // scramble: missed every green, never saved par
    expect(s.scrambleChances).toBe(18)
    expect(s.scrambleSuccesses).toBe(0)
    expect(s.byPar[4].avgToPar).toBe(1)
  })
})

describe('scoringDifferential', () => {
  it('normalises gross by CR/slope', () => {
    const tee = course.tees[0] // CR 70, slope 120
    expect(scoringDifferential(88, tee)).toBeCloseTo(((88 - 70) * 113) / 120, 5)
  })
  it('is null without CR/slope', () => {
    expect(scoringDifferential(88, undefined)).toBeNull()
    expect(scoringDifferential(88, { ...course.tees[0], courseRating: null })).toBeNull()
  })
})

describe('aggregate: errors, differential and series', () => {
  function allPars(patch: (h: number) => Partial<HoleEntry> = () => ({})): HoleEntry[] {
    return course.holes.map((info) => entry(info.number, { score: info.par, putts: 2, teeResult: info.par >= 4 ? 'fairway' : 'na', ...patch(info.number) }))
  }
  const clean: Round = { date: '2026-01-01', courseId: 'test', teeName: 'Yellow', playingHandicap: 0, startingHole: 1, status: 'complete', holes: allPars() }
  const messy: Round = {
    date: '2026-02-01', courseId: 'test', teeName: 'Yellow', playingHandicap: 0, startingHole: 1, status: 'complete',
    holes: allPars((h) => (h === 1 ? { penalties: 1 } : h === 2 ? { putts: 3 } : h === 4 ? { teeOutOfPosition: true } : {})),
  }

  it('errorsPerRound = penalties + 3-putts + out-of-position, averaged', () => {
    const agg = aggregate([messy, clean], new Map([['test', course]]))!
    expect(agg.errorsPerRound).toBe(1.5) // (0 + 3) / 2
    expect(agg.series.errors).toEqual([0, 3]) // chronological: clean then messy
  })
  it('computes average differential from CR/slope (both rounds gross 72)', () => {
    const agg = aggregate([messy, clean], new Map([['test', course]]))!
    expect(agg.avgDifferential).toBeCloseTo(((72 - 70) * 113) / 120, 5)
    expect(agg.series.differential).toHaveLength(2)
  })
})

describe('focusAreas', () => {
  function makeAgg(partial: Partial<AggregateStats>): AggregateStats {
    const emptySeries = { points: [], putts: [], gir: [], fir: [], errors: [], threePutts: [], penalties: [], scrambling: [], differential: [] }
    return {
      rounds: 6, avgGross: 90, avgToPar: 18, avgPoints: 34, avgPutts: 34,
      girPct: 28, firPct: 52, scramblePct: 22, outOfPositionPerRound: 0, outOfPositionPct: 0,
      threePuttsPerRound: 3, blowUpsPerRound: 0, penaltiesPerRound: 3, errorsPerRound: 0, avgDifferential: null,
      avgToParByPar: { 3: null, 4: null, 5: null }, series: emptySeries,
      ...partial,
    }
  }

  it('ranks the metrics furthest behind the handicap target, most severe first', () => {
    const agg = makeAgg({
      girPct: 30, firPct: 55, scramblePct: 25, // meeting/beating targets → excluded
      avgPutts: 37, threePuttsPerRound: 4.5, penaltiesPerRound: 5, // behind targets 34 / 3 / 3
    })
    const focus = focusAreas(agg, 15)
    // severities: penalties (2/3=.67) > threePutts (1.5/3=.5) > putts (3/34=.09)
    expect(focus.map((f) => f.key)).toEqual(['penalties', 'threePutts', 'putts'])
  })
  it('flags a metric that is also trending the wrong way', () => {
    const agg = makeAgg({
      penaltiesPerRound: 5,
      series: { points: [], putts: [], gir: [], fir: [], errors: [], threePutts: [], penalties: [2, 2, 4, 4, 6, 6], scrambling: [], differential: [] },
    })
    const pen = focusAreas(agg, 15).find((f) => f.key === 'penalties')!
    expect(pen.trendingWrongWay).toBe(true) // penalties rising = worse
  })
  it('returns nothing when everything beats target', () => {
    const agg = makeAgg({ girPct: 60, firPct: 70, scramblePct: 45, avgPutts: 28, threePuttsPerRound: 0.5, penaltiesPerRound: 0.5 })
    expect(focusAreas(agg, 15)).toHaveLength(0)
  })
})

describe('distanceStats', () => {
  const round: Round = {
    date: '2026-03-01', courseId: 'test', teeName: 'Yellow', playingHandicap: 0, startingHole: 1, status: 'complete',
    holes: [
      entry(1, { score: 4, putts: 2, approachBucket: 'b110_160', firstPuttBucket: 'b2_4' }), // par4 GIR
      entry(2, { score: 7, putts: 3, approachBucket: 'b110_160', firstPuttBucket: 'b4_9' }), // par5 no GIR, 3-putt
      entry(3, { score: 2, putts: 1, approachBucket: 'lt70', firstPuttBucket: 'lt2' }), // par3 GIR, 1-putt
      ...Array.from({ length: 15 }, (_, i) => entry(i + 4, {})),
    ],
  }
  const stats = distanceStats([round], new Map([['test', course]]))

  it('tallies greens-hit by approach band', () => {
    expect(stats.approach.b110_160.holes).toBe(2)
    expect(stats.approach.b110_160.gir).toBe(1) // hole 1 yes, hole 2 no
    expect(stats.approach.lt70.gir).toBe(1)
    expect(stats.approachHoles).toBe(3)
  })
  it('tallies putting by first-putt band', () => {
    expect(stats.putting.lt2.onePutt).toBe(1)
    expect(stats.putting.b4_9.threePutt).toBe(1)
    expect(stats.putting.b2_4.totalPutts).toBe(2)
    expect(stats.puttingHoles).toBe(3)
  })
})

describe('trends', () => {
  it('rollingAvg trails over the window', () => {
    expect(rollingAvg([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5])
  })
  it('direction detects up/down/flat and null below minimum', () => {
    expect(direction([1, 2, 3, 4, 5, 6])).toBe('up')
    expect(direction([6, 5, 4, 3])).toBe('down')
    expect(direction([1, 1, 1, 1])).toBe('flat')
    expect(direction([1, 2])).toBeNull()
  })
})

describe('holePlayOrder', () => {
  it('starts at 1 by default order', () => {
    expect(holePlayOrder(1)[0]).toBe(1)
    expect(holePlayOrder(1)[17]).toBe(18)
  })
  it('wraps around from 10', () => {
    const order = holePlayOrder(10)
    expect(order[0]).toBe(10)
    expect(order[8]).toBe(18)
    expect(order[9]).toBe(1)
    expect(order[17]).toBe(9)
  })
  it('wraps around from 18', () => {
    const order = holePlayOrder(18)
    expect(order[0]).toBe(18)
    expect(order[1]).toBe(1)
    expect(order[17]).toBe(17)
  })
  it('wraps around from an arbitrary hole (7)', () => {
    const order = holePlayOrder(7)
    expect(order[0]).toBe(7)
    expect(order[11]).toBe(18)
    expect(order[12]).toBe(1)
    expect(order[17]).toBe(6)
    // still a permutation of 1..18
    expect(new Set(order).size).toBe(18)
  })
})
