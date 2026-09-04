# Mobile & tablet UX audit — CricketHub

Scope: the screen recording you attached (`ScreenRecording_09-03-2026 22-22-42`), plus a
full read of the layout/shell/primitive code and a responsive sweep of the running app.
Layout and typography only — **no change to `src/domain/scoring.ts`, any `src/services/*`
file, authentication, or `firestore.rules`.**

---

## 0. Honest constraint up front — what is runtime-verified vs code-only

**I could not sign in.** The master session on the deployed site had expired, the local dev
server points at the same Firebase project (so no local session either), and I am not
permitted to type a password to authenticate. Every attempt to reach `/dashboard`,
`/settings`, `/scoring/*`, `/matches/new` redirects to `/login`.

Consequence:

| Surface | How it was verified |
| --- | --- |
| Public pages (`/`, `/stats`, `/player/*`, `/team/*`, `/match/*`, `/login`) | **Runtime** — screenshots at 320 / 390 / 768 px, light + dark |
| Shared primitives (`StatCard`, `PageLoader`, `Modal`, `PageHeader`, `LeaderboardCard`, `ActivityFeed`, standings table) | **Runtime** on the public pages that render them |
| `AppShell` drawer, `DashboardPage`, `UserSettingsPage`, `ScoringPage`, `MatchSetupPage`, signed-in `ActivityFeed` with data | **Code only** — read the source, cross-referenced the video frames, fixed, type-checked and built. Not exercised in a browser. |

Where a fix below is code-only, it says so.

---

## 1. Every root problem identified from the video

1. Mobile nav drawer behaves like a squeezed desktop sidebar — near-full-width, page
   underneath looks compressed, no clear overlay/backdrop model.
2. Text squishing across cards, KPI tiles, headings and metadata — content forcing
   containers wider than their column, or clipping.
3. Activity/"audit" feed appears to show platform-wide entries to a Scorer account —
   possible data-access boundary problem.
4. Activity cards are too dense on a phone — weak title/timestamp hierarchy, small targets.
5. "Checking session…" / "Loading…" full-screen spinners flash on a blank page during
   navigation and after sign-in.
6. Settings controls (text-size / theme / density segmented pickers, toggle rows) are
   cramped and hard to tap on a phone.
7. Stats / analytics page is a shrunk desktop layout — filter bar, KPI row and dark-mode
   contrast don't adapt.
8. iOS Safari: `100vh` and missing safe-area handling → content behind the URL bar / notch /
   home indicator; bottom sheets clipped.
9. Match-setup wizard on a phone — step labels vanish with no "where am I", small squad
   checkboxes, tiny "+ add" links.
10. Live-scoring screen thumb usability — keyboard hints as visual noise, some sub-44 px
    controls, sticky summary offset.
11. Dark mode — coloured card headers, dividers and secondary panels with no dark variant
    (gray-on-gray / invisible borders).
12. Touch targets — icon-only toggles and nav rows below the ~44 px guidance.

---

## 2. Root cause of each

1. **Drawer.** The drawer was `fixed` already, but had no body-scroll lock, no route-change
   or `Esc` close, an unclamped width, and its `<nav>` didn't scroll independently — so on a
   short phone the master admin's ~17 items pushed the column past the viewport and the whole
   thing felt like a stretched sidebar rather than a modal panel.
2. **Text squishing.** `StatCard`'s inner text column had no `min-w-0`, so in a
   `grid-cols-2` cell the label's intrinsic width won and widened the card past its column.
   `PageHeader` had the same missing `min-w-0` on its title block. The Dashboard "Live
   matches" widget printed each innings as a single `whitespace-nowrap` span.
3. **Not a bug.** See §8. The feed in the video is the intentionally world-readable
   `activity` collection (cricket events), not `auditLogs`. The seed rows are only *named*
   "Audit Alpha/Bravo".
4. **Activity cards.** Icon, message and timestamp were on one line at `text-[11px]` with
   `space-y-1` — no hierarchy, ~24 px rows.
5. **Session loading.** Architecture is fine — one guarded auth listener, no duplicate
   `onSnapshot`, `status:'initializing'` only gates the cold start. The *presentation* was
   the problem: `PageLoader` is a small spinner with `py-20` on an otherwise blank page, and
   `DashboardPage` gated its entire body on four parallel collection reads behind the same
   bare spinner — so a fresh sign-in showed two blank spinner screens back-to-back.
