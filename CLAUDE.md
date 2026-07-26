# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

The app lives in the **`cricket-platform/`** subdirectory — run all commands from there, not the
repo root. The repo root also contains an unrelated `fps/` folder; ignore it unless asked.

## Commands (run from `cricket-platform/`)

```bash
npm run dev            # Vite dev server
npm run build          # tsc -b (type-check) THEN vite build → dist/
npm run lint           # oxlint
npx tsc -p tsconfig.app.json --noEmit   # fast type-check of just the app (no build)
```

There is **no test suite** — verification is done by type-checking, building, and exercising the
running app in a browser preview (drive React Router with `history.pushState(...)` +
`window.dispatchEvent(new PopStateEvent('popstate'))`).

## Environment gotchas

- **Vite 8 uses Rolldown**, not esbuild — the esbuild binary is not installed. Tooling that shells
  out to esbuild will fail. Use `tsc` for standalone TS compilation.
- **The Firebase Node SDK's gRPC is blocked here** (fails with `RST_STREAM` / HTTP2 errors). For
  one-off Node scripts that touch Firestore (seeding, inspection), use the **Firestore REST API**
  over `fetch` instead of the SDK. REST/HTTPS works.
- Firestore rejects `undefined` field values — all writes go through `pruneUndefined()` in
  `src/lib/collections.ts`. The scoring engine omits optional keys rather than setting `undefined`.

## Architecture

Stack: React 19 + TypeScript + Vite 8 + Tailwind v4 + Firebase (Auth + Firestore), Zustand stores,
React Router 7 (routes are **lazy-loaded** via `React.lazy` + `Suspense` in `src/App.tsx`).

**Layered, and the layering matters:**

- `src/types/index.ts` — single source of truth for all domain types.
- `src/domain/` — **pure functions, no I/O.** Two foundational engines plus many derived analytics
  modules:
  - `scoring.ts` — the ball-by-ball engine (`applyBall`, `newInnings`, `rebuildInnings`). **Treated
    as verified and reliable — do not modify it. New features READ from it.** Undo works by
    replaying the delivery log through `rebuildInnings`.
  - `stats.ts` — aggregation from completed matches (`aggregatePlayerStats`, `aggregateTeamStats`,
    `computeStandings`, `buildLeaderboards`, `buildImpactBoard`, `playerPerformances`).
  - Everything else (`teamForm`, `teamRecords`, `teamOpponents`, `teamVenues`, `headToHead`,
    `matchPerformers`, `playerSplits`, `playerTimeline`, `records`, `awards`, `bracket`, `insights`,
    `achievements`, `matchExport`, `tournamentExport`) is pure derivation over match/innings data,
    consumed by the public pages. When adding an analytics surface, put the logic here as a pure
    function and keep the component thin.
- `src/services/` — the only place that talks to Firestore (auth, players, teams, tournaments,
  matches, scoring, stats, requests, audit, userPrefs, users, settings, search).
- `src/store/` — Zustand: `authStore` (+ role helpers), `prefsStore` (appearance/a11y prefs synced
  cross-device via a `userPrefs/{uid}` doc), `bgStore` (background theme), `favStore` (follows, in
  localStorage).
- `src/features/` — route pages, grouped by area; `src/features/public/` are the viewer pages.
- `src/components/` — UI kit (`ui/primitives`), layouts (`AppShell` for signed-in, `PublicLayout`
  for viewers), route guards, and SVG charts (`components/charts/`, no external chart deps).

### Live scoring & real-time data flow

Each ball writes **both** the append-only `Delivery` (in `matches/{id}/deliveries`) **and** the
updated *denormalized* innings state on the match doc, in a single Firestore batch. Viewers
subscribe to the match doc (live score) and the deliveries subcollection (commentary) via
`onSnapshot`. Match result is computed automatically on completion. Cached `playerStats`/`teamStats`
and tournament `standings` are recomputed from all completed matches (triggered from the scoring
screen, tournament page, or Platform Tools).

## Conventions that recur across the codebase

- **Resolve display names from denormalized match data, with the live doc as fallback.** Matches
  store `teamA`/`teamB` as `{ id, name, shortName }`. Team/player docs can be deleted while their
  matches remain, so surfaces like standings, the stats Teams tab, player splits and team honours
  build a `Map(teamId → name)` from matches and fall back to the collection. Do this for any new
  surface that shows team/tournament names.
- **Roles & owner-scoping** (`src/store/authStore.ts`): `MASTER_ADMIN` bypasses every guard
  (`hasRole` returns true for it). Normal admins are owner-scoped — `ownerScope(profile)` returns
  their uid to filter by (or `null` = see-all for master), and pages apply it by filtering the
  *list* itself (e.g. `PlayersPage`/`TeamsPage`), so a normal admin never sees another admin's rows
  to begin with rather than seeing-then-hiding an edit/delete button per row. The real edit/delete
  boundary is `firestore.rules`' `isOwnerOrMaster(resource.data.ownerId)` server-side; the client
  never needs its own redundant per-row check given the list is already scoped. `ownsOrMaster` (the
  same helper, client-side) exists for a future per-item check outside a pre-scoped list — e.g. a
  detail page reached directly by URL — but nothing currently calls it. The master admin is
  bootstrapped by registering a reserved username (`src/lib/constants.ts`, `MASTER_ADMIN_USERNAME`,
  default `ayaan`) while no master exists.
- **Auth is username/password over Firebase email/password.** Usernames map to synthetic emails
  (`username@VITE_AUTH_EMAIL_DOMAIN`); users never see the email. Keep the domain stable per project.
- Firestore collection names live in `COL` (`src/lib/collections.ts`); dates/timestamps are
  formatted via `src/lib/format.ts` (handles numbers, ISO strings, and Firestore timestamp objects).
- **Keep `CHANGELOG.md` and `ROADMAP.md` (in `cricket-platform/`) updated** with each self-contained
  change — this project is developed one complete, verified slice at a time.

## Firestore rules

`cricket-platform/firestore.rules` gives public read of cricket data and gates writes by role.
Note: for local/testing the live database may be in open/test mode — deploy the real rules before
production (`firebase deploy --only firestore:rules`).
