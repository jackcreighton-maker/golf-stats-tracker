import { useState } from 'react'
import db, { getSettings } from '../db'
import { useCourses } from '../courseStore'
import { apiCourseToDraft, searchCourses } from '../lib/courseApi'
import { emptyCourse } from '../lib/courseEdit'
import type { Course } from '../types'
import type { Navigate } from '../App'
import CourseEditor from '../components/CourseEditor'

type Mode = { name: 'list' } | { name: 'view'; id: string } | { name: 'edit'; draft: Course } | { name: 'add' }

export default function Courses({ navigate: _navigate }: { navigate: Navigate }) {
  const courses = useCourses()
  const [mode, setMode] = useState<Mode>({ name: 'list' })
  const [search, setSearch] = useState('')
  const [apiQuery, setApiQuery] = useState('')
  const [apiResults, setApiResults] = useState<Course[] | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiBusy, setApiBusy] = useState(false)

  if (!courses) return <div className="screen" />

  async function saveCourse(course: Course) {
    await db.customCourses.put({ ...course, custom: true })
    setMode({ name: 'view', id: course.id })
  }

  async function runApiSearch() {
    setApiBusy(true)
    setApiError(null)
    setApiResults(null)
    try {
      const settings = await getSettings()
      if (!settings.golfCourseApiKey) {
        setApiError('No API key set. Add a free golfcourseapi.com key in Settings, or create the course manually below.')
        return
      }
      const results = await searchCourses(apiQuery, settings.golfCourseApiKey)
      const drafts = results.map(apiCourseToDraft).filter((c): c is Course => c != null)
      setApiResults(drafts)
      if (drafts.length === 0) setApiError('No usable results — create the course manually below.')
    } catch (e) {
      setApiError(`Lookup failed (${e instanceof Error ? e.message : 'error'}). Create the course manually below.`)
    } finally {
      setApiBusy(false)
    }
  }

  if (mode.name === 'edit') {
    return (
      <CourseEditor
        draft={mode.draft}
        onSave={saveCourse}
        onCancel={() => setMode({ name: 'list' })}
      />
    )
  }

  if (mode.name === 'view') {
    const course = courses.find((c) => c.id === mode.id)
    if (!course) { setMode({ name: 'list' }); return null }
    return (
      <div className="screen">
        <div className="topbar">
          <h1>{course.name}</h1>
          <button className="btn btn-secondary" onClick={() => setMode({ name: 'list' })}>Back</button>
        </div>
        <div className="card">
          <div className="muted small">{course.location} · Par {course.parTotal}</div>
          <div style={{ marginTop: 6 }}>
            {course.verified
              ? <span className="badge verified">verified</span>
              : <span className="badge draft">draft — check vs scorecard</span>}
            {course.custom && <span className="badge draft" style={{ marginLeft: 6 }}>edited</span>}
          </div>
          {course.notes && <div className="muted small" style={{ marginTop: 8 }}>{course.notes}</div>}
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <h2>Scorecard</h2>
          <table className="scorecard">
            <thead>
              <tr><th>Hole</th><th>Par</th><th>SI</th>{course.tees.map((t) => <th key={t.name + t.gender}>{t.name}</th>)}</tr>
            </thead>
            <tbody>
              {course.holes.map((h) => (
                <tr key={h.number}>
                  <td>{h.number}</td>
                  <td>{h.par}</td>
                  <td className="muted">{h.strokeIndex}</td>
                  {course.tees.map((t) => <td key={t.name + t.gender} className="muted">{t.distances?.[h.number - 1] ?? '·'}</td>)}
                </tr>
              ))}
              <tr className="tot">
                <td>Tot</td>
                <td>{course.parTotal}</td>
                <td />
                {course.tees.map((t) => <td key={t.name + t.gender}>{t.totalMeters ?? '·'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Tee ratings</h2>
          {course.tees.map((t) => (
            <div key={t.name + t.gender} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{t.name} <span className="muted small">({t.gender})</span></span>
              <span className="muted">{t.courseRating != null && t.slope != null ? `CR ${t.courseRating} / ${t.slope}` : 'no rating'}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary btn-block" onClick={() => setMode({ name: 'edit', draft: structuredClone(course) })}>
          Edit course data
        </button>
        {course.custom && (
          <button
            className="btn btn-danger btn-block"
            onClick={async () => {
              if (!window.confirm('Remove custom edits for this course?')) return
              await db.customCourses.delete(course.id)
              setMode({ name: 'list' })
            }}
          >
            Remove custom version
          </button>
        )}
      </div>
    )
  }

  if (mode.name === 'add') {
    return (
      <div className="screen">
        <div className="topbar">
          <h1>Add course</h1>
          <button className="btn btn-secondary" onClick={() => setMode({ name: 'list' })}>Back</button>
        </div>
        <div className="card">
          <h2>Look up (golfcourseapi.com)</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Course name…" value={apiQuery} onChange={(e) => setApiQuery(e.target.value)} />
            <button className="btn btn-primary" disabled={apiBusy || !apiQuery} onClick={runApiSearch}>
              {apiBusy ? '…' : 'Search'}
            </button>
          </div>
          {apiError && <div className="muted small" style={{ marginTop: 8 }}>{apiError}</div>}
          {apiResults && apiResults.length > 0 && (
            <div className="list" style={{ marginTop: 10 }}>
              {apiResults.map((c) => (
                <button key={c.id} className="list-item" onClick={() => setMode({ name: 'edit', draft: c })}>
                  <span>
                    <span className="title">{c.name}</span>
                    <span className="muted small" style={{ display: 'block' }}>{c.location} · Par {c.parTotal}</span>
                  </span>
                  <span className="chev">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-block" onClick={() => setMode({ name: 'edit', draft: emptyCourse() })}>
          Create manually
        </button>
      </div>
    )
  }

  const filtered = courses.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Courses</h1>
        <button className="btn btn-primary" onClick={() => { setApiResults(null); setApiError(null); setMode({ name: 'add' }) }}>+ Add</button>
      </div>
      <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="list">
        {filtered.map((c) => (
          <button key={c.id} className="list-item" onClick={() => setMode({ name: 'view', id: c.id })}>
            <span>
              <span className="title">{c.name}</span>
              <span className="muted small" style={{ display: 'block' }}>{c.location} · Par {c.parTotal}</span>
            </span>
            <span>
              {!c.verified && <span className="badge draft">draft</span>}
              <span className="chev"> ›</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
