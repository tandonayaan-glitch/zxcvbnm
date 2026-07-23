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
- ⬜ `/notifications` page reusing the already-existing `listNotifications()` — full list beyond
  the bell dropdown's 50-item cap, per-category filter, mark-as-read from the list.

## Phase 3 — Match photo galleries
- ⬜ Firebase Storage uploads scoped to `matches/{id}/`, gallery display on the public match page,
  upload control on the match management side (owner/scorer only).

## Phase 4 — UI/UX polish pass
- ⬜ Targeted consistency + motion pass — scope determined by a focused audit at slice time rather
  than promised up front.

## Phase 5 — Performance: bundle chunking
- ⬜ `vite.config.ts` manual chunk splitting to separate Firebase SDK vendor code from app code.

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
