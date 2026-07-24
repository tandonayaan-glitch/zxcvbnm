# CricketHub — Roadmap V2 (Polish & Hardening Pass)

`ROADMAP.md` covers the original "commercial platform" expansion (32 phases, all ✅). This second
roadmap tracks a follow-on pass focused on **cleanup, media management, notification polish,
UI/UX, performance, production hardening, and developer tooling** — not new feature surface area,
but making the existing surface area more solid. Same rules as `ROADMAP.md`: phased, shippable at
every step, no placeholders, `RESTRICTIONS.md` governs what's off-limits.

Legend: ✅ done · 🟡 partial / in progress · ⬜ planned · 🚫 decided against (see reasoning inline)

---

## Audit summary (before slicing)

A quick repo audit before planning turned up concrete, verifiable findings rather than generic
"polish" guesses:

- **Dead code with a latent bug**: `services/matches.service.ts`'s `listMatches(opts)` has zero
  call sites anywhere in the app (only the unfiltered `listAllMatches()` is actually used) — and
  its implementation combines Firestore `where()` equality filters with `orderBy('createdAt')` on
  compound options, which requires a composite Firestore index this project doesn't ship. If
  anyone ever called it with a filter set, it would throw at runtime. Every other service in this
  codebase deliberately avoids this by filtering/sorting client-side (documented in half a dozen
  places as "sorted client-side to avoid index needs") — this function is the one place that
  didn't follow the house convention, and it happens to be unused.
- **No `firestore.indexes.json` exists.** Given every live (actually-called) query in the app was
  deliberately designed to avoid needing one (confirmed by grepping every `where()` call site),
  this is arguably correct as-is — but it's undocumented, so a future contributor adding a new
  filtered+sorted query wouldn't know to check. Worth a written convention note, not necessarily a
  populated index file for indexes nothing needs yet.
- **Notification history**: `services/notifications.service.ts` already exports a full
  `listNotifications(userId, max)` — capped at 50, sorted, ready to use — but nothing calls it. The
  only UI is the header bell's live dropdown (`subscribeNotifications`, also capped at 50). There's
  no page to see anything beyond that, no per-category filter, no "load more."
- **No match photo galleries.** `services/storage.service.ts` (Phase 12) uploads to `players/`,
  `teams/`, `clubs/`, `tournaments/` folders; nothing uploads to a `matches/{id}/` folder or
  displays a gallery on the match page. This is explicitly on the user's priority list this pass.
- **Bundle size**: `npm run build` has warned on a 500kB+ chunk (`collections-*.js`, actually the
  Firebase SDK + everything importing `lib/collections.ts`, i.e. every service) on every build this
  whole project. No `vite.config.ts` manual chunking exists to separate vendor code from app code.
