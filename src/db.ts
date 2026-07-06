import Dexie, { type EntityTable } from 'dexie'
import type { Course, Round, Settings } from './types'

const db = new Dexie('golf-stats-tracker') as Dexie & {
  rounds: EntityTable<Round, 'id'>
  customCourses: EntityTable<Course, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  rounds: '++id, date, courseId, status',
  customCourses: 'id, name',
  settings: 'id',
})

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? { id: 'settings', handicapIndex: null }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'settings' })
}

/** Ask the browser to protect IndexedDB from eviction (best effort). */
export function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => {})
}

export default db
