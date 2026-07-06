import { useLiveQuery } from 'dexie-react-hooks'
import db from './db'
import { SEED_COURSES } from './data/courses'
import type { Course } from './types'

/**
 * All courses available in the app: bundled seed data plus custom courses from
 * IndexedDB. A custom course with the same id as a seed course overrides it
 * (that's how in-app edits to seeded data are stored).
 */
export function useCourses(): Course[] | undefined {
  return useLiveQuery(async () => {
    const custom = await db.customCourses.toArray()
    const byId = new Map<string, Course>()
    for (const c of SEED_COURSES) byId.set(c.id, c)
    for (const c of custom) byId.set(c.id, { ...c, custom: true })
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [])
}

export async function getCourse(id: string): Promise<Course | undefined> {
  const custom = await db.customCourses.get(id)
  if (custom) return { ...custom, custom: true }
  return SEED_COURSES.find((c) => c.id === id)
}

export function useCourse(id: string | null): Course | undefined {
  return useLiveQuery(async () => (id ? getCourse(id) : undefined), [id])
}
