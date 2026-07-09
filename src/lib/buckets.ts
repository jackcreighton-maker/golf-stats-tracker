import type { ApproachBucket, PuttBucket } from '../types'

// Labels and representative distances for the optional per-hole distance inputs.
// (These used to live in strokesGained.ts; they now power the distance-breakdown stats.)

export const APPROACH_BUCKETS: ApproachBucket[] = ['lt70', 'b70_110', 'b110_160', 'gt160']
export const PUTT_BUCKETS: PuttBucket[] = ['lt2', 'b2_4', 'b4_9', 'gt9']

export const APPROACH_BUCKET_LABELS: Record<ApproachBucket, string> = {
  lt70: '<70 m',
  b70_110: '70–110 m',
  b110_160: '110–160 m',
  gt160: '160+ m',
}

export const PUTT_BUCKET_LABELS: Record<PuttBucket, string> = {
  lt2: '<2 m',
  b2_4: '2–4 m',
  b4_9: '4–9 m',
  gt9: '9+ m',
}
