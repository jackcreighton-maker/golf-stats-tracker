// Domain types for the golf stats tracker.

export interface HoleInfo {
  number: number
  par: number
  /** Stroke index ("hcp" column on Spanish scorecards), 1–18 */
  strokeIndex: number
}

export interface Tee {
  name: string
  /** CSS-friendly color for the tee marker, e.g. "white", "yellow", "#c00" */
  color: string
  gender: 'male' | 'female'
  /** RFEG course rating; null when not published */
  courseRating: number | null
  /** RFEG slope rating; null when not published */
  slope: number | null
  /** Per-hole distances in meters (18 values); null when only totals are known */
  distances: number[] | null
  totalMeters: number | null
}

export interface Course {
  id: string
  name: string
  location: string
  parTotal: number
  holes: HoleInfo[]
  tees: Tee[]
  /** true = cross-checked against the official scorecard */
  verified: boolean
  sources?: string[]
  notes?: string
  /** true when created/edited in-app (stored in IndexedDB, not the bundle) */
  custom?: boolean
}

export type TeeResult = 'fairway' | 'left' | 'right' | 'penalty' | 'na'

/** Approach distance buckets, meters */
export type ApproachBucket = 'lt70' | 'b70_110' | 'b110_160' | 'gt160'

/** First-putt distance buckets, meters */
export type PuttBucket = 'lt2' | 'b2_4' | 'b4_9' | 'gt9'

export interface HoleEntry {
  /** Course hole number 1–18 */
  hole: number
  /** Gross strokes incl. penalties; null = not yet entered */
  score: number | null
  putts: number | null
  /** Only meaningful on par 4/5; 'na' = didn't record */
  teeResult: TeeResult
  /** Tee shot left you unable to play a normal next shot (par 4/5 only) */
  teeOutOfPosition?: boolean
  penalties: number
  /** Ball was in a bunker at some point on this hole */
  bunker: boolean
  approachBucket?: ApproachBucket
  firstPuttBucket?: PuttBucket
  /** Picked up without holing out — excluded from most stats, 0 Stableford points */
  pickedUp?: boolean
}

/** The hole a round is started from, 1–18 (wraps around from there). */
export type StartingHole = number

export interface Round {
  id?: number
  /** ISO date, e.g. "2026-07-06" */
  date: string
  courseId: string
  teeName: string
  playingHandicap: number
  startingHole: StartingHole
  /** Always length 18, indexed by course hole number - 1 (holes[0] = hole 1) */
  holes: HoleEntry[]
  notes?: string
  status: 'active' | 'complete'
  /** true = generated sample data (removable in one tap; never mixed with real rounds) */
  demo?: boolean
}

export interface Settings {
  id: string
  handicapIndex: number | null
  golfCourseApiKey?: string
}

export function emptyHoleEntry(hole: number): HoleEntry {
  return { hole, score: null, putts: null, teeResult: 'na', penalties: 0, bunker: false }
}

/** Play order for a round: wraps around from the starting hole (e.g. 10 → ... → 18 → 1 → ... → 9) */
export function holePlayOrder(startingHole: StartingHole): number[] {
  return Array.from({ length: 18 }, (_, i) => ((startingHole - 1 + i) % 18) + 1)
}
