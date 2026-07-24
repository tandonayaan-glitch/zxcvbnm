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
- ⬜ Audit required/numeric/range validation across the highest-traffic forms (match setup,
  scoring, player/team forms) for gaps a real user could hit.

## Phase 7 — Developer tooling
- ⬜ Scope determined at slice time based on what Phase 1's audit actually finds missing.

---

### Notes
- Same standing rules as `ROADMAP.md`: `src/domain/scoring.ts`, `Delivery`/`BallInput`, and offline
  infrastructure are never touched. See `RESTRICTIONS.md` for the full, current constraint list.
- Every phase ends with `tsc` + `npm run build` green and a manual smoke test where auth access
  allows it.
