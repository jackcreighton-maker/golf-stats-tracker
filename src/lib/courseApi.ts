import type { Course, Tee } from '../types'

/**
 * Optional lookup against golfcourseapi.com (free tier: 50 requests/day).
 * Results are drafts — the user must check them against the real scorecard.
 */

interface ApiHole {
  par?: number
  yardage?: number
  handicap?: number
}

interface ApiTee {
  tee_name?: string
  course_rating?: number
  slope_rating?: number
  total_yards?: number
  total_meters?: number
  par_total?: number
  holes?: ApiHole[]
}

interface ApiCourse {
  id: number
  club_name?: string
  course_name?: string
  location?: { address?: string; city?: string; country?: string }
  tees?: { male?: ApiTee[]; female?: ApiTee[] }
}

export async function searchCourses(query: string, apiKey: string): Promise<ApiCourse[]> {
  const res = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Key ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Course API error ${res.status}`)
  const data = await res.json()
  return data.courses ?? []
}

const YARDS_TO_METERS = 0.9144

function guessColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('black') || n.includes('negr')) return 'black'
  if (n.includes('white') || n.includes('blanc')) return 'white'
  if (n.includes('yellow') || n.includes('amarill')) return 'gold'
  if (n.includes('blue') || n.includes('azul')) return 'blue'
  if (n.includes('red') || n.includes('roj')) return 'red'
  return 'gray'
}

export function apiCourseToDraft(api: ApiCourse): Course | null {
  const allTees: { tee: ApiTee; gender: 'male' | 'female' }[] = [
    ...(api.tees?.male ?? []).map((tee) => ({ tee, gender: 'male' as const })),
    ...(api.tees?.female ?? []).map((tee) => ({ tee, gender: 'female' as const })),
  ]
  const withHoles = allTees.find(({ tee }) => tee.holes?.length === 18)
  if (!withHoles) return null

  const holes = withHoles.tee.holes!.map((h, i) => ({
    number: i + 1,
    par: h.par ?? 4,
    strokeIndex: h.handicap ?? i + 1,
  }))

  const tees: Tee[] = allTees
    .filter(({ tee }) => tee.tee_name)
    .map(({ tee, gender }) => ({
      name: tee.tee_name!,
      color: guessColor(tee.tee_name!),
      gender,
      courseRating: tee.course_rating ?? null,
      slope: tee.slope_rating ?? null,
      distances:
        tee.holes?.length === 18
          ? tee.holes.map((h) => (h.yardage ? Math.round(h.yardage * YARDS_TO_METERS) : 0))
          : null,
      totalMeters: tee.total_meters ?? (tee.total_yards ? Math.round(tee.total_yards * YARDS_TO_METERS) : null),
    }))

  const name = [api.club_name, api.course_name].filter(Boolean).join(' — ') || 'Unknown course'
  return {
    id: `api-${api.id}`,
    name,
    location: [api.location?.city, api.location?.country].filter(Boolean).join(', '),
    parTotal: holes.reduce((a, h) => a + h.par, 0),
    holes,
    tees,
    verified: false,
    notes: 'Imported from golfcourseapi.com — check against the official scorecard.',
    custom: true,
  }
}
