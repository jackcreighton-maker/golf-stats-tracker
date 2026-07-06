import type { Course } from '../types'

// All JSON files in ./courses are bundled as seed data.
// Add a new course = drop a JSON file in that folder, no code changes.
const modules = import.meta.glob('./courses/*.json', { eager: true })

export const SEED_COURSES: Course[] = Object.values(modules)
  .map((m) => (m as { default: Course }).default)
  .sort((a, b) => a.name.localeCompare(b.name))