6. **Settings.** Text-size picker was a hard `grid-cols-4` ("Small/Normal/Large/X-Large"
   in ~70 px cells), segmented buttons were `py-2` (~36 px), and `ToggleRow`'s text column
   lacked `min-w-0` so a long hint shoved the switch toward / past the screen edge.
7. **Stats.** Filter bar was `flex flex-wrap items-center gap-3` with inline
   label+select pairs and `h-9 w-auto` selects — fine on desktop, cramped and misaligned
   when wrapped on a phone. KPI grid used a fixed `gap-4`. "How impact is scored" cards and
   `LeaderboardCard` dividers had light-only colours.
8. **iOS Safari.** `min-h-screen` / `100vh` = the *large* viewport (excludes the dynamic URL
   bar), and `index.html` had no `viewport-fit=cover`, so `env(safe-area-inset-*)` were all
   `0` and nothing accounted for the notch / home indicator. `Modal` used `max-h-[92vh]`.
9. **Match setup.** Step labels are deliberately `hidden sm:inline` to fit the stepper on a
   phone, but nothing replaced them, so a phone user only saw numbered circles. Squad rows
   were `py-1.5` (~34 px). "+ Add team/player" were bare `text-xs` links.
10. **Scoring.** The `<kbd>` shortcut badges render unconditionally even though the component
    already knows touch is primary (`onShowShortcuts` is `undefined` then). Extra-type
    buttons were fixed `h-11` with `text-sm` — "Leg bye" is tight in a 4-up grid at 320 px.
    The sticky score summary was `top-16`, a hard 64 px that ignores the safe-area header.
11. **Dark mode.** Several components predate the dark-mode pass: Dashboard's 5 coloured
    widget headers, `LeaderboardCard` (`divide-ink-50`), the Stats explainer cards
    (`bg-ink-50/60`), Settings segmented-control active states.
12. **Touch targets.** `ThemeToggle` is a 32 px pill; nav rows were `py-2.5` with no floor;
    the hamburger was icon-sized.

---

## 3. Fix applied for each

1. **Drawer** — `AppShell`: overlay unchanged as `fixed` (page keeps its width); added
   `document.body.style.overflow='hidden'` while open, close on `location.pathname` change
   and on `Escape`, width `w-[min(18rem,calc(100vw-3rem))]`, `<nav>` →
   `min-h-0 flex-1 overflow-y-auto overscroll-contain`, `SidebarInner` →
   `flex h-full min-h-0 flex-col pt-safe`, every nav row and the "Public site" link and the
   hamburger → ≥ `2.75rem`.
2. **Text squishing** — `StatCard`: `min-w-0` on the text column, `[overflow-wrap:anywhere]`
   on the label, `text-xl sm:text-2xl` value / `text-[13px] sm:text-sm` label, `shrink-0`
   icon. `PageHeader`: `min-w-0` title block, `text-xl sm:text-2xl` + wrap, `sm:shrink-0`
   actions. Dashboard live innings lines → `space-y-0.5` stacked `tabular-nums` rows.
3. **No code change** — documented (§8).
4. **Activity cards** — `ActivityFeed`: `divide-y` rows at `py-3`, 8 px icon chip,
   `text-sm font-medium` message on its own line, `text-xs` timestamp beneath, filter chips
   `min-h-[2rem]` + `flex-wrap`.
5. **Session loading** — `PageLoader` → `min-h-[40vh]` centred + `dark:text-ink-400`.
   `DashboardPage` → `<DashboardSkeleton />` (header bar + 4 tiles + 2 columns, `animate-pulse`)
   instead of the bare spinner.
6. **Settings** — text-size `grid-cols-2 sm:grid-cols-4`; theme / text-size / density buttons
   `flex min-h-[2.75rem] items-center justify-center` + dark active state
   (`dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200`); `ToggleRow` text column
   `min-w-0`, icon `shrink-0`, switch `shrink-0`; "Recent activity" loading → 3-row skeleton;
   session row `flex-col … sm:flex-row`.
7. **Stats** — `StatsPage`: filter bar `grid grid-cols-2 gap-3 sm:flex sm:flex-wrap
   sm:items-end`, each pair `flex-col gap-1 sm:flex-row`, each select
   `h-11 w-full … sm:h-9 sm:w-auto`; KPI grid `gap-2.5 sm:gap-4`; explainer cards +
   `LeaderboardCard` dividers get `dark:` variants. `App.tsx` `StatsRoute` anonymous branch
   wrapped in `px-4 py-6 sm:px-6`.
