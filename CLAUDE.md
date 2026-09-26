# 3db

A database you can walk through. Rows become objects in a 3D world; queries
physically rearrange it; you drive it by voice or text. Rebuilt in 2026 from
`threedb-v2` (a 2018 Vue 2 + A-Frame bootcamp demo), whose ideas carry over:
voice control, a narrator/tutorial line, a world you move through.

## Principles

- **Use what 3D offers that spreadsheets and charts can't.** Depth, walking
  distance, grouping as districts, filtering as sinking, time as distance.
  If a feature would work just as well as a 2D chart, it's the wrong feature.
- **Change is motion.** Views never snap: boxes ease to new targets so you
  watch the data reorganize.
- **Editorial data mix.** Built-in worlds pair data the project makes about
  itself (its git history, its command log) with public data (USGS
  earthquakes). Every dataset has a `blurb`: the narrator's voice on arrival.
- **Voice costs nothing by default.** A free in-browser parser handles common
  phrases; only what it can't parse will go to an AI (not built yet).

## Architecture

```
speech / typed text
  -> commands/parse.ts   free fast path: phrase -> Command (or null)
  -> commands/run.ts     validates + applies Command; the only thing that changes the world
  -> data/query.ts       ViewSpec -> SQL (DuckDB-WASM, in the browser)
  -> scene/layout.ts     rows -> target positions/sizes/colors (grid | timeline | geo)
  -> scene/Records.tsx   one InstancedMesh, eased toward targets every frame
```

- `src/commands/types.ts` is **the contract**. The AI proxy must emit exactly
  these shapes (structured output). `runCommand` never trusts field names.
- `src/store.ts`: zustand. Non-React modules use `getState`/`setState`.
- `src/data/datasets.ts`: dataset definitions (load, aliases, field aliases,
  defaults, blurb). Add new worlds here.
- Filters don't remove rows: every row returns with `__match`, and misses sink.
- Times are always epoch ms in the scene (`epochFields` or TIMESTAMP columns).

## Data

- `scripts/gen-commits.mjs` runs before `dev`/`build` and writes
  `public/data/commits.json` (gitignored) from this repo's history plus the
  frozen `data/lineage/threedb-v2.json`. `package-lock.json` and `dist/` are
  excluded from line counts. `ai_assisted` is true for commits with a Claude
  Co-Authored-By trailer.
- Earthquakes load live from the USGS weekly feed (CORS-open, no key).
- The command log lives in localStorage (`3db.commandLog`); it will move server-side.

## Commands

```
npm run dev        # regenerates commits.json, starts Vite
npm run build      # typecheck + production build
npm run lint       # oxlint
```

Controls: click the world to capture the mouse, WASD + Space/C to fly,
Shift to run, V for voice, / to type, Esc to release. Drop a CSV to explore it.

## Decisions (2026-09-26)

- React + React Three Fiber, Vite, TypeScript. VR/WebXR is a nice-to-have.
- Twitter/X dropped. No secrets in the client, ever (the old repo leaked keys).
- AI voice: Claude behind a small serverless proxy (Firebase Functions likely)
  with rate limits and a hard spend cap; model choice is still open (Haiku 4.5
  vs Sonnet 5 vs Opus 5). No self-hosted model: idle GPU cost and cold starts
  don't fit a voice demo.
- DuckDB-WASM costs ~8 MB gzipped on first load. Accepted for real SQL; revisit
  (lazy-load, or CDN bundles) if first paint suffers.

## Next

1. AI proxy for unparsed phrases (send schema + phrase, receive a Command).
2. Coastline outline under the geo layout; stack order for weekday/month groups.
3. Open a record in place (fields unfold around it) instead of only the side panel.
4. Guided tour: the narrator walks first-time visitors through a world.
5. Deploy (Firebase Hosting; the project `three-db` exists from 2018).
