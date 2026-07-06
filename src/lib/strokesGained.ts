import type { ApproachBucket, Course, HoleEntry, PuttBucket, Round } from '../types'

/**
 * Strokes-gained APPROXIMATION from per-hole bucket inputs (no shot GPS).
 *
 * Method (Broadie): SG of a segment = E[strokes from start position] - actual strokes used
 * to reach the end position - E[strokes from end position]. We use a scratch-ish benchmark,
 * PGA-tour-derived tables lightly adjusted, evaluated at bucket midpoints. Positive = better
 * than the benchmark golfer.
 *
 * Segments per hole:
 *   putting   = E[first putt distance] - putts                       (needs firstPuttBucket + putts)
 *   tee       = fixed adjustment from tee result on par 4/5          (needs teeResult)
 *   approach  = E[approach distance] - shotsBetween - E[first putt]  (needs approachBucket + firstPuttBucket + putts)
 *               where shotsBetween = strokes from the approach position until the ball is on
 *               the green, assuming the approach was hit as the regulation shot
 *               (shot 1 on par 3, shot 2 on par 4, shot 3 on par 5).
 *   If shotsBetween > 1 the segment includes recovery/short-game shots; we attribute one
 *   benchmark approach shot to "approach" and the remainder to "short game".
 *
 * All values are approximations for trend-tracking, not tour-accurate accounting.
 */

/** E[strokes to hole out] from first-putt distance, by bucket midpoint (Broadie putting benchmark). */
const PUTT_EXPECTED: Record<PuttBucket, number> = {
  lt2: 1.15, // ~1.2 m (4 ft)
  b2_4: 1.65, // ~3 m (10 ft)
  b4_9: 1.92, // ~6.5 m (21 ft)
  gt9: 2.1, // ~12 m (39 ft)
}

/** E[strokes to hole out] from approach distance (fairway lie assumed), by bucket midpoint. */
const APPROACH_EXPECTED: Record<ApproachBucket, number> = {
  lt70: 2.7, // ~55 m
  b70_110: 2.85, // ~90 m
  b110_160: 3.0, // ~135 m
  gt160: 3.25, // ~185 m
}

/** E[strokes to hole out] for a greenside/short-game shot the benchmark golfer faces. */
const SHORT_GAME_EXPECTED = 2.5

/**
 * Tee-shot adjustment vs an average benchmark tee shot on par 4/5.
 * Rough Broadie-style costs: rough ≈ -0.25, penalty ≈ -1.05 vs fairway; centered so fairway is a small gain.
 */
const TEE_ADJUSTMENT: Record<string, number> = {
  fairway: 0.1,
  left: -0.15,
  right: -0.15,
  penalty: -0.95,
}

/** Benchmark (scratch-ish) expected score by par. */
const BENCH_SCORE: Record<number, number> = { 3: 3.1, 4: 4.05, 5: 4.85 }

export interface HoleSG {
  putting: number | null
  tee: number | null
  approach: number | null
  shortGame: number | null
  /** Sum of available segments (not a full-hole total unless all segments present) */
  total: number | null
}

export function holeSG(entry: HoleEntry, par: number): HoleSG {
  const none: HoleSG = { putting: null, tee: null, approach: null, shortGame: null, total: null }
  if (entry.score == null || entry.pickedUp) return none

  let putting: number | null = null
  if (entry.firstPuttBucket && entry.putts != null && entry.putts > 0) {
    putting = PUTT_EXPECTED[entry.firstPuttBucket] - entry.putts
  }

  let tee: number | null = null
  if (par >= 4 && entry.teeResult !== 'na') {
    tee = TEE_ADJUSTMENT[entry.teeResult] ?? null
  }

  let approach: number | null = null
  let shortGame: number | null = null
  if (entry.approachBucket && entry.firstPuttBucket && entry.putts != null && entry.putts > 0) {
    const regulationShotsBefore = par - 3 // shots taken before the approach, if played in regulation
    // strokes used from the approach position until the ball is on the green
    const shotsBetween = entry.score - regulationShotsBefore - entry.putts
    if (shotsBetween >= 1) {
      const segmentSG =
        APPROACH_EXPECTED[entry.approachBucket] - shotsBetween - PUTT_EXPECTED[entry.firstPuttBucket]
      if (shotsBetween === 1) {
        approach = segmentSG
        shortGame = 0
      } else {
        // One benchmark approach shot ends at a generic short-game position; the rest is short game.
        approach = APPROACH_EXPECTED[entry.approachBucket] - 1 - SHORT_GAME_EXPECTED
        shortGame = segmentSG - approach
      }
    }
  }

  const parts = [putting, tee, approach, shortGame].filter((v): v is number => v != null)
  return { putting, tee, approach, shortGame, total: parts.length ? parts.reduce((a, b) => a + b, 0) : null }
}

export interface RoundSG {
  putting: { value: number; holes: number } | null
  tee: { value: number; holes: number } | null
  approach: { value: number; holes: number } | null
  shortGame: { value: number; holes: number } | null
  /** Whole-round gross vs the scratch-ish benchmark (independent of optional inputs) */
  vsBenchmark: number | null
}

export function roundSG(round: Round, course: Course): RoundSG {
  const acc = {
    putting: { value: 0, holes: 0 },
    tee: { value: 0, holes: 0 },
    approach: { value: 0, holes: 0 },
    shortGame: { value: 0, holes: 0 },
  }
  let bench = 0
  let benchHoles = 0

  for (const entry of round.holes) {
    const info = course.holes[entry.hole - 1]
    if (!info) continue
    const sg = holeSG(entry, info.par)
    for (const key of ['putting', 'tee', 'approach', 'shortGame'] as const) {
      const v = sg[key]
      if (v != null) {
        acc[key].value += v
        acc[key].holes++
      }
    }
    if (entry.score != null && !entry.pickedUp) {
      bench += (BENCH_SCORE[info.par] ?? info.par) - entry.score
      benchHoles++
    }
  }

  return {
    putting: acc.putting.holes ? acc.putting : null,
    tee: acc.tee.holes ? acc.tee : null,
    approach: acc.approach.holes ? acc.approach : null,
    shortGame: acc.shortGame.holes ? acc.shortGame : null,
    vsBenchmark: benchHoles ? bench : null,
  }
}

export const PUTT_BUCKET_LABELS: Record<PuttBucket, string> = {
  lt2: '<2 m',
  b2_4: '2–4 m',
  b4_9: '4–9 m',
  gt9: '9+ m',
}

export const APPROACH_BUCKET_LABELS: Record<ApproachBucket, string> = {
  lt70: '<70 m',
  b70_110: '70–110 m',
  b110_160: '110–160 m',
  gt160: '160+ m',
}