8. **iOS Safari** — `index.html`: `viewport-fit=cover` + `theme-color`. `index.css`: `#root`
   `min-height:100dvh` (with `100vh` fallback) + `.pt-safe` helper. `AppShell` /
   `WorkflowShell` / `PublicLayout`: `min-h-dvh`, header `min-h-14 … pt-safe`, `<main>` and
   scoring footer `pb-[max(1.5rem,env(safe-area-inset-bottom))]`. `Modal`:
   `max-h-[92dvh]`, footer `pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3`,
   no-footer bottom spacer, `overscroll-contain` body, ≥36 px close button.
9. **Match setup** — `MatchSetupPage`: mobile-only `Step {n} of {total}: {label}` line;
   squad rows `min-h-[2.75rem]` + list `overscroll-contain`; "+ Add team" / "+ Add player"
   → `inline-flex min-h-[2.25rem] items-center py-1 text-sm`; stepper button hit area
   `-my-1.5 py-1.5`; local `ToggleRow` `min-w-0` fix.
10. **Scoring** — `ScorePad`: all `<kbd>` badges gated on `onShowShortcuts` (present only for
    fine-pointer); extras → `px-1 text-center text-[13px] leading-tight sm:text-sm` + dark
    active; footer action buttons → `min-h-[2.5rem] py-2` + `flex-wrap`. `ScoreHeader` sticky
    offset → `top-[calc(3.5rem+env(safe-area-inset-top))]`.
11. **Dark mode** — Dashboard's `live` / `recent` / `upcoming` / `topRuns` / `topWickets`
    card borders + `CardHeader` bg + title colours get `dark:` pairs; `LeaderboardCard`
    `divide-ink-100 dark:divide-ink-800`; Stats explainer cards
    `dark:border-ink-800 dark:bg-ink-800/40 dark:text-ink-300`; `ThemeToggle` dark knob
    `dark:bg-ink-100` + `text-brand-600` moon + `dark:bg-ink-700` track.
12. **Touch targets** — `ThemeToggle` `after:absolute after:-inset-2` (visual pill stays
    32 px, hit area ≈ 48 px); nav rows / hamburger / "+ add" / squad rows / segmented
    controls / scoring footer all raised to 40–44 px as above.

---

## 4. Files changed (17)

| File | What |
| --- | --- |
| `index.html` | `viewport-fit=cover`, `theme-color` |
| `src/index.css` | `#root` `100dvh`, `.pt-safe` helper |
| `src/App.tsx` | `StatsRoute` anonymous gutter |
| `src/components/layout/AppShell.tsx` | drawer overlay model, scroll-lock, Esc/route close, safe-area, touch rows, `min-h-14` header |
| `src/components/layout/WorkflowShell.tsx` | `min-h-dvh`, `min-h-14 pt-safe` header, safe-area `<main>` |
| `src/components/layout/PublicLayout.tsx` | `min-h-dvh`, `pt-safe` header |
| `src/components/ui/Modal.tsx` | `92dvh`, safe-area footer + spacer, `overscroll-contain`, bigger close |
| `src/components/ui/PageHeader.tsx` | `min-w-0`, `text-xl sm:text-2xl`, wrap, `sm:shrink-0` actions |
| `src/components/ui/primitives.tsx` | `PageLoader` centring + dark; `StatCard` `min-w-0` / wrap / responsive sizing |
| `src/components/ui/ThemeToggle.tsx` | invisible hit area, dark knob/contrast |
| `src/components/activity/ActivityFeed.tsx` | row hierarchy, spacing, chip sizing |
| `src/components/stats/LeaderboardCard.tsx` | dark dividers, sub-text contrast |
| `src/features/dashboard/DashboardPage.tsx` | `DashboardSkeleton`, dark widget headers, KPI gutter, stacked innings lines |
| `src/features/stats/StatsPage.tsx` | filter bar stack, KPI gutter, dark explainer cards |
| `src/features/settings/UserSettingsPage.tsx` | segmented pickers, `ToggleRow`, activity skeleton, session row |
| `src/features/matches/MatchSetupPage.tsx` | mobile step label, squad rows, "+ add" controls, `ToggleRow`, stepper hit area |
| `src/features/scoring/ScoringPage.tsx` | kbd gating, extras fit, footer targets, sticky offset |

