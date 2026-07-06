import { useState } from 'react'
import type { Course } from '../types'
import { emptyTee, normalizeCourse, validateCourse } from '../lib/courseEdit'

export default function CourseEditor({
  draft,
  onSave,
  onCancel,
}: {
  draft: Course
  onSave: (course: Course) => void
  onCancel: () => void
}) {
  const [course, setCourse] = useState<Course>(draft)
  const [error, setError] = useState<string | null>(null)
  const [teeIdx, setTeeIdx] = useState(0)

  const tee = course.tees[teeIdx]

  function setHole(i: number, patch: Partial<Course['holes'][number]>) {
    const holes = course.holes.map((h, j) => (j === i ? { ...h, ...patch } : h))
    setCourse({ ...course, holes })
  }

  function setTee(patch: Partial<Course['tees'][number]>) {
    const tees = course.tees.map((t, j) => (j === teeIdx ? { ...t, ...patch } : t))
    setCourse({ ...course, tees })
  }

  function setDistance(i: number, value: number) {
    const distances = [...(tee.distances ?? Array(18).fill(0))]
    distances[i] = value
    setTee({ distances })
  }

  function save() {
    const normalized = normalizeCourse(course)
    const problem = validateCourse(normalized)
    if (problem) {
      setError(problem)
      window.scrollTo({ top: 0 })
      return
    }
    onSave(normalized)
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1>{draft.name ? 'Edit course' : 'New course'}</h1>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>

      {error && <div className="card" style={{ color: 'var(--red)' }}>{error}</div>}

      <div className="card">
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Name</label>
          <input type="text" value={course.name} onChange={(e) => setCourse({ ...course, name: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Location</label>
          <input type="text" value={course.location} onChange={(e) => setCourse({ ...course, location: e.target.value })} />
        </div>
        <div className="field">
          <label>Data checked against official scorecard?</label>
          <div className="seg">
            <button className={course.verified ? 'on' : ''} onClick={() => setCourse({ ...course, verified: true })}>Verified</button>
            <button className={!course.verified ? 'on' : ''} onClick={() => setCourse({ ...course, verified: false })}>Draft</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Tees</h2>
        <div className="seg" style={{ marginBottom: 10 }}>
          {course.tees.map((t, i) => (
            <button key={i} className={i === teeIdx ? 'on' : ''} onClick={() => setTeeIdx(i)}>{t.name || `Tee ${i + 1}`}</button>
          ))}
          <button onClick={() => { setCourse({ ...course, tees: [...course.tees, emptyTee('', 'gray', 'male')] }); setTeeIdx(course.tees.length) }}>+</button>
        </div>
        {tee && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="field"><label className="small">Tee name</label>
                <input type="text" value={tee.name} onChange={(e) => setTee({ name: e.target.value })} /></div>
              <div className="field"><label className="small">Gender</label>
                <select value={tee.gender} onChange={(e) => setTee({ gender: e.target.value as 'male' | 'female' })}>
                  <option value="male">Men</option><option value="female">Women</option>
                </select></div>
              <div className="field"><label className="small">Course rating</label>
                <input type="number" step="0.1" inputMode="decimal" value={tee.courseRating ?? ''} onChange={(e) => setTee({ courseRating: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="field"><label className="small">Slope</label>
                <input type="number" inputMode="numeric" value={tee.slope ?? ''} onChange={(e) => setTee({ slope: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            </div>
            {course.tees.length > 1 && (
              <button className="btn btn-danger btn-block" style={{ marginTop: 10 }}
                onClick={() => { setCourse({ ...course, tees: course.tees.filter((_, i) => i !== teeIdx) }); setTeeIdx(0) }}>
                Remove this tee
              </button>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Holes {tee?.name ? `· distances for ${tee.name} (m)` : ''}</h2>
        <table className="scorecard">
          <thead><tr><th>Hole</th><th>Par</th><th>SI</th><th>Meters</th></tr></thead>
          <tbody>
            {course.holes.map((h, i) => (
              <tr key={h.number}>
                <td>{h.number}</td>
                <td><input type="number" inputMode="numeric" style={{ width: 58, minHeight: 40, textAlign: 'center' }} value={h.par} onChange={(e) => setHole(i, { par: Number(e.target.value) })} /></td>
                <td><input type="number" inputMode="numeric" style={{ width: 58, minHeight: 40, textAlign: 'center' }} value={h.strokeIndex} onChange={(e) => setHole(i, { strokeIndex: Number(e.target.value) })} /></td>
                <td><input type="number" inputMode="numeric" style={{ width: 76, minHeight: 40, textAlign: 'center' }} value={tee?.distances?.[i] || ''} onChange={(e) => setDistance(i, Number(e.target.value))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn btn-primary btn-big btn-block" onClick={save}>Save course</button>
    </div>
  )
}
