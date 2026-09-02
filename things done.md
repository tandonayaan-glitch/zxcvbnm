# Things done — CricketHub improvement pass

Running log of the work completed across this improvement pass. Newest section first.
All application code lives in `cricket-platform/`. The ball-by-ball scoring engine
(`src/domain/scoring.ts`) and `firestore.rules` were **not** modified.

---

## Session 6 — Overnight deploy + readiness pass (live Firebase) + requested polish

Deployed the accumulated fixes to the live Firebase site and did a set of small, explicitly
requested improvements. The master-admin browser session had expired and account creation /
password sign-in is disallowed by policy, so **runtime verification this pass covers the
deployed site's public surfaces only** — signed-in surfaces are code/rules-verified (see
`next.md` §1).

### Code changes (7 files)

1. **Firebase errors → plain English.** `src/lib/firebaseError.ts` gains `firebaseErrorMessage(err, fallback?)`:
   maps the common **Firestore** codes (`permission-denied`, `unavailable`, `not-found`,
   `failed-precondition`, `resource-exhausted`, `unauthenticated`, `deadline-exceeded`,
   `aborted`, `invalid-argument`, `internal`, …) and **Storage** codes (`storage/unauthorized`,
   `storage/quota-exceeded`, `storage/retry-limit-exceeded`, `storage/object-not-found`, …) to
   sentences, and never returns raw `FirebaseError` / gRPC / "Missing or insufficient
   permissions." / "INTERNAL ASSERTION" text (a `looksRaw()` guard drops those to the
   fallback). `permissionAwareMessage()` kept as a thin wrapper that now delegates here — so
   every existing call site (`PlayersPage`, `TeamsPage`, `MatchSetupPage`, `UsersPage`)
   inherits the better fallbacks. `useAsync` load failures and `ScoringPage`'s `guard()` toast
   now route through it too. Auth errors already had their own rich mapping
   (`auth.service.ts` `authErrorMessage`, commit `aa9e4c8`) — untouched.
2. **Settings "other devices" copy → plain English.** `UserSettingsPage.tsx` — replaced the
   paragraph that name-dropped "Firebase's client SDK" / "server-side Admin SDK" with a
   user-facing sentence (same meaning: this is the only device shown here; change your
   password to lock others out; existing sessions expire on their own). It was never styled
   as an error, but it read like an internal note.
3. **Tab strip scroll fix.** `src/components/ui/Tabs.tsx` — `flex` → `flex flex-wrap`. The
   shared tab selector (Stats, `/browse` Matches/Tournaments/Teams, scorecard innings,
   Matches, Player, Tournament, Requests, Clubs) relied on `overflow-x-auto`, which a laptop
   mouse-wheel can't scroll and a tablet gives no affordance for — reported as "the 3-line
   tab selector doesn't scroll on laptop or iPad". Now overflowing tabs **wrap to a second
   row** instead of hiding; nothing is ever unreachable. On laptop/iPad every strip still
   fits on one row (no visual change there); only very narrow phones see a 2-row Stats strip.
   `overflow-x-auto` kept as a last resort for a single over-wide tab.
