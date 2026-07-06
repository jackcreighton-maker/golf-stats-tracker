import { describe, expect, it } from 'vitest'
import { netScore, roundTotals, stablefordPoints, strokesReceived } from './scoring'
import { deriveHole, roundStats } from './derived'
import { holeSG, roundSG } from './strokesGained'
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
  tees: [],
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
    expect(s.distribution.bogey).toBe(18)
    // scramble: missed every green, never saved par
    expect(s.scrambleChances).toBe(18)
    expect(s.scrambleSuccesses).toBe(0)
    expect(s.byPar[4].avgToPar).toBe(1)
  })
})

describe('strokes gained approximation', () => {
  it('putting: one-putt from 2-4 m gains, three-putt from <2 m loses', () => {
    const onePutt = holeSG(entry(1, { score: 4, putts: 1, firstPuttBucket: 'b2_4' }), 4)
    expect(onePutt.putting).toBeCloseTo(0.65, 5) // 1.65 - 1
    const threePutt = holeSG(entry(1, { score: 6, putts: 3, firstPuttBucket: 'lt2' }), 4)
    expect(threePutt.putting).toBeCloseTo(-1.85, 5) // 1.15 - 3
  })
  it('clean GIR hole attributes segment to approach with zero short game', () => {
    // Par 4, score 4, 2 putts, approach 110-160, first putt 4-9 m.
    // shotsBetween = 4 - 1 - 2 = 1 → approach = 3.0 - 1 - 1.92 = 0.08
    const sg = holeSG(entry(1, { score: 4, putts: 2, approachBucket: 'b110_160', firstPuttBucket: 'b4_9', teeResult: 'fairway' }), 4)
    expect(sg.approach).toBeCloseTo(0.08, 5)
    expect(sg.shortGame).toBe(0)
    expect(sg.tee).toBeCloseTo(0.1, 5)
  })
  it('missed green splits segment into approach and short game', () => {
    // Par 4, score 5, 2 putts → shotsBetween = 2 (approach + chip)
    const sg = holeSG(entry(1, { score: 5, putts: 2, approachBucket: 'b110_160', firstPuttBucket: 'lt2' }), 4)
    // approach = 3.0 - 1 - 2.5 = -0.5; segment = 3.0 - 2 - 1.15 = -0.15; shortGame = -0.15 - (-0.5) = 0.35
    expect(sg.approach).toBeCloseTo(-0.5, 5)
    expect(sg.shortGame).toBeCloseTo(0.35, 5)
  })
  it('returns nulls when optional inputs are missing', () => {
    const sg = holeSG(entry(1, { score: 4, putts: 2 }), 4)
    expect(sg.approach).toBeNull()
    expect(sg.putting).toBeNull()
    expect(sg.tee).toBeNull()
  })
  it('zero-putt holes (holed from off the green) do not produce putting SG', () => {
    const sg = holeSG(entry(1, { score: 3, putts: 0, firstPuttBucket: 'lt2' }), 4)
    expect(sg.putting).toBeNull()
  })
  it('roundSG aggregates only holes with data', () => {
    const round: Round = {
      date: '2026-07-06',
      courseId: 'test',
      teeName: 'Yellow',
      playingHandicap: 18,
      startingHole: 1,
      status: 'complete',
      holes: [
        entry(1, { score: 4, putts: 2, firstPuttBucket: 'b2_4' }),
        entry(2, { score: 5, putts: 2 }),
        ...Array.from({ length: 16 }, (_, i) => entry(i + 3, {})),
      ],
    }
    const sg = roundSG(round, course)
    expect(sg.putting?.holes).toBe(1)
    expect(sg.putting?.value).toBeCloseTo(-0.35, 5) // 1.65 - 2
    expect(sg.approach).toBeNull()
    expect(sg.vsBenchmark).not.toBeNull()
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
})
