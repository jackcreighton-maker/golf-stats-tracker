// Converts researched course objects into src/data/courses/*.json seed files.
// Usage: node scripts/import-courses.mjs <results.json>
// results.json = array of course objects: { name, location, parTotal, holes, tees, sources, confidence, notes }
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'src/data/courses')

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function validate(c) {
  const problems = []
  if (!Array.isArray(c.holes) || c.holes.length !== 18) return ['holes != 18']
  const parSum = c.holes.reduce((a, h) => a + h.par, 0)
  if (parSum !== c.parTotal) problems.push(`par sum ${parSum} != parTotal ${c.parTotal}`)
  const si = new Set(c.holes.map((h) => h.strokeIndex))
  if (si.size !== 18) problems.push('stroke index not a permutation of 1-18')
  for (const t of c.tees ?? []) {
    if (t.distances) {
      if (t.distances.length !== 18) problems.push(`${t.name}: ${t.distances.length} distances`)
      else if (t.totalMeters) {
        const sum = t.distances.reduce((a, b) => a + b, 0)
        if (Math.abs(sum - t.totalMeters) > 25) problems.push(`${t.name}: sum ${sum} vs total ${t.totalMeters}`)
      }
    }
  }
  return problems
}

// Permanently closed courses that still show up in directories — never seed.
const EXCLUDED = [/lorca/i]

const input = JSON.parse(readFileSync(process.argv[2], 'utf8'))
let written = 0
let skippedInvalid = 0
for (const c of input) {
  if (EXCLUDED.some((re) => re.test(c.name))) {
    console.error(`SKIP ${c.name}: permanently closed`)
    continue
  }
  const problems = validate(c)
  if (problems.length) {
    console.error(`SKIP ${c.name}: ${problems.join('; ')}`)
    skippedInvalid++
    continue
  }
  const id = slugify(c.name)
  const file = resolve(outDir, `${id}.json`)
  if (existsSync(file)) {
    console.error(`SKIP ${c.name}: ${id}.json already exists`)
    continue
  }
  const course = {
    id,
    name: c.name,
    location: c.location,
    parTotal: c.parTotal,
    verified: c.confidence === 'high',
    holes: c.holes.map((h, i) => ({ number: i + 1, par: h.par, strokeIndex: h.strokeIndex })),
    tees: c.tees.map((t) => ({
      name: t.name,
      color: t.color || 'gray',
      gender: t.gender,
      courseRating: t.courseRating ?? null,
      slope: t.slope ?? null,
      distances: t.distances ?? null,
      totalMeters: t.totalMeters ?? (t.distances ? t.distances.reduce((a, b) => a + b, 0) : null),
    })),
    sources: c.sources ?? [],
    notes: [c.confidence !== 'high' ? `Confidence: ${c.confidence} — check against the official scorecard.` : '', c.notes ?? '']
      .filter(Boolean)
      .join(' ') || undefined,
  }
  writeFileSync(file, JSON.stringify(course, null, 2) + '\n')
  written++
}
console.log(`Wrote ${written} course files to src/data/courses (${skippedInvalid} skipped as invalid)`)
