# Things done — CricketHub improvement pass

Running log of the work completed across this improvement pass. Newest section first.
All application code lives in `cricket-platform/`. The ball-by-ball scoring engine
(`src/domain/scoring.ts`) and `firestore.rules` were **not** modified.

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
