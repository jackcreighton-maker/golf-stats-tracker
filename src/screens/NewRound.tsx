import { useEffect, useState } from 'react'
import db, { getSettings } from '../db'
import { useCourses } from '../courseStore'
import { emptyHoleEntry, type StartingHole } from '../types'
import type { Navigate } from '../App'

export default function NewRound({ navigate }: { navigate: Navigate }) {
  const courses = useCourses()
  const [courseId, setCourseId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [teeName, setTeeName] = useState<string | null>(null)
  const [startingHole, setStartingHole] = useState<StartingHole>(1)
  const [playingHandicap, setPlayingHandicap] = useState<string>('')

  useEffect(() => {
    getSettings().then((s) => {
      if (s.handicapIndex != null) setPlayingHandicap(String(Math.round(s.handicapIndex)))
    })
  }, [])

  const course = courses?.find((c) => c.id === courseId)
  const filtered = (courses ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase()),
  )

  async function start() {
    if (!course || !teeName) return
    const id = await db.rounds.add({
      date: new Date().toISOString().slice(0, 10),
      courseId: course.id,
      teeName,
      playingHandicap: Number(playingHandicap) || 0,
      startingHole,
      holes: Array.from({ length: 18 }, (_, i) => emptyHoleEntry(i + 1)),
      status: 'active',
    })
    navigate({ name: 'play', roundId: id as number })
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1>New round</h1>
        <button className="btn btn-secondary" onClick={() => navigate({ name: 'home' })}>Cancel</button>
      </div>

      {!course && (
        <>
          <input
            type="text"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="list">
            {filtered.map((c) => (
              <button key={c.id} className="list-item" onClick={() => { setCourseId(c.id); setTeeName(null) }}>
                <span>
                  <span className="title">{c.name}</span>
                  <span className="muted small" style={{ display: 'block' }}>{c.location}</span>
                </span>
                <span>
                  {!c.verified && <span className="badge draft">draft</span>}
                  <span className="chev"> ›</span>
                </span>
              </button>
            ))}
            {courses && filtered.length === 0 && (
              <div className="card muted">No matching course. Add it in the Courses tab first.</div>
            )}
          </div>
        </>
      )}

      {course && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{course.name}</div>
                <div className="muted small">{course.location} · Par {course.parTotal}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setCourseId(null)}>Change</button>
            </div>
          </div>

          <div className="field">
            <label>Tee</label>
            <div className="list">
              {course.tees.map((t) => (
                <button
                  key={t.name + t.gender}
                  className="list-item"
                  style={teeName === t.name ? { outline: '2.5px solid var(--green)' } : undefined}
                  onClick={() => setTeeName(t.name)}
                >
                  <span>
                    <span className="title">{t.name}</span>
                    <span className="muted small" style={{ display: 'block' }}>
                      {t.totalMeters ? `${t.totalMeters} m` : 'distance n/a'}
                      {t.courseRating != null && t.slope != null ? ` · CR ${t.courseRating} / Slope ${t.slope}` : ''}
                    </span>
                  </span>
                  {teeName === t.name && <span style={{ color: 'var(--green)', fontWeight: 800 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Starting hole</label>
            <div className="seg">
              {([1, 10, 18] as StartingHole[]).map((h) => (
                <button key={h} className={startingHole === h ? 'on' : ''} onClick={() => setStartingHole(h)}>
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>
              Playing handicap <span className="hint">(strokes for this round)</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={playingHandicap}
              onChange={(e) => setPlayingHandicap(e.target.value)}
            />
          </div>

          <button className="btn btn-primary btn-big btn-block" disabled={!teeName} style={!teeName ? { opacity: 0.5 } : undefined} onClick={start}>
            Start round
          </button>
        </>
      )}
    </div>
  )
}