- No `CONTRIBUTING.md` / developer-setup doc beyond `CLAUDE.md` (which is for AI agents, not
  necessarily a human contributor's first stop) — `README.md` status unconfirmed, checking as part
  of Slice 1.

Full UI/UX consistency and validation audits happen as their own slices below rather than trying
to enumerate every finding up front.

---

## Phase 1 — Repository cleanup
- ✅ Removed the dead, index-landmine `listMatches(opts)` from `matches.service.ts` — verified zero
  call sites anywhere (checked with and without excluding its own file), and its shape (equality
  filters + `orderBy` on a different field) would have thrown a missing-composite-index error in
  production the first time anyone used it. `listAllMatches()` (the one actually used everywhere,
  already client-side-filtered/sorted) is unaffected; the now-unused `limit`/`MatchStatus` imports
  it pulled in were removed too.
- ✅ New `firestore.indexes.json` (empty `indexes`/`fieldOverrides`, registered in `firebase.json`)
  makes the "this app needs zero composite indexes" invariant a checked-in, deployable decision
  instead of a silent absence — JSON has no comment syntax so the reasoning lives here and in
  `RESTRICTIONS.md` instead of inline in the file itself.
- 🟡 **Attempted a broader dead-code sweep, found it too unreliable to act on.** A script checking
  every exported service function for callers outside its own file flagged 22 "unused" functions
  (`abandonMatch`, `completeMatch`, `restoreFromTrash`, `permanentlyDelete`, etc.) — spot-checking
  several confirmed these are false positives: they're called by *other exported functions in the
  same file* (e.g. `trash.service.ts`'s `bulkRestore()` calls `restoreFromTrash()` internally),
  which a same-file-excluding grep can't distinguish from genuine dead code. Rather than risk
  deleting something real on a noisy signal, only `listMatches` — independently verified to have
  zero references anywhere, full stop — was removed. A trustworthy dead-export sweep would need an
  actual TS AST/usage analyzer (e.g. `ts-prune` or similar), not a grep script; not run this pass.

## Phase 2 — Notification history page
- ✅ New `/notifications` page reusing the already-existing (previously unused)
  `listNotifications(userId, max)` — raised the effective cap to 500 for a "history" view, with
  client-side read/unread and per-category filter pills (mirroring the filter-chip pattern already
  used on the Trash and Data-integrity pages) plus `usePaginated` for the list itself, matching
  every other admin list page's pagination convention rather than inventing a new one. "Mark all
  read" reuses `markAllRead()`, already built for the bell dropdown. The bell dropdown
  (`NotificationBell.tsx`) gained a "View all notifications" footer link to the new page — the one
  UI change to existing code this slice needed. **A real concurrent-edit race hit mid-slice**: the
  first attempt to add the `/notifications` lazy import + route to `App.tsx` was silently lost —
  the concurrent session's own edit to the same file (adding `CompareTournamentsPage`) landed based
  on a pre-my-edit read, overwriting mine without either side erroring. Caught it by grepping for
  `NotificationsPage` in `App.tsx` right after a build that should have included it and finding
  nothing; re-applied the edit against the then-current file and committed immediately afterward
  to minimize the next race window. `tsc`/`npm run build` clean after the fix. Not click-tested
  live — same master-admin-auth-loss caveat as recent `ROADMAP.md` phases.

## Phase 3 — Match photo galleries
- ✅ New `components/media/MatchGallery.tsx`, built entirely on the already-existing
  `storage.service.ts` exports (`uploadImage`, `deleteUploadedImage`, `listFolderImages`) — no
  service-layer changes needed. Uploads go to a `matches/{id}/` Storage folder, following the same
  convention as `players/{id}`, `teams/{id}`, etc.; `storage.rules`' wildcard rule already covers it,
  so no rules deploy was needed either. Wired into the public `MatchPage.tsx` right after the
  scorecard, passing the page's existing `canScore(profile)` boolean through as `canManage` — so
  only the match's scorer/owner (or master admin) gets the upload control and per-photo delete
  button; everyone else sees a read-only grid. Multi-file upload (loops `uploadImage()` per file,
  one toast per batch, per-file error toasts on partial failure), lazy-loaded grid thumbnails, and a
  built-in lightbox (no new dependency). If there are zero photos and the viewer can't manage them,
  the card renders nothing rather than an empty "Match photos" placeholder on every match page.
  `tsc` clean for both new/changed files (pre-existing, unrelated `PlayerFormModal.tsx` type error
  from the concurrent session's in-flight edit — not touched). **Click-tested live** against a real
  completed match (`/match/seedRSvTK1`) on a second dev-server instance (auth-independent, since a
  public visitor is exactly the `canManage=false` case): confirmed the Storage SDK loaded, the
  section showed "Loading photos…" then correctly resolved to fully hidden once it settled on zero
  photos for a read-only visitor (the `!canManage && !loading && empty → render nothing` branch),
  and no console/network errors. The admin upload/delete controls weren't exercised — same
  master-admin-auth-loss caveat as recent phases.

## Phase 4 — UI/UX polish pass
- ⬜ Targeted consistency + motion pass — scope determined by a focused audit at slice time rather
  than promised up front.

## Phase 5 — Performance: bundle chunking
- ✅ `vite.config.ts` gained a `build.rolldownOptions.output.manualChunks` function (this Vite 8 /
  Rolldown build's config surface — `rollupOptions` still works but is deprecated in favor of
  `rolldownOptions` here, confirmed by reading `node_modules/vite`'s own type definitions rather
  than assuming Rollup-era config carries over unchanged) splitting `node_modules` code into
  `vendor-firebase` (the Firebase SDK — by far the largest dependency), `vendor-react`
  (react/react-dom/react-router-dom), and a catch-all `vendor` (lucide-react, zustand, date-fns,
  etc.), separate from the app's own `index` entry chunk.
- **Real effect, not just reshuffling**: the previous single `collections-*.js` chunk (680kB,
  named after `lib/collections.ts` since every service imports it and therefore every service's
  code plus the entire Firebase SDK got bundled together) is gone. The app's own `index` entry
  chunk dropped from ~305kB to ~72kB — the win is that a future app-only code change no longer
  forces every returning visitor to re-download the Firebase SDK too; `vendor-firebase` (~518kB)
  can now be cached long-term across deploys since it almost never changes. The 500kB+ chunk
  build warning still fires (on `vendor-firebase` itself) — expected and left as-is, since that's
  the real, irreducible size of the Firebase SDK, not something manual chunking can shrink further
  without dropping the dependency.
- Verified `tsc`/`npm run build` clean, then **click-tested the actual production bundle** (manual
  chunking only affects `vite build`, not `vite dev`, so testing against the dev server would not
  have exercised this at all): added a `cricket-platform-preview` entry to `.claude/launch.json`
  running `vite preview` on port 4173, loaded the public home page (real live match, leaderboards,
  recent results all rendered from genuine Firestore data), confirmed all three vendor chunks
  loaded with no console errors, then navigated to `/stats` (a separate lazy-loaded route chunk)
  and confirmed it rendered correctly too — proving the split holds up across real navigation
  between chunks, not just on first load.

## Phase 6 — Production hardening: form validation audit
- ✅ Audited match setup, scoring, and Player/Team/Club/Tournament forms for numeric/range gaps a
  real user could actually hit. Scoring itself (`ScoringPage.tsx`) turned out clean — every run
  value is a discrete button (0/1/2/3/4/6), not free-text input, so there's nothing to bound there
  by construction. Player/Team/Club forms have no numeric fields at all.
- **Found and fixed two real gaps**, both of the same shape: a numeric `<Input min={1}>` whose
  `min`/`max` HTML attributes look like validation but aren't enforced anywhere (this app has no
  wrapping `<form>`/`reportValidity()` call), combined with a `Number(x) || fallbackValue` pattern
  at submit time that silently swaps in the fallback for `0` (falsy) but lets negative numbers
  straight through unchanged:
  1. `MatchSetupPage.tsx`'s wizard: `canAdvance()`'s step-0 gate only checked the title, never
     `oversPerInnings`/`ballsPerOver` — a user could type `0` or a negative number into either
     field and still click through every step to a real `createMatch()`/`updateMatch()` call.
     Added bounds (`1–120` overs, `1–12` balls/over, matching the existing `max={12}` already on
     the balls-per-over input) directly into the gate.
  2. `TournamentFormModal.tsx`'s `submit()`: `oversPerInnings` used the same silent-fallback
     pattern, and `qualifiersPerGroup` (only relevant for the `group_knockout` format) had no
     validation at all. Replaced both with explicit `setError(...)` early-returns instead of
     silently substituting a different number than what the user typed — consistent with how
     `!name.trim()` is already handled in the same function. Added a matching `max={120}` to the
     tournament form's overs input (mirrors the match-setup one) for the same reason.
- `tsc`/`npm run build` clean. Not click-tested live — both are auth-gated admin forms, and this
  session's browser tooling has no stored session on a fresh `vite preview` origin (confirmed: a
  fresh preview tab loaded the sign-in screen, not an authenticated view) and no credentials to
  log in with; the fix itself is a boolean-gate/early-return change with no new UI surface.

## Phase 7 — Developer tooling
- ✅ Scoped from Phase 1's own audit finding: "no `CONTRIBUTING.md` / developer-setup doc beyond
  `CLAUDE.md`... `README.md` status unconfirmed." Read the existing `README.md` (113 lines, dated
  before this whole session's work) — it's a real, accurate setup doc, not a placeholder, just
  stale in a couple of specific spots: it listed 5 roles, missing `MASTER_ADMIN` (now central to
  the app per `CLAUDE.md`), and described bootstrap as "the first admin" rather than the actual
  reserved-username master-admin mechanism. Fixed both, and added a line about Trash/version
  history/admin tools that didn't exist when the README was written.
- New `CONTRIBUTING.md` — a concise, human-facing dev-loop doc (run/verify commands, "no test
  suite" convention, where things live, the off-limits list restated briefly with a pointer to
  `RESTRICTIONS.md` for the full detail, and the environment gotchas from `CLAUDE.md`). Deliberately
  short and non-duplicative — `CLAUDE.md` remains the fuller reference; this is the human-onboarding
  front door to it, not a second copy of it.
- Deliberately **not** built: CI/CD pipeline, pre-commit hooks, a test framework, or any other
  "developer tooling" that would imply an automated test suite exists — `RESTRICTIONS.md` §4
  already deferred that in full ("an infrastructure decision for the user to make, not one to
  bootstrap unasked"), and this phase's own scope (from Phase 1's audit) was specifically the
  missing *documentation*, not new tooling infrastructure.
- Docs-only change; `tsc`/`npm run build` unaffected (confirmed clean anyway, no regressions).

---

### Notes
- Same standing rules as `ROADMAP.md`: `src/domain/scoring.ts`, `Delivery`/`BallInput`, and offline
  infrastructure are never touched. See `RESTRICTIONS.md` for the full, current constraint list.
- Every phase ends with `tsc` + `npm run build` green and a manual smoke test where auth access
  allows it.
