import type { Course, Tee } from '../types'

export function emptyCourse(): Course {
  return {
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    location: '',
    parTotal: 72,
    holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 })),
    tees: [emptyTee('Amarillas', 'gold', 'male')],
    verified: false,
    custom: true,
  }
}

export function emptyTee(name: string, color: string, gender: 'male' | 'female'): Tee {
  return { name, color, gender, courseRating: null, slope: null, distances: Array(18).fill(0), totalMeters: null }
}

/** Recompute derivable totals after an edit. */
export function normalizeCourse(course: Course): Course {
  return {
    ...course,
    parTotal: course.holes.reduce((a, h) => a + h.par, 0),
    tees: course.tees.map((t) => ({
      ...t,
      totalMeters: t.distances?.some((d) => d > 0) ? t.distances.reduce((a, d) => a + d, 0) : t.totalMeters,
    })),
  }
}

export function validateCourse(course: Course): string | null {
  if (!course.name.trim()) return 'Course name is required.'
  if (course.holes.length !== 18) return 'A course needs 18 holes.'
  const siSeen = new Set<number>()
  for (const h of course.holes) {
    if (h.par < 3 || h.par > 6) return `Hole ${h.number}: par must be 3–6.`
    if (h.strokeIndex < 1 || h.strokeIndex > 18) return `Hole ${h.number}: stroke index must be 1–18.`
    if (siSeen.has(h.strokeIndex)) return `Stroke index ${h.strokeIndex} is used twice.`
    siSeen.add(h.strokeIndex)
  }
  if (course.tees.length === 0) return 'Add at least one tee.'
  return null
}
