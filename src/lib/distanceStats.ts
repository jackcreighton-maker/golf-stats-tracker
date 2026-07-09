import type { ApproachBucket, Course, PuttBucket, Round } from '../types'
import { deriveHole } from './derived'
import { APPROACH_BUCKETS, PUTT_BUCKETS } from './buckets'

// Repurposes the optional per-hole distance inputs (no strokes gained):
//  - putting performance by first-putt distance band
//  - green-hit (GIR) rate by approach distance band

export interface PuttBand {
  holes: number
  onePutt: number
  threePutt: number
  totalPutts: number
}

export interface ApproachBand {
  holes: number
  gir: number
}

export interface DistanceStats {
  putting: Record<PuttBucket, PuttBand>
  approach: Record<ApproachBucket, ApproachBand>
  puttingHoles: number
  approachHoles: number
}

function emptyPutt(): PuttBand {
  return { holes: 0, onePutt: 0, threePutt: 0, totalPutts: 0 }
}

export function distanceStats(rounds: Round[], courses: Map<string, Course>): DistanceStats {
  const putting = Object.fromEntries(PUTT_BUCKETS.map((b) => [b, emptyPutt()])) as Record<PuttBucket, PuttBand>
  const approach = Object.fromEntries(APPROACH_BUCKETS.map((b) => [b, { holes: 0, gir: 0 }])) as Record<
    ApproachBucket,
    ApproachBand
  >
  let puttingHoles = 0
  let approachHoles = 0

  for (const r of rounds) {
    const course = courses.get(r.courseId)
    if (!course) continue
    for (const entry of r.holes) {
      const info = course.holes[entry.hole - 1]
      if (!info) continue
      const counted = entry.score != null && !entry.pickedUp

      if (counted && entry.putts != null && entry.firstPuttBucket) {
        const band = putting[entry.firstPuttBucket]
        band.holes++
        band.totalPutts += entry.putts
        if (entry.putts === 1) band.onePutt++
        if (entry.putts >= 3) band.threePutt++
        puttingHoles++
      }

      if (counted && entry.approachBucket) {
        const gir = deriveHole(entry, info.par).gir
        if (gir != null) {
          const band = approach[entry.approachBucket]
          band.holes++
          if (gir) band.gir++
          approachHoles++
        }
      }
    }
  }

  return { putting, approach, puttingHoles, approachHoles }
}
