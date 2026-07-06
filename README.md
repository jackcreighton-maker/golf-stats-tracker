# Golf Stats Tracker

Personal, offline-first PWA for tracking golf rounds and improvement stats. Built for quick on-course entry (a routine par is 2–3 taps) with extensive derived analytics: GIR, fairways, scrambling, 3-putt rate, Stableford, blow-up holes, and approximate strokes gained from optional distance-bucket inputs.

- **Stack**: Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa. No backend — all round data stays on the device (JSON export/import for backup).
- **Course data**: bundled scorecards for courses around Murcia / Almería / Alicante in `src/data/courses/*.json` (per-hole par, stroke index, per-tee meters, RFEG course rating & slope where published). Courses can also be added in-app, optionally prefilled from golfcourseapi.com.
- **Scoring**: gross + Stableford/net from a manually set playing handicap using stroke index allocation. 18-hole rounds, selectable starting hole (1/10/18).

## Develop

```sh
npm install
npm run dev     # local dev server
npm test        # stats engine tests (vitest)
npm run build   # production build (GITHUB_PAGES=true for Pages base path)
```

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to `main`. Install on a phone: open the Pages URL in Chrome → "Add to Home screen".

No personal data is ever committed — this repo contains only code and public course scorecard data.
