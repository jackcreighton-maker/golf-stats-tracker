import db from '../db'
import { emptyHoleEntry, type ApproachBucket, type HoleEntry, type PuttBucket, type Round, type TeeResult } from '../types'
import { SEED_COURSES } from './courses'

// Deterministic sample rounds for previewing the Stats screen.
// Every round is flagged { demo: true } so it can be removed without touching real rounds.

/** Small deterministic PRNG so the sample looks the same each time it's loaded. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((s, [, w]) => s + Math.max(0, w), 0)
  let r = rng() * total
  for (const [v, w] of weighted) {
    r -= Math.max(0, w)
    if (r < 0) return v
  }
  return weighted[weighted.length - 1][0]
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

interface CoursePlan {
  courseId: string
  count: number
  handicap: number
}

// Aguilón is the home course, so it appears most. Uses whatever courses are seeded;
// missing ids are skipped gracefully.
const PLAN: CoursePlan[] = [
  { courseId: 'aguilon-golf', count: 8, handicap: 16 },
  { courseId: 'altorreal', count: 4, handicap: 15 },
  { courseId: 'desert-springs-indiana', count: 4, handicap: 16 },
]

function preferredTee(tees: { name: string; gender: string }[]): string {
  return (
    tees.find((t) => t.gender === 'male' && /amaril|yellow|gold/i.test(t.name))?.name ??
    tees.find((t) => t.gender === 'male')?.name ??
    tees[0]?.name ??
    ''
  )
}

export function buildSampleRounds(): Round[] {
  // Flatten the plan into a schedule, then shuffle deterministically so courses interleave.
  const schedule: { courseId: string; handicap: number }[] = []
  for (const p of PLAN) for (let i = 0; i < p.count; i++) schedule.push({ courseId: p.courseId, handicap: p.handicap })
  const shuffleRng = mulberry32(20260707)
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(shuffleRng() * (i + 1))
    ;[schedule[i], schedule[j]] = [schedule[j], schedule[i]]
  }

  const n = schedule.length
  const rounds: Round[] = []

  schedule.forEach((slot, idx) => {
    const course = SEED_COURSES.find((c) => c.id === slot.courseId)
    if (!course) return
    // idx 0 = oldest, n-1 = newest → skill ramps up so trends show improvement.
    const skill = n > 1 ? idx / (n - 1) : 0.5
    const rng = mulberry32(1000 + idx * 97)

    const holes: HoleEntry[] = course.holes.map((info) => {
      const e = emptyHoleEntry(info.number)
      const p = info.par

      // 1) First-putt distance band → number of putts. Short putts mostly holed; long putts risk 3-putts.
      const puttBand = pick<PuttBucket>(rng, [['lt2', 0.22], ['b2_4', 0.33], ['b4_9', 0.3], ['gt9', 0.15]])
      const puttOutcomes: Record<PuttBucket, [number, number][]> = {
        lt2: [[1, 0.72 + 0.05 * skill], [2, 0.27], [3, 0.01]],
        b2_4: [[1, 0.32 + 0.05 * skill], [2, 0.63], [3, 0.05]],
        b4_9: [[1, 0.12 + 0.04 * skill], [2, 0.73], [3, 0.15]],
        gt9: [[1, 0.04 + 0.02 * skill], [2, 0.72], [3, 0.24]],
      }
      const putts = pick<number>(rng, puttOutcomes[puttBand])
      e.putts = putts

      // 2) Green in regulation? Better players hit more; par 5s a touch harder, par 3s a touch easier.
      const girProb = Math.max(0.05, Math.min(0.7, 0.16 + 0.3 * skill - (p === 5 ? 0.05 : 0) + (p === 3 ? 0.03 : 0)))
      const gir = rng() < girProb

      // 3) Approach distance band — biased shorter on GIR holes, longer on misses.
      const approachBase: Record<number, [ApproachBucket, number][]> = {
        3: [['lt70', 0.45], ['b70_110', 0.4], ['b110_160', 0.15], ['gt160', 0.02]],
        4: [['lt70', 0.15], ['b70_110', 0.4], ['b110_160', 0.3], ['gt160', 0.15]],
        5: [['lt70', 0.1], ['b70_110', 0.25], ['b110_160', 0.3], ['gt160', 0.35]],
      }
      const approachBand = pick<ApproachBucket>(
        rng,
        (approachBase[p] ?? approachBase[4]).map(([b, w]) => {
          const short = b === 'lt70' || b === 'b70_110'
          return [b, w * (gir ? (short ? 1.7 : 0.6) : short ? 0.6 : 1.7)] as [ApproachBucket, number]
        }),
      )

      // 4) Penalty, strokes to reach the green, and final score — kept consistent with GIR + putts.
      const penalty = rng() < 0.05 + (gir ? 0 : 0.05)
      const missBy = gir ? 0 : pick<number>(rng, [[1, 0.55], [2, Math.max(0.05, 0.3 - 0.1 * skill)], [3, Math.max(0.03, 0.15 - 0.05 * skill)]])
      const reached = p - 2 + missBy + (penalty ? 1 : 0)
      let score = Math.max(1, reached + putts)
      if (penalty) e.penalties = 1

      // 5) Tee shot on par 4/5 ('penalty' marker only when a penalty stroke was actually taken).
      if (p >= 4) {
        if (penalty && rng() < 0.6) e.teeResult = 'penalty'
        else e.teeResult = pick<TeeResult>(rng, [['fairway', 0.48 + 0.15 * skill], ['left', 0.24], ['right', 0.22]])
        const oopProb = e.teeResult === 'fairway' ? 0.05 : e.teeResult === 'penalty' ? 0.7 : 0.35
        if (rng() < oopProb) e.teeOutOfPosition = true
      }

      if (rng() < 0.12) e.bunker = true

      // 6) Rare pick-up on a blow-up (exercises the picked-up path).
      if (score >= p + 4 && rng() < 0.2) {
        e.pickedUp = true
        score = p + 4
      }
      e.score = score

      // 7) Expose the optional distance inputs ~85% of the time (some left blank on purpose).
      if (rng() < 0.85) e.approachBucket = approachBand
      if (!e.pickedUp && rng() < 0.85) e.firstPuttBucket = puttBand

      return e
    })

    rounds.push({
      date: isoDaysAgo((n - 1 - idx) * 9 + 2),
      courseId: course.id,
      teeName: preferredTee(course.tees),
      playingHandicap: slot.handicap,
      startingHole: 1,
      holes,
      status: 'complete',
      demo: true,
    })
  })

  return rounds
}

/** Replace any existing sample rounds with a fresh set. Returns how many were loaded. */
export async function loadSampleData(): Promise<number> {
  await clearSampleData()
  const rounds = buildSampleRounds()
  await db.rounds.bulkAdd(rounds)
  return rounds.length
}

/** Delete only demo rounds. Returns how many were removed. */
export async function clearSampleData(): Promise<number> {
  const ids = await db.rounds.filter((r) => r.demo === true).primaryKeys()
  await db.rounds.bulkDelete(ids as number[])
  return ids.length
}
