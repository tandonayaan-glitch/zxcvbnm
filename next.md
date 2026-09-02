# CricketHub — Open problems & things NOT verified

Handoff list as of **2026-09-02** (overnight deploy + readiness pass). Newest pass's
findings first. This file is deliberately the "what's still wrong / unproven" list;
the "what got fixed" log lives in `things done.md`.

---

## 1. BLOCKED — no authenticated runtime testing this pass

The master-admin browser session the owner had signed in **expired** partway through the
overnight run, and creating an account / entering a password to sign in is disallowed by
policy. So for this pass, **every signed-in surface is code- or rules-verified only**, not
runtime-tested:

- Live scoring flow (score pad, extras, wickets, New Batter, innings transition, 2nd innings)
- Wagon Wheel / Pitch Map tagging **in the live scoring UI** (see §5 — reviewed in code, and
  runtime-verified in an earlier session, just not re-run tonight)
- Auto powerplay banner/phase in a running match
- Player archive / restore / trash persistence
- Tutorial "don't show again" opt-out
- Dark mode on signed-in pages
- Dashboard "Live matches" widget (the richer version shipped this pass — **public** home
  cards were runtime-verified, the dashboard widget was not)
- All `/admin/*` pages, `/users`, `/requests`, `/settings`

**What WAS runtime-verified this pass:** public pages only — the deployed site's home
(incl. the new richer live-match cards), `/browse`, `/stats`, tab strips, no horizontal
scroll at 375 / 1280, and a clean console/network sweep of public routes. Plus `tsc` 0,
`lint` 0 errors, `build` green.

**To close this:** re-run the authenticated matrix from `things done.md` §Session 5 once a
signed-in session is available on the deployed origin.

## 2. BLOCKED (config) — image uploads are dead on the live site

`VITE_R2_WORKER_URL` / `VITE_R2_PUBLIC_URL` are **unset** both locally (`.env.local`) and in
the deployed bundle. `uploadImage()` short-circuits before any network call with a friendly
toast *"Image uploads are not configured yet."* — so avatars, team/club logos, tournament
banners and match photos **cannot be uploaded on production right now**. URL-paste image
fields still work. The Media Library page itself loads fine and shows 0 images.

**To close this:** deploy the `crickethub-media-worker` (see `worker/README.md`), then set
both env vars and redeploy hosting. Until then the Media Library is display-only.

## 3. NOT deployed this pass — Firestore rules / indexes / Storage rules

`firebase deploy` this pass was **`--only hosting`**. `firestore.rules`,
`firestore.indexes.json` and `storage.rules` were **not** pushed. If the live database is
still in open/test mode (CLAUDE.md warns it may be), that is a standing security gap.

**To close this:** review `firestore.rules` against current production data shape, then
`firebase deploy --only firestore:rules,firestore:indexes,storage` deliberately, watching
for breakage on live traffic.

## 4. Stale production data (not code — needs owner action)

- **8+ abandoned "LIVE" test matches** still show on the public homepage's live rail
  ("MSW"/"Audit"/"mm" teams stuck at low scores). They dominate the freshly-improved live
  cards. Wipe with the `scripts/wipe-*.mjs` helpers or archive them.
- Leftover dev/test **accounts, teams, players** in the production directory (full inventory
  in the lower half of the previous version of this file / `git show HEAD~1:next.md`).
- `/admin/tools` → "Client errors" panel lists **4 stale ReferenceErrors dated 2026-08-29**
  (`ballMetaById`/`onLogout`/`LogOut`/`useNavigate` not defined) from a broken WIP build.
  Already fixed in code; they age out after 7 days; the panel has no manual clear.

## 5. Investigated, NOT a bug — Wagon Wheel / Pitch Map "disappearing after each ball"

Reviewed `ScoringPage.tsx` (`score()` → `setPendingMeta(null)` then a fresh `pendingMeta`
for the new delivery) and `WagonWheelInput` / `PitchLengthInput`. The input **resetting to
empty for the next ball is intended** — each delivery gets its own shot placement. The
tagged shot is **not lost**:

- it is written to `matches/{id}/ballMeta/{deliveryId}` (doc id = delivery id, so ball N+1
  can't overwrite ball N — verified by runtime test in an earlier session),
- the ball's chip in the "this over" strip gets a `ring-pitch-400` marker,
- clicking that chip reopens the panel pre-filled (`openEditMeta`),
- and it renders on the public scorecard's wagon wheel + line/length grid.

No change made. If the owner wants the *previous* ball's wheel to stay visible while
tagging the next, that's a design change, not a bug fix.

## 6. Deliberately left alone

- **No-ball boundary count** (`domain/scoring.ts` ~line 237): a 4 or 6 off a no-ball adds to
  runs/strike-rate but not the batter's 4s/6s column. `scoring.ts` is treated as
  verified/frozen — flagged for the owner's own call, not changed.
- **`AppShell` secondary controls hidden below 640px** (Background picker, Tutorial button,
  name/role block) — deliberate, so the signed-in header fits a 320px phone. Change the
  layout if you want them on mobile.
- **`Tabs` now wraps to a 2nd row on very narrow phones** for the 5-tab Stats strip —
  deliberate (all tabs reachable beats a hidden horizontal scroll). On laptop/iPad it stays
  a single row.
- **Stale `// verified phone` comment** in `src/features/auth/SignupPage.tsx:12` — copy-only,
  not rendered; left for a copy sweep.

## 7. Known cosmetic — Firebase Storage `listAll` CORS console lines (dev, maybe prod)

`firebasestorage.googleapis.com/...?prefix=players/` preflight fails from an origin not in
the bucket's CORS allowlist. Caught; galleries still render from R2; the
`storage.service.ts` circuit breaker limits it to ~1 probe per session. Whether it appears
on the deployed origin depends on that bucket's CORS config. Cosmetic either way.
