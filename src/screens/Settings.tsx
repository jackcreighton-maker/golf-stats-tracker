import { useEffect, useRef, useState } from 'react'
import db, { getSettings, saveSettings } from '../db'
import type { Navigate } from '../App'
import type { Course, Round, Settings as SettingsType } from '../types'

interface Backup {
  app: 'golf-stats-tracker'
  version: 1
  exportedAt: string
  rounds: Round[]
  customCourses: Course[]
  settings: SettingsType
}

export default function Settings({ navigate: _navigate }: { navigate: Navigate }) {
  const [handicap, setHandicap] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSettings().then((s) => {
      setHandicap(s.handicapIndex != null ? String(s.handicapIndex) : '')
      setApiKey(s.golfCourseApiKey ?? '')
    })
  }, [])

  async function save() {
    await saveSettings({
      handicapIndex: handicap === '' ? null : Number(handicap),
      golfCourseApiKey: apiKey.trim() || undefined,
    })
    setMessage('Saved.')
    setTimeout(() => setMessage(null), 2000)
  }

  async function exportData() {
    const backup: Backup = {
      app: 'golf-stats-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      rounds: await db.rounds.toArray(),
      customCourses: await db.customCourses.toArray(),
      settings: await getSettings(),
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `golf-backup-${backup.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      const backup = JSON.parse(await file.text()) as Backup
      if (backup.app !== 'golf-stats-tracker' || !Array.isArray(backup.rounds)) {
        throw new Error('Not a valid backup file')
      }
      if (!window.confirm(`Import ${backup.rounds.length} rounds and ${backup.customCourses.length} custom courses from ${backup.exportedAt.slice(0, 10)}? Existing data with the same ids will be overwritten.`)) return
      await db.rounds.bulkPut(backup.rounds)
      await db.customCourses.bulkPut(backup.customCourses)
      if (backup.settings) await db.settings.put({ ...backup.settings, id: 'settings' })
      const s = await getSettings()
      setHandicap(s.handicapIndex != null ? String(s.handicapIndex) : '')
      setApiKey(s.golfCourseApiKey ?? '')
      setMessage('Import complete.')
    } catch (e) {
      setMessage(`Import failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }

  return (
    <div className="screen">
      <div className="topbar"><h1>Settings</h1></div>

      {message && <div className="card" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>{message}</div>}

      <div className="card">
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Handicap index <span className="hint">(your official RFEG index — used to prefill playing handicap)</span></label>
          <input type="number" step="0.1" inputMode="decimal" value={handicap} onChange={(e) => setHandicap(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>golfcourseapi.com key <span className="hint">(optional, for course lookup — free at golfcourseapi.com)</span></label>
          <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={save}>Save</button>
      </div>

      <div className="card">
        <h2>Backup</h2>
        <p className="muted small" style={{ marginBottom: 10 }}>
          Your rounds live only on this phone. Export a backup now and then, and keep the file somewhere safe (Drive, email…).
        </p>
        <button className="btn btn-secondary btn-block" style={{ marginBottom: 8 }} onClick={exportData}>
          ⬇ Export backup (.json)
        </button>
        <button className="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>
          ⬆ Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '' }}
        />
      </div>

      <div className="card muted small">
        Golf Stats Tracker · personal build · data stays on-device
      </div>
    </div>
  )
}
