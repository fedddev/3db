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
- **The world builds around you.** You start standing on an empty floor at eye
  height; a dropped CSV builds in front of you, and loading it
  never moves the camera. Every dataset has a `blurb`: the narrator's voice on
  arrival.
- **Voice costs nothing by default.** A free in-browser parser handles common
  phrases; only what it can't parse goes to the AI proxy (Claude Haiku 4.5).

## Brand

This project is built by fedddev. Follow `brand/BRAND.md` for all styling, color, typography,
logo/wordmark usage and 3D scene decisions, and use the variables in `brand/tokens.css`
(semantic tokens like `--fd-bg`, `--fd-accent-cool`) instead of hard-coded values. Artwork is in
`public/brand/`; never redraw, retype or recolor it. Source of truth for the kit:
`C:\Users\fedde\00_DEVELOPMENT\000_fedddev_branding` (re-copy on changes).

- 3db is dark mode only (`data-theme="dark"`): the world is a night scene. Scene colors live in
  `src/scene/colors.ts`.
- Data colors: the brand trio plus five hues, ordered and checked with the dataviz palette
  validator against jungle. Re-run it if you change the categorical list or the ramp.
- The floor grid stays recessive (not fern), because fern is data color 1.
- 3D `<Text>` must pass a brand font (`@fontsource` .woff via `?url`); drei defaults to Roboto.

## Architecture

```
speech / typed text
  -> commands/parse.ts   free fast path: phrase -> Command (or null)
  -> commands/ai.ts      if null/unknown field: POST /api/interpret -> server/interpret.ts (Haiku)
  -> commands/run.ts     validates + applies Command; the only thing that changes the world
  -> data/query.ts       ViewSpec -> SQL (DuckDB-WASM, in the browser)
  -> scene/layout.ts     rows -> target positions/sizes/colors (grid | timeline | geo)
  -> scene/Records.tsx   one InstancedMesh, eased toward targets every frame
```

- `src/commands/types.ts` is **the contract**. The AI proxy must emit exactly
  these shapes (structured output). `runCommand` never trusts field names.
- `server/interpret.ts`: the AI proxy. Web-standard `handleInterpret(Request)`,
  served by Vite middleware in dev (`vite.config.ts`). Sends the phrase plus a
  small context (columns, groups, current view, top values per text column),
  never the rows. Output is constrained by a JSON schema built from Zod with
  `z.toJSONSchema` (not the SDK's zod helper, which demotes enum/const to
  descriptions and would let the model invent command types), then re-validated
  with Zod. Guardrails: 12 calls/min per IP, a daily cap, 300-char phrases.
- `src/store.ts`: zustand. Non-React modules use `getState`/`setState`.
- `src/data/datasets.ts`: turns a dropped CSV into a dataset definition (load,
  aliases, defaults, blurb). There are no built-in worlds.
- Camera starts at (0, 1.6, 10) looking at the origin (`START_POSITION` in
  `src/store.ts`). Space/C never take it
  below eye height.
- Corner view: grid and timeline layouts are turned 45° (`CORNER_YAW`) with
  their near corner at the origin, so you look straight at a corner and both
  sides recede. Boxes, outlines and the floor grid share the turn; geo stays
  unturned. The timeline is about as long as it is wide (same-period records
  stack sideways) so both sides have depth.
- The title hangs past the far end, high enough to clear every box as seen
  from the start (`titlePlacement`). On load the camera turns in place toward
  it, pitched so the title sits near the top of the screen and the skyline
  above the keys (`titleGaze` in `run.ts`; a "gaze", `GAZE_RATE` = a third of the boxes' `EASE_RATE`); any movement
  or mouse look cancels it.
- Group names are painted flat on the floor like street names, in the gap left
  of each group and reading along it (`GroupInfo.street`).
- "recenter"/"home" fly back to the start and end looking at the title.
- HUD (`src/ui/Hud.tsx`): before a world, the welcome box shows the narrator
  line and an Upload CSV button; once loaded, a keys panel replaces it: name
  and file facts, with columns and `COMMANDS` (from `parse.ts`) collapsed
  until "Show keys" / "show keys" (`keys` command). Replies show as a toast
  that fades after 4 s. Use `say()` from the store for narrator messages.
- `src/data/validateCsv.ts` checks every dropped/uploaded file first (.csv,
  ≤ 50 MB, named unique headers, at least one row, same field count on every
  row, closed quotes) and returns a plain-sentence error.
- Filters don't remove rows: every row returns with `__match`, and misses sink.
- Times are always epoch ms in the scene (`epochFields` or TIMESTAMP columns).

## Data

- Worlds come only from CSVs the user drops or uploads; they load into
  DuckDB-WASM in the browser and never leave it.
- Nothing the user says or types is stored.

## AI setup

Put `ANTHROPIC_API_KEY=...` in `.env.local` (gitignored; see `.env.example`)
and restart `npm run dev`. Without it, unparsed phrases just get a polite
"don't know that yet". Set a monthly spend limit on the Anthropic Console
workspace: the in-memory limits reset on restart. Haiku 4.5 only caches
prompts of 4096+ tokens and ours is ~1.5K, so every call pays full input
(about $0.002-0.003 per phrase).

## Gotchas

- drei `<Text>` suspends while its font loads. Keep it inside a `<Suspense>`
  within the Canvas; without one the suspension reached the DOM tree and
  reverted keystrokes in the command bar.

## Commands

```
npm run dev        # starts Vite
npm run build      # typecheck + production build
npm run lint       # oxlint
```

Controls: click the world to capture the mouse (it looks around), WASD or
arrows to walk and strafe, Space/C up/down (floor at eye height, 1.6 m),
Shift to run, V for voice, / to type, Esc to release. Drop or upload a CSV to explore it.

## Decisions (2026-09-26)

- React + React Three Fiber, Vite, TypeScript. VR/WebXR is a nice-to-have.
- Twitter/X dropped. No secrets in the client, ever (the old repo leaked keys).
- AI voice: Claude behind a small serverless proxy (Firebase Functions likely)
  with rate limits and a hard spend cap. Model: Claude Haiku 4.5 (chosen for
  cost; step up to Sonnet 5 if it misreads phrases). No self-hosted model: idle GPU cost and cold starts
  don't fit a voice demo.
- DuckDB-WASM costs ~8 MB gzipped on first load. Accepted for real SQL; revisit
  (lazy-load, or CDN bundles) if first paint suffers.

## Next

1. Deploy the proxy (Firebase Functions next to Hosting; set VITE_AI_URL if
   it lives on another origin).
2. Coastline outline under the geo layout; stack order for weekday/month groups.
3. Open a record in place (fields unfold around it) instead of only the side panel.
4. Guided tour: the narrator walks first-time visitors through a world.
5. Deploy (Firebase Hosting; the project `three-db` exists from 2018).