CHANGELOG.md updated. Nothing staged/committed/deployed yet — awaiting your go.

---

## 5. Mobile viewports tested

| Width | Pages | Result |
| --- | --- | --- |
| **320 px** | `/`, `/stats` (light + dark), `/stats` Teams tab | No horizontal page scroll. KPI tiles wrap labels (no squish). Filter selects full-width 44 px. Standings table has its own `overflow-x-auto` (fits at 286 px). Tab strip wraps to 2 rows. Header (logo + toggle + Sign in) not clipped. |
| **390 px** | `/stats` (light + dark), `/player/*` | KPI row clean, `LeaderboardCard` rows and sub-text legible in both themes, filter bar a tidy 2-up. |
| 375 / 430 px | Not separately screenshotted; same layout class as 390 with more slack — no fixed widths in the changed code that would behave differently between 375 and 430. |

Signed-in phone widths (drawer, dashboard, settings, scoring, match setup): **code-only**,
per §0.

---

## 6. iPad / tablet viewports tested

| Width | Pages | Result |
| --- | --- | --- |
| **768 px** (portrait) | `/player/*` light + dark, `/login` | Full public nav shows (`md:flex`). Two-column stat tables side by side. Wrapping tab strip on one/two rows, no horizontal scroll. Dark mode: cards `dark:bg-ink-900` with visible borders, white headings, legible `—`/secondary text. Login card centred and unclipped. |
| 820 / 1024 px | Same layout family as 768 (next breakpoint is `lg` 1024 for the signed-in sidebar, which I can't load). Public pages scale up cleanly from the 768 check; no tablet-specific fixed widths were introduced. |

Signed-in iPad (sidebar visible at `lg`, dashboard grid `lg:grid-cols-3`): **code-only**.

---

## 7. Scorer / audit-log security findings

**No vulnerability. No code change made.** A normal Scorer cannot retrieve platform-wide
audit records — the boundary holds at three independent layers:

1. **Route** — `listAuditLogs()` (unfiltered) is called only in `PlatformToolsPage`, which
   is inside `<ProtectedRoute roles={['MASTER_ADMIN']}>`.
2. **Firestore rules** — `match /auditLogs/{id}` allows read only
   `if isMasterAdmin() || (isSignedIn() && resource.data.actorId == request.auth.uid)`.
   A Scorer requesting another user's audit doc is denied server-side.
3. **Query** — the Settings-page path uses `listMyAuditLogs(uid)` =
   `where('actorId','==', uid)`, so it can only ever ask for the caller's own rows.

The feed shown in the video is a **different collection**: `activity`
(`match_created`, `player_created`, `century`, `half_century`, `five_wicket_haul`, …).
`firestore.rules` intentionally has `allow read: if true` on it because it powers the
**public** club / team / player / tournament pages. Those are cricket events, not access
logs, and contain no other user's account data. The seed rows are simply *named* "Audit
Alpha" / "Audit Bravo" (team names), which is what makes the feed *look* audit-ish.

**Could not test with real Master / User A / User B accounts** — see §0 (cannot sign in).
The verification above is code + rules reading. If you want belt-and-braces, the one thing
worth doing when you're next signed in as a plain Scorer: open DevTools console and run a
`getDocs` against `auditLogs` with no `where` clause — it should throw
`permission-denied`.

---

## 8. Text / layout problems fixed

- `StatCard` label squish in 2-up grids (the "Tournaments" case) — `min-w-0` + wrap +
  responsive sizing, **not** a font shrink for its own sake.
- `PageHeader` long titles could overflow their block — `min-w-0` + `[overflow-wrap:anywhere]`.
- Dashboard "Live matches" innings string was one `whitespace-nowrap` span — now stacked rows.
- Settings text-size selector crammed 4 buttons across a phone — now 2×2 below `sm`.
- Settings / Match-setup `ToggleRow` long hints pushed the switch off-screen — `min-w-0`.
- Stats filter bar misaligned when wrapped — proper mobile stack with labels above controls.
- Scoring extra-type buttons ("Leg bye") tight at 320 px — `text-[13px] leading-tight`, wrap-safe.
- `/stats` for signed-out users sat flush against the screen edge — added the page gutter.
- Activity rows had no visual hierarchy — message / timestamp split onto separate lines.

**Found in passing, NOT changed** (out of the "no unrelated changes" scope, flagging for you):
`/player/*` header renders `LHB · undefined` — the bowling-style half of that line prints the
literal string `undefined` when a player has no bowling style set. It's a one-line template
fix in `PlayerPage` (guard the second half) whenever you want it.

---

## 9. Performance problems found

- **Auth init:** clean. One `onAuthStateChanged` listener, guarded by an `initialized` flag;
  a single `getDoc` for the profile with a 4× retry that only fires on offline errors; no
  duplicate Firestore listeners. `status:'initializing'` blocks protected routes only on the
  cold start, never on client-side navigation.
- **The real cost is perceived, not actual:** `DashboardPage` fetches `listAllMatches`,
  `listPlayers`, `listTeams`, `listTournaments` in parallel on mount and blocks the whole page
  on all four. That's unchanged (it needs the data), but it now renders a skeleton instead of
  a blank spinner so it *feels* immediate. A later optimisation, out of scope here, would be to
  render each widget independently and let them resolve on their own.
- No layout thrash / large-list rendering issues seen in the changed components.
- `vite build` is green; the only warning is the pre-existing `vendor-firebase` chunk size
  (Firebase SDK), untouched by this work.

---

## 10. Runtime-verified vs code-only — explicit list

**Runtime-verified (browser, screenshots):**
- `/stats` public — 320 px light, 320 px dark, 390 px light, 390 px dark, Teams/standings tab
- `/` public home — 320 px
- `/player/*` — 768 px light + dark
- `/login` — 768 px
- `PageLoader` new look — seen mid-load at 320 and 768
- `StatCard`, `LeaderboardCard`, `PageHeader`, standings `overflow-x-auto`, `PublicLayout`
  header safe-area, wrapping tab strips — all on the above pages
- No horizontal page overflow at any tested width (checked `documentElement.scrollWidth ===
  clientWidth` **as a sanity check only**, alongside eyeballing each screenshot)

**Code-only (read + reason + typecheck + build; NOT run):**
- `AppShell` mobile drawer behaviour (scroll-lock, Esc/route close, independent nav scroll,
  clamped width, safe-area) — the shell only mounts for a signed-in user
- `DashboardPage` skeleton + dark widget headers + stacked innings lines
- `UserSettingsPage` — every change
- `MatchSetupPage` — every change
- `ScoringPage` — every change (kbd gating, extras, footer, sticky offset)
- `WorkflowShell` `min-h-14 pt-safe` header (scoring only)
- `Modal` on signed-in screens (verified structurally, not opened in a browser)
- signed-in `ActivityFeed` with real data + filter chips

---

## 11. Remaining blockers

1. **Cannot sign in** (expired session + password-entry not permitted). Everything in the
   "code-only" list above needs a human with a Master or Scorer login to confirm on a real
   phone / iPad — especially: drawer open/close feel, the dashboard skeleton→content
   transition, the scoring score-pad at 375/390/430, and the match-setup wizard end to end.
2. **Fresh accounts** for the User-A / User-B audit-isolation test couldn't be created (same
   reason). The §7 finding rests on code + rules review.
3. **375 / 430 / 820 / 1024 px** weren't each screenshotted individually — 320 / 390 / 768
   were, and the changed code has no width-specific branches between those and the untested
   widths, but a full device-lab pass is still worth doing before release.
4. **Deploy** not done — you didn't ask for one this round and the authenticated pages can't
   be verified until someone signs in. When you're ready:
   `npm run build && firebase deploy --only hosting` (rules/indexes already live from the
   previous round; no rules change here).

---

## 12. tsc / lint / build results

```
npx tsc -p tsconfig.app.json --noEmit   → exit 0, no errors
npm run lint  (oxlint)                   → 0 errors; only pre-existing warnings
                                          (exhaustive-deps, no-useless-catch in
                                          auth.service.ts, fast-refresh export hints,
                                          unused `maxOvers` in scoring.ts) — none in
                                          files changed here
npm run build (tsc -b && vite build)     → ✓ built in ~1.4s; only the pre-existing
                                          vendor-firebase chunk-size warning
```

All three gates pass. No new warnings introduced.
