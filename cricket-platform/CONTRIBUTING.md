# Contributing to CricketHub

Quick orientation for a human working on this codebase. For the fuller architectural reference
(layering, conventions, gotchas) see [`CLAUDE.md`](./CLAUDE.md) — it's written for AI coding
agents, but it's the single source of truth and applies just as much here.

## Dev loop

```bash
npm run dev                              # Vite dev server
npx tsc -p tsconfig.app.json --noEmit    # fast type-check, no build
npm run build                            # tsc -b, then vite build -> dist/
npm run lint                             # oxlint
```

**There is no automated test suite.** Every change is verified by type-checking, building, and
exercising the running app in a browser. Before calling a change done:

1. `npx tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean.
2. Actually click through the change in the browser — the golden path and the obvious edge cases
   (empty states, a second/duplicate item, invalid input). Type-checking proves the code compiles,
   not that the feature works.

## Where things live

```
src/
  types/          single source of truth for all domain types
  domain/         pure functions, no I/O — the scoring engine + every stats/analytics module
  services/       the only place that talks to Firestore/Storage
  store/          Zustand: auth, appearance prefs, local-only display prefs
  components/     UI kit, layouts, route guards, charts
  features/       route pages, grouped by area (features/public/ = signed-out viewer pages)
```

If you're adding a new analytics/derivation feature, it's a pure function in `src/domain/`
consumed by a thin component — not logic embedded in a page.

## Things that are off-limits

- **`src/domain/scoring.ts`** (`applyBall`, `newInnings`, `rebuildInnings`) — treated as verified
  and reliable. New features read from it; they don't modify it. Undo works by replaying the
  delivery log through `rebuildInnings`, so a change here risks silently corrupting every
  historical match.
- **The `Delivery`/`BallInput` schema** — no new fields, no shape changes. Per-ball analytics
  metadata that doesn't belong on the delivery itself goes in a sibling doc instead (see
  `BallMeta` / `services/ballMeta.service.ts` for the pattern).
- Offline scoring / sync / write-queue / conflict resolution (`store/writeQueueStore.ts`, the
  Firestore persistent-cache setup, `OfflineBanner`, `forceResync()`) — preserve as-is.

See [`RESTRICTIONS.md`](../RESTRICTIONS.md) at the repo root for the full, current list of
constraints, deferred features (and why), and a running log of past implementation decisions.

## Conventions worth knowing before you write code

- Every Firestore write goes through `pruneUndefined()` (`src/lib/collections.ts`) —
  Firestore rejects `undefined` field values outright.
- New fields on an existing type must be additive and optional, so documents written before the
  field existed keep working with no migration step.
- Resolve display names from denormalized data on the parent doc, with the live collection as a
  fallback — team/player/tournament docs can be deleted while matches referencing them remain.
- Update `CHANGELOG.md` and whichever roadmap the change belongs to (`ROADMAP.md` for the original
  feature build, `ROADMAP_V2.md` for the polish/hardening pass, `ROADMAP_V3.md` for the League
  Ecosystem milestone) with each self-contained change.

## Environment gotchas

- **Vite 8 uses Rolldown, not esbuild** — the esbuild binary isn't installed; tools that shell out
  to esbuild will fail. Use `tsc` for standalone TypeScript compilation. Rolldown-specific build
  config (e.g. manual chunk splitting) goes under `build.rolldownOptions`, not the older
  `build.rollupOptions` (still aliased for compatibility, but deprecated in this Vite version).
- The Firebase Node SDK's gRPC transport is blocked in some sandboxed dev environments. For a
  one-off Node script that needs to touch Firestore, use the REST API over `fetch` instead of the
  Admin/client SDK.
