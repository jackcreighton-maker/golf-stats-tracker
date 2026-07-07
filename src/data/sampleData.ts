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

      const outcome = pick<number>(rng, [
        [-1, 0.03 + 0.06 * skill], // birdie
        [0, 0.24 + 0.16 * skill], // par
        [1, 0.4], // bogey
        [2, 0.22 - 0.1 * skill], // double
        [3, 0.11 - 0.06 * skill], // triple or worse
      ])
      e.score = Math.max(1, info.par + outcome)

      // Rare pick-up on a blow-up hole (exercises the picked-up path).
      if (outcome >= 3 && rng() < 0.2) {
        e.pickedUp = true
        e.score = info.par + 4
      }

      let putts = pick<number>(rng, [
        [1, 0.18 + 0.07 * skill],
        [2, 0.62],
        [3, 0.2 - 0.07 * skill],
      ])
      putts = Math.min(putts, Math.max(1, e.score - 1))
      e.putts = putts

      if (info.par >= 4) {
        const tr = pick<TeeResult>(rng, [
          ['fairway', 0.45 + 0.15 * skill],
          ['left', 0.22],
          ['right', 0.2],
          ['penalty', 0.06],
        ])
        e.teeResult = tr
        const oopProb = tr === 'fairway' ? 0.05 : tr === 'penalty' ? 0.7 : 0.35
        if (rng() < oopProb) e.teeOutOfPosition = true
      }

      if (rng() < 0.12) e.bunker = true
      if (e.teeResult === 'penalty') e.penalties = 1
      else if (rng() < 0.06) e.penalties = 1

      // Optional strokes-gained inputs on ~85% of holes (leave some blank to test graceful degradation).
      if (rng() < 0.85) {
        e.approachBucket =
          info.par >= 5
            ? pick<ApproachBucket>(rng, [['b70_110', 0.3], ['b110_160', 0.3], ['gt160', 0.4]])
            : info.par === 3
              ? pick<ApproachBucket>(rng, [['lt70', 0.3], ['b70_110', 0.4], ['b110_160', 0.3]])
              : pick<ApproachBucket>(rng, [['lt70', 0.2], ['b70_110', 0.35], ['b110_160', 0.3], ['gt160', 0.15]])
      }
      if (!e.pickedUp && putts > 0 && rng() < 0.85) {
        e.firstPuttBucket = pick<PuttBucket>(rng, [['lt2', 0.28], ['b2_4', 0.34], ['b4_9', 0.26], ['gt9', 0.12]])
      }

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