4. **Richer live-match cards.** Both the public home rail (`PublicHomePage.tsx`
   `LiveMatchCard`) and the signed-in dashboard widget (`DashboardPage.tsx` `live`) now show,
   beyond the old "one batting team + score":
   - **format + overs** (`T20 · 20 ov`),
   - the **full matchup** (`Team A vs Team B`) even before a ball is bowled or when only one
     innings has started (previously you couldn't tell who the batting side was playing),
   - **current run rate** per innings (`ALP 87/3 (9.4 · RR 8.97)`),
   - an **"Innings break · target N"** pill at the break,
   - a **run-chase line** in a live 2nd innings — `BRV need 46 off 30 · RRR 9.20` — via a
     small pure `chaseSituation()` / `liveChase()` helper (reads only denormalised
     match/innings state; returns null when it doesn't apply).
   No service/domain/scoring changes; display-only.

`domain/scoring.ts`, the `Delivery`/`BallInput` contracts, offline infrastructure, and
`firestore.rules` were **not** touched.

### Wagon Wheel / Pitch Map "disappearing" — investigated, not a bug
The input resetting per ball is by design; the tagged shot persists in
`ballMeta/{deliveryId}`, shows as a marker on the over strip, is re-editable by clicking the
ball, and renders on the scorecard. No change. Detail in `next.md` §5.

### Checks
`npx tsc -p tsconfig.app.json --noEmit` → 0. `npm run lint` → 0 errors (pre-existing
warnings only; none in the 7 changed files). `npm run build` → green.

### Deployment
- `firebase deploy --only hosting` to project **`cricket-platform-b03bc`** (Firebase CLI was
  already authenticated; no credentials handled by me).
- **Verified the deployed bundle**, not just the command exit: fetched the live site's
  hashed JS and confirmed it contains this pass's new strings (`need ` + `RRR`, the plain
  Settings copy) and the prior commits' markers, and that `firebase hosting` reports the new
  release. Details + release id in the final report / commit message.
- `firestore.rules`, indexes, and `storage.rules` were **deliberately not deployed** — see
  `next.md` §3.

### Runtime-verified on the DEPLOYED site (public only)
Home live-match cards render the richer layout; `/browse` + `/stats` tab strips wrap
correctly and stay single-row at desktop width; no page horizontal scroll at 375 or 1280;
clean console/network on the public routes swept.

### Files changed
- `src/lib/firebaseError.ts`, `src/hooks/useAsync.ts`,
  `src/features/scoring/ScoringPage.tsx`, `src/features/settings/UserSettingsPage.tsx`,
  `src/components/ui/Tabs.tsx`, `src/features/public/PublicHomePage.tsx`,
  `src/features/dashboard/DashboardPage.tsx`.
- `next.md` (rewritten as the open-problems handoff), `things done.md` (this section).

---

## Session 5 — Authenticated runtime audit (master-admin session) + 320px signed-in header fix

The owner supplied a signed-in **master-admin** session on the dev server, which unblocked the
authenticated end-to-end flows that Session 4 could only verify by code trace. Everything below was
driven for real in that session. **Account creation and password sign-in remain disallowed by
policy**, so the two matrices that *require* fresh/second accounts — FRESH NORMAL USER
(signup → role → first login) and USER A vs USER B cross-account security — are still **not
runtime-tested**; they are covered by code + route-guard + `firestore.rules` review only, and that
is stated plainly in the final report.

### 1. New bug found + fixed — 320px signed-in header (`AppShell`) overflow
The 320px pass on the authenticated shell found the header's right-hand control cluster measuring
**~409px in a 320px viewport** — `scrollWidth 409 > clientWidth 320` — so the avatar and the
name/role text block were clipped off the right edge (page had no h-scroll; the header just cut
its own content).
- `src/components/layout/AppShell.tsx`: cluster gap `gap-3` → `gap-2 sm:gap-3`; `BackgroundControl`,
  `TutorialButton` and the `text-right` name/role block each wrapped in `hidden sm:inline-flex` /
  changed to `hidden … sm:block` so they only render once there's room (Tailwind `sm` = 640px).
  The Search button + `⌘K` hint were already `sm:flex`. Explanatory comment added.
- Runtime-verified with the master-admin session at **320 / 375 / 390 / 430 / 768 / 820 / 1024**:
  `header.scrollWidth === header.clientWidth` at every width, no page horizontal scroll, avatar
  fully in view (right edge 304 at 320px). The hidden controls + name block reappear from 640px up
  (confirmed present at 768 / 1024). No change to any desktop layout.
- `tsc` 0 / `lint` 0 errors / `build` green.

### 2. Authenticated flows exercised for real
- **Full match, ball-by-ball** (`f7JeTq08eITZL6Gm16pM`, "ZZ Audit — New Batter regression",
  Audit Alpha v Audit Bravo, T10, 6-a-side, 5 wickets, auto-PP 2 ov):
  - Innings 1: Alpha **12/5 all out** (`closeReason:'all_out'`). Deliveries covered 1s, a 4, dots,
    a wide, and wickets of kind bowled / lbw / caught / run_out.
  - Innings break → target banner "Target: 13". Full scorecard rendered: batting + bowling cards,
    fall-of-wickets, ball-by-ball commentary, insights, wagon-wheel and line/length grid reflecting
    the tagged ball metadata.
  - Innings 2: Bravo **14/1**, `closeReason:'target'`, `result:"Audit Bravo won by 4 wickets"`.
  - Refresh → "Match complete" persists.
- **"New batter" regression** — at 4 down in each innings the modal listed **only the batting
  side's** remaining players (Alpha in inns 1: `hasBravo:false`; Bravo in inns 2: `hasAlpha:false`).
  Openers panel and the over-2 bowler modal were team-scoped the same way. Re-checked the setup
  wizard at 820px: labelled "AUDIT ALPHA ROSTER" / "AUDIT BRAVO ROSTER", zero cross-contamination.
- **Wagon wheel / pitch map (mobile touch)** — at a **430px** viewport, synthetic
  `PointerEvent`s with `pointerType:'touch'` dragged on both SVGs: the wheel set the shot zone
  ("Mid-wicket" → `zone`), the pitch map set `line` + `length`. **Save wrote
  `matches/{id}/ballMeta/i0-0000N`** where the doc id equals the delivery id, and **Ball 1's meta
  doc (`i0-00000`) was not modified** when Ball 3's was written (`createdAt` and values unchanged).
  Panel switched Add → Edit; next ball started with a fresh wheel. Test delivery + its meta doc
  cleaned up afterwards.
- **Auto powerplay** — `computeAutoPowerplayOvers` table matches the spec; live banner
  "Powerplay · over 1 of N (auto)" at T10 / T3; phase transitions active → complete via the engine.
- **Player management** — create → archive (persists across reload, "Archived" badge) → restore
  → move to Trash via the **in-app** `[role="dialog"]` ("Move to Trash"), not `window.confirm`.
- **Tutorial** — "Don't show this again" + Skip → `prefsStore.tutorialDismissed === true`
  (+ `localStorage` `crickethub.prefs` / `crickethub.tutorial.seen`); reload does not reappear.
- **Dark mode (signed-in)** — toggle flips 8 pages (dashboard, matches, players, teams, stats,
  scoring, settings, admin); `body` bg `rgb(2,6,23)`, 0 pure-white nodes, no h-scroll. Reset to
  light after testing.
- **Audit-log privacy (master side)** — `listMyAuditLogs(masterUid)` → all rows self-authored;
  `listAuditLogs()` unscoped → multiple actors. Non-master `permission-denied` is **rules-verified
  only** (no non-master session available to drive).

### 3. Authenticated responsive — 320 / 375 / 390 / 430 / 768 / 820 / 1024
Interaction, not just screenshots:
- Nav drawer opens at 256px with all 19 master-admin links, fully on-screen.
- Add-Player modal: full-width, fits viewport, does not overflow Y; all fields reachable; Cancel
  closes it.
- Match-setup wizard: step 1 (details) → step 2 (teams: picked Audit Alpha / Audit Bravo) → step 3
  (Playing XI) renders the roster/guest-grouped `SquadPicker` with no cross-team leak. Left without
  saving.
- Scoring score-pad: run buttons **115×64** (3×2 grid) at 430px, all in view, no overlap; Wicket
  + Undo in view. **Scored one ball via the UI at 430px** (7/0 → 8/0, strike rotated) then
  **Undid it** (back to 7/0) — both worked.
- Fixed sidebar (240px) appears at ≥1024; hamburger hidden; main content not clipped.

### 4. Media Library
Page loads clean: "0 images · 0 B", five folders (Player photos / Team logos / Club logos /
Tournament banners / User avatars), Upload button, drag-and-drop zone. **Real upload is NOT
testable in this environment:** `VITE_R2_WORKER_URL` is **unset** in `.env.local`, so
`uploadImage()` (which posts images to the Cloudflare R2 Worker, not Firebase Storage) short-
circuits *before any network call* with `ImageUploadError('Image uploads are not configured yet.')`.
Verified the failure path: dropping a synthetic PNG surfaced a friendly per-file toast
*"zz-audit-probe.png: Image uploads are not configured yet."* — no crash, no console error, no
error boundary.

### 5. Console / network sweep (authenticated)
18 signed-in routes + a scoring session, with `console.error` / `window.error` /
`unhandledrejection` / `fetch` all hooked:
- **0 app-level console errors, 0 failed app `fetch`s, 0 route crashes.**
- The **only** devtools errors are **Firebase Storage `listAll` CORS failures**
  (`firebasestorage.googleapis.com/v0/b/…/o?prefix=players/` — preflight blocked). This is
  **dev-only** (the `localhost:5173` origin isn't in the bucket's CORS allowlist) and is **already
  mitigated** by the circuit breaker in `src/services/storage.service.ts`: a single shared probe,
  its negative result cached in `sessionStorage` (`ch_fb_storage_list_unavailable` — **verified
  set to `"1"`**), so it's ~1 probe per browser session, not one per folder. The 3–4 identical
  lines are the Firebase SDK's own internal retry of that one probe, below app control. It's
  caught — the Media Library and every avatar gallery still render (from R2). **Not changed**: the
  only way to fully silence it is to drop the probe, which the code deliberately keeps so a
  newly-added CORS rule is picked up without a code change. Not present in a properly-CORS-
  configured deployment.
- The `/admin/tools` **"Client errors"** diagnostics panel lists **4 historical errors, all dated
  2026-08-29** (`ballMetaById is not defined`, `onLogout is not defined`, `LogOut is not defined`,
  `useNavigate is not defined`) — `ReferenceError`s from a broken WIP build that day. All resolved
  by later commits (`ballMetaById` is now a `useMemo` in `ScoringPage.tsx:130`; `onLogout` is gone
  from the source); **none since**. Not live bugs.

### 6. Regression re-check
- `4ee5aca` ("New batter" fix + 320px public header) — still holds: wizard roster/guest grouping
  and team-scoped "New batter" verified again in the live scoring UI this session.
- `441b4c7` (offline-safe admin check) — verified earlier this session on an isolated cold-offline
  client: `getDocs` resolves empty, `getDocsFromServer` throws `unavailable`, live
  `masterAdminStatus()` → `'exists'`.
- New `AppShell` change is `hidden … sm:*` only — identical render to before at ≥640px, confirmed
  at 768 / 1024.

### 7. Deployment status
`LOCAL FIXED`: `441b4c7`, `4ee5aca`, and this session's `AppShell` commit.
`PUSHED`: `master` (this session's push).
`DEPLOYED`: **nothing** — deploy was not authorized. The live site
`https://cricket-platform-b03bc.web.app/` does **not** contain these fixes.
`RUNTIME VERIFIED`: everything in §2–§6 above, on the local dev server.

### Files changed this session
- `cricket-platform/src/components/layout/AppShell.tsx` — 320px signed-in header: cluster gap +
  `hidden sm:*` on `BackgroundControl` / `TutorialButton` / name-role block.
- `cricket-platform/CHANGELOG.md`, `cricket-platform/ROADMAP.md` (Phase 44 + authenticated-audit
  subsection), this file.
- No test data left behind beyond the owner's own "Audit …" / "ZZ Audit …" fixtures; the one
  probe delivery scored during responsive testing was undone, and the one orphan `ballMeta` doc
  from the touch test was deleted.

---

## Session 4 — CricketHub Master Audit: three reported bugs (two already correct, one real)

Audited the three specifically-named bug reports. **Account creation and password sign-in are
disallowed by policy**, so authenticated end-to-end flows (real match creation, a full scoring
session, admin panels, User-A-vs-User-B comparisons) were verified by code trace + route-guard +
Firestore-rules review + pure-logic runtime tests against the app's real modules — not by driving
a signed-in session. This is called out honestly per feature below.

### 1. Reported bug #3 — "new signup users must be able to use core features" — ALREADY CORRECT
Traced the whole path; no code change.
- `SignupPage.tsx` calls `signup({ …, role: 'SCORER' })`, but `registerUser()` **ignores the
  requested role** and derives it: `MASTER_ADMIN` *only* for the reserved bootstrap username while
  no master exists, **otherwise always `SCORER`**. A signup POST with `role:'ADMIN'` still yields
  `SCORER`.
- `firestore.rules` independently pins self-signup to `request.resource.data.role == 'SCORER'`
  (or the master bootstrap). Defense in depth.
- `SCORER` can immediately: create players + teams (`canBuildRoster` includes `SCORER`, mirrored
  in rules' `canBuildRoster()`), create matches (`/matches/new` route allows `SCORER`), and score
  (`/scoring/:id` allows `SCORER`). Client role helpers in `authStore.ts` are commented as, and
  are, exact mirrors of the rules functions.
- `SCORER` **cannot** create tournaments — deliberate (`canCreateTournament` = master / `ADMIN` /
  `TOURNAMENT_MANAGER`, with a "Request Tournament Manager access" flow). Not a regression.
- New users are never auto-`ADMIN`, never `MASTER_ADMIN`, never `VIEWER`. `homeForRole('SCORER')`
  → `/dashboard`; `DashboardSwitcher` renders the plain dashboard for them.

### 2. Reported bug #6 — "normal user's Audit Log must show only their own events" — ALREADY CORRECT, backend-enforced
Traced Settings UI → hook → service → Firestore query → rules. No code change.
- `firestore.rules`:
  ```
  match /auditLogs/{id} {
    allow read: if isMasterAdmin()
                || (isSignedIn() && resource.data.actorId == request.auth.uid);
  }
  ```
  This is a **per-document** rule, so an *unscoped* `list` query by a non-master fails
  **`permission-denied` on the server** — it is not merely hidden in the UI.
- `UserSettingsPage.tsx` (reachable by every signed-in user) → `listMyAuditLogs(profile.id)` →
  `where('actorId', '==', uid)` — precisely what the rule permits; returns only the caller's rows.
- `listAuditLogs(200)` (unscoped, newest-first) is called **only** by `PlatformToolsPage.tsx`,
  whose route is `ProtectedRoute roles={['MASTER_ADMIN']}`. `/users`, `/requests`,
  `/admin/analytics`, `/admin/settings` are all `MASTER_ADMIN`-guarded too.
- Doubly safe: the UI always passes the caller's own uid, and the rule enforces self regardless
  of what uid is passed.

### 3. Reported bug #8 — "New batter modal shows players from BOTH teams" — REAL, FIXED
**The scoring screen's own filtering is correct and always has been.** `ScoringPage.tsx`:
```
battingSquad   = squadFor(match, inn.battingTeamId)      // match.squadA or match.squadB, by team id
incomingOptions = battingSquad
  .filter(pid => !battedOutIds.has(pid) && !atCrease.has(pid))
```
`squadFor` returns exactly one team's stored squad; dismissed batters (`battingCard` where `out`)
and the two at the crease are removed; retired-hurt (not `out`) correctly stays eligible to
return. `PlayerPickModal` renders that list verbatim. `OpenersPanel` and the `WicketModal`
fielder/batter lists are all squad-scoped the same way.

**The contamination is upstream, in the match setup wizard (`MatchSetupPage.tsx`):**
- `SquadPicker` rendered **every in-scope player** as one flat, unlabelled checklist — the team's
  own roster was merely *sorted* to the top, with no heading or divider. Ticking a few extra names
  (easy, and invisible as "these are the opponents") put opposition players into `squadA`.
- `toggleSquad` never prevented the **same player being ticked into both `squadA` and `squadB`**.

So a real match could persist `squadA` containing Bravo players, and the "New batter" list then
faithfully showed them.

**Fixes (all in `src/features/matches/MatchSetupPage.tsx`, nothing else):**
1. `toggleSquad(slot, pid)` — adding a player to one side now removes them from the other. The two
   squads can never overlap.
2. `SquadPicker` — candidates are split into a labelled **"{team} roster"** group and an
   **"Other players (guest)"** group. Guests are still available (a real feature) but selecting
   one is now a deliberate, visible act.
3. `SquadPicker` — anyone already selected for the *opposing* XI is hidden from this side's list,
   *unless* they're already ticked here (so a legacy overlapping match can still be cleaned up on
   edit).

No change to `src/domain/scoring.ts`, the `Delivery` / `BallInput` contracts, offline
infrastructure, or `firestore.rules`.

**Runtime verification** (browser, against the app's real `scoring.service.ts` module on the dev
server):
```
squadFor(match, 'ALPHA')  with squadA = [a1,a2,a3,a4, b1]   -> [a1,a2,a3,a4,b1]
incomingOptions (a1,a2 at crease; a3 out)                    -> [a4, b1]   // b1 LEAKS  (bug reproduced)
── with the squads the fix produces (squadA = [a1..a4]) ──
incomingOptions                                              -> [a4]      // batting team only
  dismissed a3 excluded: true   at-crease a1/a2 excluded: true
toggleSquad('A','x9')  when x9 ∈ squadB                      -> squadA gains x9, squadB loses x9
toggleSquad('A','x9')  again (untick)                        -> squadA loses x9, squadB unchanged (no bounce-back)
SquadPicker partition: b1,b2 (in other XI) hidden; g7 -> "Other players (guest)"; a1..a3 -> roster
legacy overlap (a3 in both, selected here)                   -> a3 stays visible so it can be un-picked
```

### 4. 320px public header — "Sign in" clipped
`resize_window` sweep of the public site found the "Sign in" button's right edge at **x≈333 in a
320px viewport** (~13px past the edge; it already fit from 360px up, which Session 3 covered).
- `PublicLayout.tsx`: header container padding `px-4` → `px-3 sm:px-4`; the "Sign in" link's
  leading `<LogIn>` icon is now `hidden min-[360px]:block` so the label itself is never cut.
- Re-measured: "Sign in" right edge x≈308 at 320px. No page-level horizontal scroll at
  320 / 375 / 768 / 1024 / 1920 on `/`, `/browse` (all tabs), `/stats`, `/search`, `/compare`,
  `/privacy`, `/terms`, `/match/:id`, 404. Dark-mode toggle round-trips (light `#f1f5f9` ↔
  dark `#020617`).

### 5. Checks
`npx tsc -p tsconfig.app.json --noEmit` → 0 errors. `npm run lint` → 0 errors (pre-existing
warnings only; none in the two changed files). `npm run build` → green. **Not deployed.**

### Files changed this session
- `cricket-platform/src/features/matches/MatchSetupPage.tsx` — `toggleSquad` mutual exclusion;
  `SquadPicker` roster/guest grouping + hide-opposing-XI.
- `cricket-platform/src/components/layout/PublicLayout.tsx` — 320px header padding + icon.
- `cricket-platform/CHANGELOG.md`, `cricket-platform/ROADMAP.md` (Phase 44), this file.

---

## Session 3 — Offline "no admin" REAL root cause, offline profile load, header responsive

### 1. The offline → "No admin account exists yet" bug — reproduced and root-caused at runtime
Session 2's fix assumed an offline Firestore `getDocs()` **throws**. It does not. With the
persistent local cache (`persistentLocalCache` in `lib/firebase.ts`), an offline query **resolves
successfully with an empty snapshot** (`{ empty: true, fromCache: true, size: 0 }`).

**Runtime reproduction** (`disableNetwork` + a cold in-memory Firestore client, no page auth):
```
coldOffline getDocs()            -> { empty: true, fromCache: true, size: 0 }   // resolves, no throw
coldOffline getDocsFromServer()  -> throws  code: "unavailable"                 // the real signal
OLD masterAdminStatus() logic    -> "missing"  => renders "No admin account exists yet"
NEW masterAdminStatus() logic    -> "unknown"  => renders the offline / retry state
```

**Fix (`src/services/auth.service.ts`):** `masterAdminStatus()` now calls **`getDocsFromServer()`**
— it forces a real round-trip and *rejects* with `unavailable` when the backend is unreachable, so
offline and "genuinely empty" are finally distinct. On failure it falls back to a **cache read
that can only ever answer `'exists'`** (a positive hit is trustworthy even offline); anything else
is `'unknown'`, **never `'missing'`**.

**Runtime verification of the fix (6 scenarios):**
| Scenario | Result | Expected |
|---|---|---|
| Online + admin exists | `exists` (464 ms) | `exists` |
| **Offline + cold cache (the bug)** | **`unknown`** | `unknown` (was `missing`) |
| Offline + warm cache w/ admin | `exists` | `exists` |
| Cold + offline | `unknown` | `unknown` |
| After `enableNetwork` (recovery) | `exists` | `exists` |
| Server reached, no match | `missing` | `missing` |

Real UI, app Firestore forced offline: navigating to `/setup` **redirected to `/login`** (cache
says an admin exists) and `/login` showed **no** "No admin account exists yet" banner. Console
clean — no raw "client is offline" string leaked.

### 2. `loadProfile()` / `observeAuth()` made offline-aware
`loadProfile()` (`getDoc` of `users/{uid}`) threw `unavailable` ("Failed to get document because
the client is offline") on a cold cache. Now: on an offline error it falls back to
`getDocFromCache`; it throws only when the cache has nothing either — so a caller can tell
"offline, unknown" from "no such profile" and won't self-heal a placeholder over a real profile.
`observeAuth()` retries an offline read, then leaves the app **ready** (Firebase session intact)
instead of stuck "initializing" or surfacing a raw error. New exported `isOfflineError(err)` helper
(matches `code: 'unavailable' | 'deadline-exceeded'` and the offline message text).

### 3. Public header responsive fix (`src/components/layout/PublicLayout.tsx`)
- **375 px:** "Sign in" wrapped to two lines and clipped. Now `shrink-0 whitespace-nowrap`;
  right-side controls are one `ml-auto` group; Background picker is `sm:`→`lg:`-only.
- **768 px:** the theme toggle and "Sign in" were pushed entirely off-screen (hidden by the
  page's `overflow-x`). Header search + Background picker are now `lg:`-only, so the tablet header
  is logo + nav + theme + Sign in — all visible.
- Verified at 375 / 768 / 1280: `scrollWidth === clientWidth` (no overflow), "Sign in" fully in
  the viewport and single-line at every width; full desktop header (nav + search + Background +
  theme + Sign in) intact at 1280.

### Checks (session 3)
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors**
- `npm run lint` → **0 errors**; 17 warnings, all pre-existing or Session 2's accepted
  `confirm.tsx` one (the `auth.service.ts` `no-useless-catch` at L307 is a pre-existing
  intentionally-documented rethrow, only its line number moved)
- `npm run build` → **green**
- Runtime: 6-scenario offline/admin matrix (above); all public routes (`/ /browse /stats /login
  /signup /recover /setup /search`) — no console errors, no horizontal overflow at 375/768/1280;
  real-UI offline check of `/login` + `/setup`.
- **Not deployed** (explicit instruction this session).

### Not verified at runtime (session 3)
The `SetupPage` "Can't reach the server" screen and `LoginPage` "no admin" banner in the *cold +
offline* real UI — staging a cold cache while the running app holds the IndexedDB open isn't
clean. The underlying `masterAdminStatus() → 'unknown'` is runtime-proven; the `'unknown' →
unreachable screen` mapping in `SetupPage`/`LoginPage` is small and typecheck-verified.
Everything behind auth (see standing blocker below).

---

## Session 2 — Offline-safe admin check, canonical Switch, `confirm()` sweep, landing polish

### 1. Offline / auth bug: "client is offline" was read as "No admin account exists yet"
**Root cause:** `masterAdminExists()` ran a Firestore `getDocs()` and let any throw
(offline, `unavailable`, permission-denied) propagate. Callers treated the failure as
"no admin found" — `SetupPage` rendered the first-admin bootstrap form, `LoginPage`
showed the "No admin account exists yet → Set up the first admin" banner.

**Fix:**
- `src/services/auth.service.ts` — new `masterAdminStatus(): 'exists' | 'missing' | 'unknown'`.
  A definitive empty query → `'missing'`; any error → `'unknown'`.
- `masterAdminExists()` kept as a back-compat boolean that **fails closed**
  (`'unknown'` → `true`), so `registerUser`'s master-bootstrap guard can't fire on a flaky read.
- `src/features/auth/SetupPage.tsx` — three phases: `checking` / `ready` / `unreachable`.
  `'unknown'` shows a "Can't reach the server — Try again" screen (with a note that this is a
  connection problem and does **not** mean the platform has no admin), never the bootstrap form.
  `onSubmit` re-checks status and refuses to create the master on `'unknown'`.
- `src/features/auth/LoginPage.tsx` — the setup nudge now shows only on a definitive `'missing'`.

### 2. Canonical `<Switch>` component (toggles looked like a solid blue pill)
**Root cause:** four separate hand-rolled toggle markups; the thumb had no shadow/ring and in
some states matched the track, so the control read as a plain pill.

**Fix:**
- `src/components/ui/primitives.tsx` — new `Switch`:
  rounded track, always-white circular thumb with `shadow-sm` + `ring-1 ring-black/5`,
  20px slide between ends, `role="switch"` + `aria-checked`, keyboard-operable,
  compact `focus-visible` ring (no full-element outline), `disabled` state,
  `bg-brand-600` (on) / `bg-ink-300 dark:bg-ink-700` (off) — correct contrast in light and dark.
- Replaced the ad-hoc toggles in: `UserSettingsPage` (`ToggleRow`), `SettingsPage`
  (maintenance mode), `FeatureFlagsPage` (per-flag enable), `MatchSetupPage` (`ToggleRow`).

### 3. `window.confirm()` → app modal, everywhere in a user path
- `src/components/ui/confirm.tsx` — new `confirmDialog(opts): Promise<boolean>` (imperative,
  promise-based drop-in for `window.confirm`) backed by a tiny zustand store, plus a single
  `<ConfirmHost/>` mounted in `src/App.tsx`. Renders the existing `<ConfirmDialog>` (centered,
  backdrop, title, explanation, Cancel + labelled destructive button, focus handling, dark/light).
- Converted 11 call sites (kept each site's `if (!(await confirmDialog(...))) return` shape):
  `MatchesPage`, `TeamsPage`, `TournamentsPage`, `ClubsSeasonsPage` (club + season),
  `InvitationsPage`, `CommentSection`, `EntityGallery`, `DownloadsPanel`, `AnnouncementsPanel`,
  `VersionHistoryModal`.
- Combined with Session 1's conversions (`ScoringPage`, `MediaLibraryPage`) and earlier work
  (`UsersPage`, `MatchSetupPage`), **no `window.confirm()` remains in a user-facing path.**
  The only `confirm` identifier left is `PlatformToolsPage`'s local `async function confirm()`,
  which is already a custom type-to-confirm modal.

### 4. Public landing page
- `src/features/public/PublicHomePage.tsx` — hero: eyebrow "LIVE CRICKET SCORING" pill,
  larger headline, two decorative cricket-ball seam rings, and a row of **real** platform
  counts (matches / players / tournaments) — each rendered only once its source has loaded and
  is non-zero (no invented data). Friendlier "no live matches" empty state (icon + two lines).

### Checks (session 2)
- `npx tsc -p tsconfig.app.json --noEmit` → **0 errors**
- `npm run lint` → **0 errors**; one new dev-only `react-refresh/only-export-components` warning
  on `confirm.tsx` (same accepted pattern as the existing `toast.tsx`)
- `npm run build` → **green**
- Runtime (public routes + isolated component mounts against the app's own React):
  landing page renders light + dark with no horizontal overflow; `<Switch>` renders 3 states,
  `aria-checked` flips on click, `onChange` fires, thumb travels 2px→22px.

### Not verified at runtime (session 2)
Auth-gated — no test credentials in this environment: the `<Switch>` *inside* Settings /
FeatureFlags / MatchSetup, the converted confirm dialogs on the admin/list pages, and the
`SetupPage` offline branch (the logic is code-verified; `/login` was checked on the public side).

---

## Session 1 — Interactive scoring inputs, dark background, tutorial opt-out (committed `e0aee79`)

- **Wagon wheel (`WagonWheelInput`)** — upward "down the ground" swipe is a first-class gesture;
  on release the ray draws out from the batter and the marker travels along it to the landing
  sector (re-keyed SMIL, replays on commit and on reconstruction; dropped under reduced-motion).
  Pointer gate hardened with a `useRef` mirror so a fast flick / tap also commits.
  Runtime-verified: upward swipe → Zone 5 "Long-off"; tap → zone; reconstruction repositions +
  replays without re-firing `onChange`.
- **Pitch map (`PitchLengthInput`)** — every line column and length row labelled on the pitch
  itself, plus "Bowler" / "Batter's end"; taller pitch; SMIL drop-in animation; same ref
  hardening. Runtime-verified: drag → `{good, outside_off}`; reconstruction works.
- **Invalid SMIL `keySplines` bug fixed** — the marker/drop animations used bézier control
  points with y > 1 (CSS-style overshoot), which SMIL rejects, logging
  `<animate> attribute keySplines: Invalid value` on every marker render. Replaced with in-range
  ease-out splines; the "settle" is a 3-stop `values` list. Verified: live DOM scan finds zero
  out-of-range `keySplines`; post-`console.clear()` sentinel run is clean.
- **Dark mode root cause (`BackgroundLayer`)** — dark mode kept the light preset gradient and
  laid a `mix-blend-mode: multiply` overlay over it → a flat washed grey unrelated to the
  `ink-900/950` chrome. Now builds the dark base from the ink token scale
  (`#020617 → #0f172a → #020617`); an already-dark custom pick (luminance < 0.22) is honoured
  as-is; light mode byte-for-byte unchanged. Verified: fresh light, fresh dark, and the header
  toggle both ways. Also filled `dark:` gaps on the match-setup stepper, scoring callout pills,
  `PlatformToolsPage` danger zone, `ScoringModals`.
- **Tutorial "Don't show this again"** — new per-user `tutorialDismissed` pref (syncs via
  `userPrefs/{uid}`); `TutorialButton` footer checkbox; auto-open still fires for users who
  haven't dismissed it; still replayable from the Help button; tutorial content intact.
- **`confirm()` → `<ConfirmDialog>`** in `ScoringPage` (reopen / end-innings / abandon) and
  `MediaLibraryPage` (image delete).
- **Duplicate-player heads-up** in `PlayerFormModal` (non-blocking amber note on a same-name
  active player), wired from `PlayersPage` and `MatchSetupPage`.
- Next-ball reset (Wagon Wheel / Pitch Map) verified by code trace: scoring a ball sets
  `pendingMeta` to `null` (unmounts `ShotDetailPrompt`) then to the new delivery id, so the
  inputs remount fresh; the completed ball's `ballMeta` persists and is reconstructed on
  `openEditMeta`.
- Checks: `tsc` 0 errors, `lint` 0 new warnings, `build` green.

---

## Standing environment blocker (both sessions)

There is **no authenticated Firebase session** available in this environment, the browser
extension is not connected, and creating an account / entering a password is disallowed.
So the signed-in surface — Dashboard, Match setup wizard, Live scoring screen, Players, Teams,
Tournaments, Clubs, Admin (Requests / Users / Platform Tools / Media Library / Platform
Settings / Feature Flags), Trash, Settings — could be audited and fixed **by code**, and its
public-facing and isolated-component behaviour verified at runtime, but the end-to-end
signed-in workflows (persistence round-trips, player delete/suspend, premium grant/revoke,
diagnostics load, media upload) were **not** exercised live in this pass.
