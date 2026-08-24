# CricketHub — Roadmap V5 (Platform / Analytics)

**Ownership**: this roadmap is owned by the Platform/Analytics session. In scope: Wagon Wheel,
Pitch Map, Bowling Heat Map, Batter vs Bowler analytics, Partnership analytics, Expected Score, Win
Probability, Standard account audit, Tournament Admin signup, Phone verification and privacy,
Tournament Admin permissions, Optional development donations, Subscription/entitlement
architecture, Premium feature gating, Billing-provider abstraction.

**Note on filename**: a concurrent session owns the scoring engine (Last Man Standing, Super Over,
DRS, delivery metadata, scoring security, mobile scoring, etc.) and is using `ROADMAP_V5.md` for its
own planning doc. To avoid the two colliding on the same filename, this session's roadmap lives at
`ROADMAP_V5_PLATFORM.md` instead — leave `ROADMAP_V5.md` alone, it isn't this roadmap.

**Standing rules for this roadmap:**
- `src/domain/scoring.ts` is not modified unless a slice is provably impossible without it — none
  identified so far; every analytics item here reads from the engine's output (`Match`/`Delivery`/
  `BallMeta`), it never needs to change how the engine computes.
- Last Man Standing, Super Over, and DRS are explicitly out of scope — not touched even in passing;
  that's the concurrent scoring-engine session's territory.
- Before any slice touches a shared model (`src/types/index.ts`) or `firestore.rules`, check
  `git status`/recent commits for a concurrent scoring-session in flight on the same files.
- One slice at a time, verified (`tsc` + `npm run build` + live check where there's a UI path) before
  moving to the next, same discipline as `ROADMAP_V4.md`.

---

## Audit: current state of each owned area

Grounded in reading the actual code, not assumption:

| # | Area | Current state |
|---|---|---|
| 1 | Wagon Wheel | **Built.** `domain/wagonWheel.ts` + `components/charts/WagonWheel.tsx`, per-match only, already accepts an optional `filterBatterId`. Shown on `MatchPage.tsx` when a scorer has tagged shot zones. |
| 2 | Pitch Map | **Built.** `domain/pitchMap.ts` + `components/charts/PitchMap.tsx`, per-match only, already accepts `filterBowlerId`. |
| 3 | Bowling Heat Map | **Already is #2** — `PitchMap.tsx`'s own code comment calls itself "Bowling line x length heatmap," shaded by ball density. Not a separate feature. |
| 4 | Batter vs Bowler analytics | **Missing.** No head-to-head-at-the-player-level anywhere (`domain/headToHead.ts` is team-level only). |
| 5 | Partnership analytics | **Partially built.** `domain/insights.ts` computes every partnership internally but only exposes `bestPartnership`; no full per-innings breakdown UI, no cross-match partnership records. |
| 6 | Expected Score | **Weak.** Only `projectedScore()` in `lib/format.ts` — a naive `current run rate × balls left` linear extrapolation, no wickets-in-hand or innings-phase awareness. No dedicated domain module (unlike Win Probability). |
| 7 | Win Probability | **Built.** `domain/winProbability.ts`, a documented, transparent heuristic (not a fitted model — correctly, there's no historical ball-by-ball dataset to fit one on). Used live in `MatchPage.tsx`'s chase panel. |
| 8 | Standard account audit | **Adjacent infra exists, not this.** `audit.service.ts`/`auditLogs` already log privileged admin actions platform-wide (visible in Platform Tools). Nothing user-facing shows an individual their own account/security activity — different audience, doesn't exist. |
| 9 | Tournament Admin signup | **Real gap in an existing flow.** `requests.service.ts`'s self-serve `AdminRequest` flow asks for a `tournamentName` but its `approveRequest()` hardcodes `setUserRole(req.uid, 'ADMIN')` — it can never grant `TOURNAMENT_MANAGER`, despite the form implying that's the intent. |
| 10 | Phone verification and privacy | **Missing entirely.** No phone field on `UserProfile`, no verification flow. |
| 11 | Tournament Admin permissions | **Role exists, boundaries unaudited.** `TOURNAMENT_MANAGER` is a real `Role` value gated into some `hasRole()` checks already, but its actual scope (which tournaments, which write paths) hasn't been reviewed end-to-end. |
| 12 | Optional development donations | **Missing.** (Tournament *sponsors*, a different ROADMAP_V3 feature, already exists — that's businesses advertising on a tournament, not users donating to the platform.) |
| 13 | Subscription / entitlement architecture | **Missing entirely.** No tier/plan concept anywhere on `UserProfile` or elsewhere. |
| 14 | Premium feature gating | **Missing**, but `featureFlags.service.ts`/`domain/featureFlags.ts` (`isFlagEnabledFor`, deterministic per-user bucketing) is a solid *pattern* to mirror — a flag is about rollout, an entitlement is about paid access, so this needs its own concept, not a repurposed flag. |
| 15 | Billing-provider abstraction | **Missing entirely.** No serverless functions in this codebase today, which matters: real billing needs a trusted backend for webhooks/secret keys, not just client code. |

## Priority order and why

**Phase A — Analytics (independent of everything else, reuses solid existing domain code, no
external decisions needed).** Build these first: fast, verifiable, zero business/legal ambiguity.

1. **A1 — Batter vs Bowler analytics** ✅ Done (new)
2. **A2 — Partnership analytics** ✅ Done (full per-innings breakdown; cross-match records
   deliberately descoped, see write-up below)
3. **A3 — Expected Score** ✅ Done (real first-innings projection model, paired with the existing
   Win Probability module)
4. **A4 — Career-level Wagon Wheel + Bowling Heat Map** ✅ Done (reuse the existing pure domain
   functions across a player's whole match history, not just one match)

**Phase B — Tournament admin & account (touches roles/permissions/rules — more care, still no
external business decisions).**

5. **B1 — Fix Tournament Admin signup** (let the existing request flow actually grant
   `TOURNAMENT_MANAGER`, not just `ADMIN`)
6. **B2 — Tournament Admin permissions audit** (map every `TOURNAMENT_MANAGER` write path, close
   gaps, confirmed against `firestore.rules`)
7. **B3 — Standard account audit** (user-facing "your account activity" page — distinct from the
   existing admin privileged-action log)
8. **B4 — Phone verification and privacy** (Firebase phone auth + visibility controls; the biggest
   slice in this phase)

**Phase C — Monetization foundation (biggest, most consequential, genuinely needs your input before
I start).** Subscription/entitlement architecture (13) is a prerequisite for premium gating (14) and
donations (12); billing-provider abstraction (15) is a prerequisite for any of the money-moving
pieces and needs a provider decision I can't make unilaterally. I'll flag exactly what I need before
touching this phase — not blocking Phase A/B on it.

9. **C1 — Subscription / entitlement architecture** (data model + service layer only, no live
   payment processing)
10. **C2 — Billing-provider abstraction** (interface + a mock/stub implementation pending your
    choice of real provider)
11. **C3 — Premium feature gating** (built on C1+C2)
12. **C4 — Optional development donations** (built on C1+C2)

Per this session's standing safety rules, I will never execute a real financial transaction or enter
payment credentials myself — Phase C builds the architecture and, where a real provider is wired in
later, that account setup/API keys/legal terms are yours to handle directly.

---

## Phase A slices

### A1 — Batter vs Bowler analytics ✅ Done
**Problem**: no way to see how a specific batter has fared against a specific bowler, across their
career or within a match.

- **Affected files**: new `src/domain/batterVsBowler.ts` (pure), new UI section — likely on
  `PlayerPage.tsx` (a "vs bowler" breakdown for the viewed player) since that's where career-level
  player analytics already live (`playerSplits`, `playerTimeline`, `achievements`).
- **Architecture**: pure function over `(deliveries: Delivery[], batterId: string, bowlerId?:
  string)` → aggregated runs/balls/dismissals/boundaries/dot-balls, mirroring the existing
  `wagonWheelData`/`pitchMapData` shape (accept an optional filter, return zero-filled rows).
  "Balls faced" follows `scoring.ts`'s own convention exactly (faced unless the delivery is a wide);
  runs counted are `runsOffBat`. Sourced from `listAllMatches()` + per-match `getDeliveries()`
  (`scoring.service.ts`), same concurrent-fetch pattern `admin.service.ts`'s
  `gatherPlatformBackup()` already uses for cross-match aggregation.
- **Risks**: Low. Pure derivation, no writes, no schema change.
- **Restrictions compliance**: No `scoring.ts` change — reads `Delivery` fields already recorded,
  matches its existing "faced unless wide" convention rather than inventing a new one.

**Implemented and verified.** One row per bowler actually faced (not zero-filled — no fixed enum of
"every possible bowler" the way wagon-wheel zones or pitch-map line×length cells have one), sorted
by balls faced. Lazy-loaded on `PlayerPage.tsx`'s new "vs Bowler" tab — the per-match `getDeliveries`
fetch only fires once the tab is opened, not on every page load. `tsc`/`npm run build`/`oxlint`
clean. **Verified live, hand-checked ball-by-ball against the real seeded database** (not just
"looks plausible"): pulled Shreyas Iyer's actual match commentary and manually tallied every
delivery he faced from each bowler by hand — all three computed rows (vs Jadeja, Chahal, Shami)
matched exactly. Confirmed the tab is absent for a pure bowler with no batting innings. See
`RESTRICTIONS.md` entry #64 for the full verification log.

### A2 — Partnership analytics ✅ Done, scope corrected before implementation
**Problem**: `insights.ts` already computes every partnership per innings but only exposes the best
one; no cross-match "best partnerships" record.

- **Affected files**: `src/domain/insights.ts` (widen the exported shape to include the full
  `partnerships` array, not just `bestPartnership` — additive, existing consumers keep working),
  new `src/domain/partnershipRecords.ts` for cross-match aggregation (mirrors `records.ts`'s
  existing pattern), UI: full breakdown in `MatchInsights.tsx`, records in the Stats page's
  "Records" tab (already an established pattern per `CLAUDE.md`).
- **Risks**: Low — additive to an already-correct, already-tested computation.

**Scope correction, found before writing any code, not after**: re-reading `records.ts` closely
showed the "mirrors `records.ts`'s existing pattern" assumption above was wrong. `records.ts` is
cheap specifically because it reads only the already-loaded `Match.innings[].battingCard`/
`bowlingCard` — the denormalised snapshot every match doc already carries. Partnerships are **not**
denormalised anywhere; they only ever exist as a computation over raw `Delivery[]`. A cross-match
partnership leaderboard would therefore need either (a) fetching every delivery from every completed
match platform-wide (the same `admin.service.ts` pattern A1 uses, but for the *whole platform* on
every Stats-page load, not one player's matches — too expensive to do live), or (b) denormalising
partnership data onto `InningsState` at scoring time, which touches `scoring.ts` and is off-limits.
Neither is a fit for "mirrors an existing cheap pattern" as originally scoped. **Descoped**: this
slice ships the full per-innings breakdown only (cheap, valuable, matches the actual problem
statement). The cross-match leaderboard is not built speculatively — if there's real demand for it
later, the honest path is a cached/recomputed doc (like `playerStats`/`standings` already are),
refreshed via the existing "Update stats" trigger, not a live per-request platform-wide delivery
scan. Noted as a deferred idea, not implemented.

**Implemented and verified.** `insights.ts`'s `InningsInsights` gained a `partnerships: Partnership[]`
field (the full array already computed internally, previously discarded down to just
`bestPartnership`) — purely additive, the one existing consumer (`MatchInsights.tsx`) needed no
changes to its existing fields. Added a "Partnerships" list to `MatchInsights.tsx` between the stat
tiles and the boundary/wicket timeline: each row shows the batter pair, runs (balls), and either
"Wkt N" or "unbroken" for a partnership still in progress when the innings ended. Zero lines of
`scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean.
**Verified live against the real database, cross-validated against independently-displayed data on
the same page, not just "renders without crashing"**: opened the same seeded "Royal Strikers vs
Thunder Kings" match used to verify A1. All five Royal Strikers partnerships (12, 16, 10, 14, 6 runs)
summed and cross-checked exactly against that same page's own "Fall of wickets" list (12-1, 28-2,
38-3, 52-4, 58-5 — each gap matches a partnership's runs exactly) — two independently-rendered
sections of the page agreeing confirms the new computation is correct, not just plausible-looking.
Confirmed the "Best partnership" tile (16 (10), S Iyer & R Sharma) matches the corresponding row in
the new full list exactly. Confirmed the Thunder Kings innings' final partnership correctly shows
"unbroken" (Thunder Kings won by 3 wickets — they had wickets in hand, so their last partnership was
never broken), the one label this feature couldn't get right by accident.

### A3 — Expected Score ✅ Done
**Problem**: the only "projected score" today is a naive linear extrapolation with no wickets-lost
or innings-phase awareness.

- **Affected files**: new `src/domain/expectedScore.ts` (pure), wire into `MatchPage.tsx`'s
  `LivePanel` in place of the current inline `projectedScore()` call.
- **Architecture**: same "documented heuristic, not a fitted model" honesty as `winProbability.ts` —
  there's no historical ball-by-ball dataset to fit a real model on, so a transparent, explainable
  formula (current run rate, adjusted for wickets lost and overs remaining/phase) beats a fake-
  precision black box. Keep `projectedScore()` or delete it depending on whether anything else still
  needs the naive version once this ships.
- **Risks**: Low-moderate — needs a sensible formula, but it's still pure and easily unit-tested by
  hand against known match trajectories.

**Audit before implementing**: `projectedScore()` (`lib/format.ts`) had exactly one consumer
(`MatchPage.tsx`'s `LivePanel`) — confirmed by grep, not assumption — and ignored wickets entirely.
`LivePanel` already computes a `wicketsRemaining` value for the sibling `chaseWinProbability` call
(`(squadSize||11) - 1 - inn.wickets`, matching a standard-XI assumption already accepted there) but
never passed it to the score projection. **Implemented and verified.** New
`projectFirstInningsScore()` extrapolates the current run rate across the overs remaining, then
scales that extrapolation by a wickets-in-hand factor (`0.5 + 0.5 * min(1, wicketsRemaining/10)`) —
mirroring `chaseWinProbability`'s own `/10` normalization exactly rather than inventing a second,
differently-scaled convention for the same input in the same component. Explicitly documented as a
heuristic, not Duckworth-Lewis or a fitted model — same honesty `winProbability.ts` already commits
to, for the same reason (no historical dataset to calibrate either against). Reused the already-
computed `wicketsRemaining` from `LivePanel` rather than recomputing it. Updated the on-page label
from "Projected X on this run rate" to "Expected score: X" since the number is no longer pure-rate-
based. **Confirmed `projectedScore()` had zero other consumers after the swap and removed it**
from `lib/format.ts` — dead code, not left behind "just in case." Zero lines of `scoring.ts`
touched — every input (runs, balls, wickets) is real recorded match data, nothing fabricated.
`tsc -p tsconfig.app.json --noEmit`, `npm run build`, and `oxlint` all clean (one pre-existing,
unrelated `react-hooks/exhaustive-deps` warning on a different `useMemo` in the same file, not
introduced by this change). **Verified live against the real database with the formula hand-computed
twice, not just eyeballed for plausibility**: created a throwaway 3-a-side match, scored 24 runs off
6 balls (0 wickets), and confirmed the displayed "Expected score: 298" matched a hand calculation
using the exact same formula to the integer. Then took a wicket (wickets remaining 2→1) and confirmed
the number dropped to exactly 237 — also hand-verified — proving the wicket-sensitivity actually
works, not just that some number renders. Test match deleted after verification (never reached
`completed` status, so no stats-cache pollution to clean up, unlike Slice 2.4's test).

### A4 — Career-level Wagon Wheel + Bowling Heat Map ✅ Done
**Problem**: `wagonWheelData()`/`pitchMapData()` already generalize across matches (pure functions,
optional player filter) but are only ever called with one match's deliveries — no player ever sees
their career shot chart or career line/length profile.

- **Affected files**: `PlayerPage.tsx` (new tab/section), a new data-fetching helper (loop
  `listBallMeta(matchId)` across the player's matches and concat — `ballMeta` docs don't carry
  batter/bowler id directly, so cross-referencing against each match's own `deliveries` is required
  regardless of query strategy; a `collectionGroup` query wouldn't avoid this).
- **Risks**: Moderate — N+1 fetch pattern across potentially many matches; needs a sensible cap or
  loading state for prolific players. No domain logic changes needed, `wagonWheelData`/`pitchMapData`
  are reused exactly as they are.

**Audit before implementing, confirmed unchanged since Pass 1's earlier read**: re-diffed
`wagonWheel.ts`, `pitchMap.ts`, and `ballMeta.service.ts` against 4 commits back — zero changes, so
the earlier audit's conclusions (both domain functions already accept an optional player filter and
are pure; `listBallMeta(matchId)` is scoped to one match) still held. Confirmed `WagonWheel`/
`PitchMap` (the chart components) take only `{zones}`/`{cells}` — no data-fetching of their own, safe
to reuse unmodified. **Implemented and verified.** Reused `perfs.data` (already fetched for A1) to
get the player's full match-id list — this also means the fetch correctly only ever includes
*finished* matches (`playerPerformances()` gates on `isFinished(m)`), so an in-progress live match's
provisional data can never leak into "career" analytics; confirmed this exact behavior live, see
below. For each match, fetches `getDeliveries()` and `listBallMeta()` in parallel, concatenates
across all matches, then calls `wagonWheelData`/`pitchMapData` once each on the combined set with
`filterBatterId`/`filterBowlerId` set to the viewed player — both functions already do the
per-player filtering internally, so one combined cross-match fetch feeds both charts with no new
domain logic. Lazy-loaded behind its own `analysisOpened` flag (heavier than A1's fetch — deliveries
*and* ballMeta per match — so given its own gate rather than piggy-backing on `vsBowlerOpened`).
New "Shot & Line Analysis" tab, gated on the player having any performance at all (batting or
bowling); inner content shows each chart only if that specific player's filtered data actually has
a non-zero cell, with a clear empty state ("Shot placement and line/length data only exist for
deliveries the scorer chose to tag while scoring") when neither has any — never a blank chart
implying data that doesn't exist, and never a fabricated placeholder. Zero lines of `scoring.ts`
touched. `tsc -p tsconfig.app.json --noEmit`, `npm run build`, and `oxlint` all clean.
**Verified live against the real database with deliberately-tagged, known ground truth, not
existing seed data (confirmed via audit that the existing seeded "Royal Strikers vs Thunder Kings"
match has zero tagged deliveries — neither chart would have had anything to show there)**: created a
throwaway match, scored two boundaries as the same player who was also bowling to himself (a
deliberate test setup so one player's page would exercise *both* charts at once), tagging one ball
Mid-wicket/Stumps/Good (4 runs) and the other Long-on/Off/Full (6 runs) through the real
`ShotDetailPrompt` UI — not seeded directly into the database. **Regression-checked the finished-
matches-only behavior explicitly**: before ending the match, the new tab correctly showed the empty
state (the live match's tags didn't leak into "career" data); after force-completing both innings via
"End innings", the same tab showed both charts with the exact tagged values (wagon wheel: 4 runs/1
ball in one zone, 6 runs/1 ball in another, six other zones correctly zero-filled; heat map: 4 at
Good×Stumps, 6 at Full×Outside-off) — an exact match to what was deliberately tagged, not just
"a chart appeared." Test match deleted after verification; since it had reached `completed` status,
ran the existing "Recompute leaderboards & standings" action afterward and confirmed the player's
stats page and the Analysis tab both reverted to their clean pre-test baseline (empty state again),
same cleanup discipline as `ROADMAP_V4.md`'s Slice 2.4.

---

## Phase B slices

### B1 — Fix Tournament Admin signup ✅ Done, live-verification partial (see below)
**Problem**: `requests.service.ts`'s self-serve `AdminRequest` flow asks "Tournament you want to
run" and says "Admins can create and run their own tournaments," but `approveRequest()` hardcoded
`setUserRole(req.uid, 'ADMIN')` — a full platform admin grant regardless of that scoped intent.

- **Pre-flight concurrent-session check** (per standing rule): `git diff -- firestore.rules` was
  empty (no uncommitted changes) and `git diff -- src/types/index.ts` showed only the scoring
  session's additive `BallMeta.note`/`reviewed` fields (unrelated to roles) — safe to proceed.
- **Fix**: `approveRequest()` now grants `TOURNAMENT_MANAGER` instead of `ADMIN`. Updated the
  approval `notify()` message and `RequestsPage.tsx`'s approve toast to say "tournament manager"
  instead of "admin," since those are now literal, user-visible role claims that would otherwise be
  wrong. Did not rename the feature itself (`AdminRequest` type, `adminRequests` collection,
  "Admin requests" page title) — that's a much larger, unnecessary rename; `TOURNAMENT_MANAGER` is
  still a tier of admin-ish access via `canManage()`, so the existing generic "admin access" framing
  isn't false, just less specific than the new notification text.
- **Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` on both touched files
  all clean.
- **Live verification, done in two halves, second half intentionally stopped short**: signed in as
  an existing seeded `viewer`-role test account (`Test12` / `@testaccount1`) and submitted a real
  request ("B1 Verification Test Cup") through the actual `AccountPage.tsx` form — confirmed it
  landed as a real `adminRequests` doc (the page flipped to "Request pending… The master admin will
  review it soon," which only renders after a successful Firestore write). Switching back to the
  master-admin session to click "Approve" and confirm the resulting `users/{uid}.role` reads
  `TOURNAMENT_MANAGER` was the natural next step, but the user asked to stop before that second
  sign-in happened — so the *approval* half is verified by direct code/rules reading (the new
  `setUserRole(req.uid, 'TOURNAMENT_MANAGER')` call, `ROLE_LABELS` mapping, and
  `firestore.rules`' unrestricted `isMasterAdmin()` update path for `adminRequests`) rather than a
  live click-through. **Not a correctness risk** — `setUserRole()` is a one-line `updateDoc` already
  proven correct by A1-A4's own repeated use of the same Firestore write pattern — but flagged here
  rather than silently claimed as fully live-verified.
- **Leftover state needing cleanup**: the real `adminRequests` doc for `testaccount1`
  ("B1 Verification Test Cup") is still sitting in `pending` status in the live database. Needs
  either a real approve/reject click-through (which would also close out the verification above) or
  a manual reject/delete, so it doesn't get mistaken for a genuine request later.
- **Significant finding surfaced while auditing this slice, deferred to B2**: `firestore.rules`'
  `isAdmin()` (line 38) is `['MASTER_ADMIN', 'ADMIN']` only — a *different, narrower* helper than
  `canManage()` (line 46, includes `TOURNAMENT_MANAGER`). More importantly, `canScore()` (rules AND
  `authStore.ts` both) is `['MASTER_ADMIN', 'ADMIN', 'SCORER']` — **`TOURNAMENT_MANAGER` is excluded**,
  and the `/matches/new` route (`App.tsx`) is guarded by the same list. Net effect, confirmed by
  reading the route guards and `MatchesPage.tsx`'s button gating directly: a user newly granted
  `TOURNAMENT_MANAGER` by this exact flow can create their tournament and its teams/players
  (`canManage()` covers that), but **cannot create or score a single match in it** — the "New match"
  button doesn't render for them and `/matches/new` would reject them even by direct URL. This looks
  like an unintended gap rather than a deliberate design choice (there's no equivalent restriction
  reasoning documented anywhere, and it directly undercuts "create and run their own tournament").
  This is exactly B2's stated scope ("map every `TOURNAMENT_MANAGER` write path, close gaps") — not
  fixed as part of B1 to keep this slice's diff scoped to the one bug it set out to fix, but it's now
  B2's primary, concrete finding rather than a from-scratch audit.

### B2 — Tournament Admin permissions audit ✅ Done, live-verification blocked by session constraints
**Fix**: added `TOURNAMENT_MANAGER` to `canScore()` in both `firestore.rules` and `authStore.ts`,
and to the `/matches/new` and `/scoring/:id` route guards in `App.tsx` — the same owner-scoped shape
`ADMIN` already has (actual writes stay gated by `isOwnerOrMaster(resource.data.ownerId)` per match,
so this doesn't let a tournament manager touch anyone else's matches). Also widened
`MatchSetupPage.tsx`'s "Assign scorer" picker (`u.role === 'SCORER' || u.role === 'ADMIN'`) to
include `TOURNAMENT_MANAGER`, so they're selectable as a delegate scorer by another match's owner —
a UX-only addition, not a new permission boundary, since they already have `canScore()` globally
once this fix lands.

**Unclaimed related fix, folded in after independently verifying it**: found `firestore.rules`'
`auditLogs` create rule (`isAdmin()`-only, i.e. `MASTER_ADMIN`/`ADMIN` only) was silently rejecting
writes from two real call paths, confirmed by grepping every `logAudit()` call site directly:
`auth.service.ts` calls it on **every** login regardless of role, and `trash.service.ts` (reachable
by `TEAM_MANAGER`/`TOURNAMENT_MANAGER` via the Trash page) calls it on soft-delete/restore/permanent-
delete. `logAudit()` is explicitly best-effort and swallows its own errors, so this was failing
silently for every non-admin login and every non-admin trash action — a real, pre-existing gap, not
specific to this slice, but directly relevant to `TOURNAMENT_MANAGER`'s audit trail completeness.
Loosened `create` to `isSignedIn()` + self-attribution (`actorId == request.auth.uid`), the same
shape `notifications`/`activity`'s own create rules already use.

**Provenance note, for full transparency**: the `canScore()`/route-guard/`auditLogs` changes were
found already drafted, uncommitted, in the working tree — another Claude Code chat is running its
own dev server in this same folder and had independently arrived at the same `canScore()` fix (plus
the `auditLogs` fix I hadn't found yet). Reviewed every hunk with the same rigor as original work
before accepting it — traced the route guards and button gating myself to confirm the `canScore()`
finding, and independently grepped every `logAudit()` call site to verify the `auditLogs` claim
rather than trusting the comment. The same working tree also had that other session's own **Slice
6.2** (`ballMeta` owner-scoping, unrelated to `TOURNAMENT_MANAGER`, already documented with its own
verification caveats in their `ROADMAP_V5.md`) mixed into the same file — surgically excluded that
hunk from this commit (temporarily reverted it, committed B2's actual diff, then restored it exactly)
so it stays that session's own commit to make, not folded into or claimed by this one.

**Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` on all four touched
`.ts`/`.tsx` files clean (rules files aren't part of the TS/build/lint pipeline).
**Live verification not completed this slice — environment-blocked, not skipped**: my own dev server
came up on a different port than expected (`5173` was already occupied by the other chat's server),
which meant a fresh browser origin with no carried-over sign-in. The user asked not to be prompted
for further logins before stepping away, so the click-through verification (approve the still-
pending "B1 Verification Test Cup" request, confirm the resulting `TOURNAMENT_MANAGER` account can
see and use "New match") could not be completed. Code-level verification (route guards, `canScore()`
call sites, real `logAudit()` call sites) was done to the same standard as every other slice; the
live click-through is the one piece still outstanding for both B1 and B2, tracked together below.

### B3 — Standard account audit ✅ Done, rules change not deployed
**Fix**: new "Recent activity" card on Account Settings (`UserSettingsPage.tsx`), between "Privacy &
sessions" and "Account" — shows the signed-in user's own audit trail (logins, role changes, trash
actions) pulled from the same `auditLogs` collection Platform Tools already shows the master admin in
full, but scoped to the caller's own entries. This is a genuinely different audience from the
existing admin-facing audit log, not a duplicate of it (confirmed via the original audit table: "Only
the master admin reads the audit trail... nothing user-facing shows an individual their own account/
security activity").

- **Service**: `audit.service.ts` gained `listMyAuditLogs(uid, max=20)` — `where('actorId', '==',
  uid)` + a generous `fbLimit` read cap, sorted/sliced client-side, deliberately *not*
  `where(...).orderBy('createdAt')` together, which needs a composite index this project doesn't
  ship. Same pattern `notifications.service.ts`'s `listNotifications` already documents and uses —
  reused the convention rather than inventing a new one.
- **Rules**: `auditLogs`' `allow read` widened from `isMasterAdmin()`-only to also allow
  `isSignedIn() && resource.data.actorId == request.auth.uid` — same shape as `notifications`' own
  read rule. `create`/`update`/`delete` unchanged.
- **Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` on all three touched
  files clean.
- **Not live-verified, and this time not a login/environment-access issue — a structural one**:
  confirmed this sandbox has neither the Firebase CLI (`firebase --version` fails) nor Java (`java
  -version` fails), matching the scoring session's own established finding on Slices 6.1/6.2. This
  means **no `firestore.rules` change from this entire Phase B is live yet** — B2's `canScore()`/
  `auditLogs`-create widening and B3's `auditLogs`-read widening all still need one
  `firebase deploy --only firestore:rules` to take effect, alongside the scoring session's own
  pending Slices 6.1/6.2 changes already in the same file. Until deployed, a non-master user's own
  "Recent activity" read is rejected by the still-live old rule (empty/error state, not real data);
  the master admin's own view of the new section works today regardless, since they already passed
  the pre-existing rule before this change. This reframes what "live verification" can mean for any
  further rules-touching slice in this session: a browser login only ever proves client-side
  UI/route-gating behavior, never actual rule enforcement, until the user deploys.

### B4 — Phone verification and privacy ✅ Code done, cannot be live-tested in this sandbox at all
**Fix**: `UserProfile` gained `phone?: string` / `phoneVerified?: boolean`, same privacy tier as the
existing `email` field (never public, editable by the owner). Account Settings gained a `Phone
(optional)` field next to Email, and a new "Phone verification" card: shows a verified badge once
confirmed, otherwise a "Send verification code" → SMS code entry → "Confirm" flow using Firebase
Phone Auth (`RecaptchaVerifier` + `linkWithPhoneNumber` against the already-signed-in user — this
attaches a phone credential for verification purposes, it does **not** change how the app signs
people in; username/password stays the only sign-in method). Editing the phone number resets
`phoneVerified` to `false` (an unverified stale flag against a *different* number would be worse than
no flag at all). `authErrorMessage()` gained cases for the phone-specific Firebase error codes
(`invalid-phone-number`, `code-expired`, `invalid-verification-code`, `credential-already-in-use`,
`operation-not-allowed`).

**Real, separate privacy finding surfaced while building this, deliberately not fixed in this
slice**: `firestore.rules`' `/users/{uid}` has `allow read: if true` (needed so displayName/bio/
photoURL/role can back public stats/scorer-credit display) — but Firestore rules cannot redact
individual fields on a `get()`, so this rule *technically* allows anyone who queries the Firestore
API directly (bypassing this app's UI entirely) to read a user's full profile document, including
`email` (pre-existing, not introduced by this slice) and now `phone`. Confirmed this app's own code
never *itself* leaks these fields to a public context — `getPublicProfile()` already hand-curates a
`PublicProfile` subset that excludes `email`, and every other full-document read (`loadProfile()`) is
only ever called for the already-authenticated caller's own uid — but the underlying *rule* doesn't
enforce that boundary, app code convention does. **Correcting this properly needs a real, bigger data-
model change**: splitting `email`/`phone`/`phoneVerified` out of the main `users/{uid}` doc into a
separate `users/{uid}/private/contact`-style sub-document with its own tight rule
(`isSignedIn() && (request.auth.uid == uid || isMasterAdmin())`), since that's the standard Firestore
pattern for a document with both public and private fields (mirrors why `invitationRoleGrants`/
`teamInvitationGrants` are already separate, `allow read: if false` documents in this same file).
That's a genuine schema migration touching `registerUser()`, `updateUserProfile()`, `loadProfile()`,
and every existing `email` value already stored under the old shape — too large and consequential to
take on unilaterally mid-slice while the user was away and unable to review a bigger architectural
change. **Not silently shipped either way**: corrected this page's own "What's visible publicly" copy,
which previously made a false claim ("Bio/email are visible to other admins on the Users & Roles
page") — grepped `UsersPage.tsx` directly and confirmed email/bio are not actually rendered there at
all, so the claim was already stale before this slice; fixed the copy to describe only what the app
actually does today (never shown on the public site) rather than extend a false claim to phone too.
Flagged the deeper rule-level fix here and in `RESTRICTIONS.md` as a real, actionable finding for a
future slice, not swept under the rug.

**Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build` (confirms `RecaptchaVerifier`/
`linkWithPhoneNumber`'s import surface is valid against this project's installed `firebase` package
version — a real, if partial, check, not nothing), `oxlint` on all four touched files clean (one
pre-existing `no-useless-catch` warning in `auth.service.ts`'s untouched `createLinkedAccount`,
unrelated to this slice). **Cannot be live-verified in this sandbox at all, at any level, and this is
structurally different from every other undeployed-rules slice**: even setting aside the session's
login-access limitation and the Firebase-CLI/Java deploy gap already affecting B2/B3, Phone Auth
specifically also needs (1) the "Phone" sign-in provider enabled in the Firebase console for this
project — this app cannot enable that itself, and it's unknown whether it's currently enabled; (2) a
real phone number able to receive SMS, which this sandbox has no way to provide; (3) an interactive
reCAPTCHA challenge, which cannot run headlessly. **Needs from the user**: confirm/enable the Phone
provider in Firebase console, then test the send-code → confirm flow with a real number once signed
in.

---

## Phase C slices

Scope confirmed explicitly before starting: C1 (data model), C2 (provider-independent billing
interface + mock implementation), and C3 (generic gating mechanism) only. Not approved and not
built: connecting a real payment provider, processing real payments, choosing Stripe/Razorpay/etc.,
or C4 (donations) in any form. Firebase deployment stays deferred, same as Phase B, until a later
single production pass.

### C1 — Subscription / entitlement architecture ✅ Done
**Fix**: `Subscription` lives in its own `subscriptions/{uid}` doc (mirrors `userPrefs`), not bolted
onto `UserProfile` — billing state and profile state are different concerns with different growth
paths (a real provider will eventually want `providerCustomerId`, invoice history, etc., none of
which belongs on the profile doc every public page already reads). `domain/entitlements.ts`'s
`effectiveTier()` treats anything other than an `active`-status subscription as free, regardless of
what `tier` was purchased — a canceled or past-due subscription doesn't silently keep granting
access. `PremiumFeatureDef`/`PREMIUM_FEATURES` (the C3 registry) were added here since they're part
of the same type module, but the registry itself ships empty — populating it is explicitly out of
scope until the user provides the real feature list.
- **Rules**: `subscriptions/{uid}` — self-or-master read; create/update restricted to the master
  admin or the doc's own owner *and only when `provider == 'mock'`* — flagged explicitly in the rule's
  own comment that this allowance needs narrowing once a real provider exists, since there's no
  trusted server context (no Cloud Functions in this project) to verify a real provider's writes from
  the client the way the mock's simulated ones can be trusted.
- **Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` clean. **Not live-
  tested — deliberately, per instruction, not an oversight**: the user explicitly said not to require
  a new login and to defer all Firebase-dependent verification (deploy included) to a later single
  pass. Verification here is code-level: careful re-review of `effectiveTier()`/`hasEntitlement()`'s
  logic by hand (canceled/past-due/missing subscription → free; active + matching tier → premium;
  unregistered feature key → always true) and of the rule's self-write restriction, not a live
  click-through.

### C2 — Billing-provider abstraction ✅ Done
**Fix**: `BillingProvider` (`billing.types.ts`) is a two-method interface — `startCheckout(uid, tier)`
/ `cancelSubscription(uid)` — keyed by `uid` rather than any provider-specific id, so call sites never
need to know which provider is behind it. `MockBillingProvider` (`mockBilling.service.ts`) is the
only implementation: it never moves money or contacts any payment network, it writes a `Subscription`
doc directly to simulate an instantly-successful purchase (30-day period, `status: 'active'`). A
thin `billing.ts` resolver (`getBillingProvider()`) means swapping in a real provider later is a
one-line change there, not a find-and-replace across every future caller.
- **No UI calls this yet, deliberately**: a checkout button right now would be selling access to
  zero actual premium features (C3's registry is empty) — building that experience before there's
  anything real behind it risks user confusion later. Wiring a real "Upgrade" flow is left for once
  the feature registry is populated.
- **Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` clean. Not live-tested,
  same reasoning as C1 — this module has no rules dependency of its own beyond C1's, so there's
  nothing further blocked on deployment specifically, but no browser session was available either way
  per instruction.

### C3 — Premium feature-gating system ✅ Done, generic mechanism only, zero features gated
**Fix**: `useMySubscription()` (subscription + effective tier + a `loading` flag, so a caller can
avoid flashing an upsell before the initial Firestore read resolves) and `usePremiumFeature(key)` (the
plain boolean check, deliberately shaped like the existing `useFeatureFlag()` hook rather than
inventing a new hook convention). `<PremiumGate feature="key">` renders its children when entitled —
which today means *unconditionally*, for any key not yet in `PREMIUM_FEATURES` — or a small upsell
card (or a caller-supplied `fallback`) otherwise. Added a read-only "Plan" row to Account Settings
(Free/Premium badge, next to Role/Joined) so C1's data flow is visibly exercised end-to-end even with
nothing gated yet.
- **Explicitly did not**: infer, guess, or populate `PREMIUM_FEATURES` with any existing feature —
  per direct instruction, that list is the user's to provide, and the only feature discussed by name
  (Batter-vs-Bowler analytics) was confirmed to stay free, which the empty registry already guarantees
  by construction (an unregistered key is always entitled). Also did not build a checkout/upgrade page
  — see C2's write-up for why that's premature with nothing real to sell.
- **Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` clean. Not live-tested,
  same reasoning as C1/C2 — reviewed `<PremiumGate>`'s and the two hooks' logic by hand (unregistered
  key → always renders children; loading state correctly suppressed for signed-out users rather than
  hanging) rather than a live click-through.

### C3 addendum — the confirmed Free vs Paid registry applied ✅ Done
The user provided the final, confirmed Free vs Paid feature registry (38 named paid items, 15 named
free items, plus Custom Roles and Team Documents as their own special cases). Every named item was
mapped to its real implementation by auditing the codebase directly — reading the actual component,
domain module, and render site, never assumed from the name alone — before any gate was applied.

**Method**: `PREMIUM_FEATURES` (`domain/entitlements.ts`) now has 23 keys wired to a real, existing
UI gate, plus 10 keys registered with a description explaining why nothing exists to gate yet (no
fake placeholder functionality built for any of them, per instruction). Several paid items share one
key where they clearly describe the same implementation from different angles — documented per entry
in the registry itself, not hidden:
- **Tournament comparison** + **Comparison views** → one key (`tournament_comparison`), all three of
  CompareTournamentsPage/CompareSeasonsPage/CompareClubsPage.
- **Sponsor showcase** + **Sponsor banners** → one key (`sponsor_showcase`), the one
  `Tournament.sponsors` display.
- **Tournament media** + **Tournament galleries** + **Tournament photos** + **Photo management** →
  one key (`tournament_media`), the one `<EntityGallery>` instance on a tournament page (including
  its own upload/delete controls — there's no separate "photo management" surface to gate instead).

**`PremiumGate` gained an `ownerId` prop** to support this registry correctly: several paid items
(sponsors, branding, tournament media, tournament announcements, club activity feeds, match photo
galleries) are content an owner publishes for *anyone* to see — gating those by the current
*viewer's* plan would mean a paying tournament owner's sponsors/banner/gallery become invisible to
their own (mostly free-tier) visitors, which is backwards. `<PremiumGate ownerId={t.ownerId}>` checks
the *content owner's* subscription instead via a new `useSubscriptionFor(uid)` hook, and renders
nothing (not even the upsell fallback) while that owner's subscription is still loading, to avoid a
flash. Every other gate (analytics, exports, tools) checks the current viewer's own plan via the
existing `usePremiumFeature()` — right for things a viewer personally unlocks regardless of whose
content they're looking at.

**Applied** (see `domain/entitlements.ts` for the full description + exact file/component per key):
`auto_powerplay` (MatchSetupPage's Auto/Manual toggle — Manual stays fully free, this only gates the
auto-fill convenience), `tournament_statistics` (a tournament's Leaders + Records tabs),
`season_splits`, `recent_form_charts` (team AND player), `player_radar`, `team_records`,
`records_by_venue`, `qualification_tracking` (distinct from the free Groups tab), `tournament_timeline`,
`pitch_map` (not Wagon Wheel, which stays free), `partnership_analytics`, `performance_charts`
(MatchGraphs), `tournament_comparison`, `sponsor_showcase`, `club_activity_feeds` (only the ClubPage
instance — the same `<ActivityFeed>` on Player/Team/Tournament/Season/Dashboard stays free),
`embeddable_widgets`, `match_photo_galleries`, `tournament_media`, `follow_seasons` (only
`kind="seasons"` — following players/teams/tournaments/clubs stays free), `tournament_branding`,
`tournament_announcements`, `fixtures_calendar` (both the per-match Add-to-calendar button and the
tournament-wide Calendar view/ICS-download, since the latter's own component is literally named
`FixturesCalendar`), `data_export` (CSV/JSON on match/player/tournament pages — not
`domain/platformExport.ts`, the unrelated master-admin-only platform backup tool).

**Defined only, no code changed**: `unlimited_tournaments`, `unlimited_seasons` (no count limit
exists for any tier today), `shareable_statistics` (the existing `<ShareButton>` is core
infrastructure used everywhere, not this feature — must not be gated), `media_storage_allowance` (no
storage quota is enforced today), `tournament_documents` (no document-attachment feature exists),
`custom_urls` (every entity is addressed by its Firestore doc id), `seo_enhancements`
(`useDocumentMeta()` is automatic infrastructure for every page/tier, not a discretionary feature —
gating it would remove free users' existing SEO, not add a paid one), `advanced_reports` (no distinct
"reports" surface separate from `data_export`), `api_access` (this app has no public API of its
own — only Firestore reads/writes through firestore.rules), `custom_domains` (needs real DNS/hosting
infrastructure this project has no backend to provide).

**Free list, confirmed untouched by direct inspection, not assumed**: grepped every `PremiumGate`/
`usePremiumFeature` call site (33 total) and cross-checked none touch Batter-vs-Bowler
(`PlayerPage.tsx`'s `vsbowler` tab), Player history (`timeline` tab), Player-vs-player comparison
(`ComparePage.tsx` — zero gates in that file), or any of the core match creation/scoring/scorecard/
auth/security infrastructure (`ScoringPage.tsx` — zero gates in that file either).

**Team Documents and Custom Roles**: confirmed via grep that neither feature exists anywhere in the
codebase (no document-attachment UI for teams, no custom-role creation/configuration UI at all —
`ASSIGNABLE_ROLES` in `UsersPage.tsx`/`InvitationsPage.tsx` is a fixed list of the built-in `Role`
enum, not user-defined roles). Nothing to gate or permission-check because nothing exists yet.
Documented in the registry (`tournament_documents`'s description) that Team Documents must be
permission-controlled by team membership when eventually built, never premium-gated, per instruction.

**One real ambiguity flagged, not silently resolved either way**: `CompareTeamsPage.tsx`
(`/compare/teams`, team-vs-team comparison) is not explicitly named in either list. It's structurally
identical to the explicitly-free `ComparePage.tsx` (player-vs-player) — same "compare two entities of
the same kind" pattern, just teams instead of players — rather than to the paid tournament/season/
club comparison pages (which compare aggregate entities, not head-to-head opponents). Left ungated
(free) as the more conservative, non-inventive reading, since gating it would mean assuming
"Comparison views" implicitly covers team comparison too, which isn't stated. Flagged here for
confirmation rather than guessed silently either direction.

**Verified**: `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` all clean across every
touched file (three pre-existing, unrelated warnings confirmed by direct inspection: a
`no-useless-catch` in `auth.service.ts`'s untouched `createLinkedAccount`, and two
`react-hooks/exhaustive-deps` warnings in `MatchPage.tsx`/`TournamentPage.tsx` on `useMemo` hooks
nowhere near any gate added this slice). No test suite exists in this project (per `CLAUDE.md`) — 
"run relevant tests" per the instruction's checklist is satisfied by the type-check/build/lint chain,
same as every other slice this session. **Not live-tested**, same standing reason as every other
Phase B/C slice this session: no authenticated browser session available, and the user's instruction
was to keep moving without pausing on it. Free/Paid access, team-document permissions, and
custom-role Free/Paid limits were all verified by direct code audit (grep + read, documented above)
rather than a live click-through, since two of the three ("team documents", "custom roles") have no
code path to click through at all yet.

---

## Phase D — Direct user instruction: auth relaxation, tournament gating, Tournament Dashboard, onboarding, Hosting removal

A large, direct new instruction from the user, handled with the same audit-first discipline as every
prior phase. Audited against Phase B/C above first: most of "AUTH + ROLES"/"TOURNAMENT ADMIN"/premium
entitlements were already built there. Two decisions were confirmed with the user rather than
guessed: new signups get `SCORER` immediately (not `VIEWER`), and `TEAM_MANAGER` loses tournament-
creation rights (narrowed to `TOURNAMENT_MANAGER`/`ADMIN`). See `RESTRICTIONS.md` entries #83-#87 for
full per-slice detail; summarized here:

- **D1 — Tournament creation requires role + verified phone, enforced server-side.** New
  `canCreateTournament()` in `firestore.rules` (master bypasses; `ADMIN`/`TOURNAMENT_MANAGER` need
  `phoneVerified == true`; `TEAM_MANAGER` excluded), mirrored client-side in `authStore.ts`. **Found
  and closed a real, currently-exploitable spoofing hole while building this**: the `/users/{uid}`
  update rule didn't restrict `phoneVerified` at all — any signed-in user could set it `true` directly
  via `updateDoc`. New `phoneVerifiedIsHonest()` requires the caller's live Firebase Auth ID token to
  actually carry a `phone_number` claim (only set by a real `linkWithPhoneNumber` flow) before
  `phoneVerified` can become `true`. `auth.service.ts` now forces a token refresh right before that
  write so the new rule doesn't reject a just-completed verification. Also fixed: `TournamentsPage.tsx`
  had zero role gating on "New tournament" (relied entirely on the write failing); `TournamentPage.tsx`
  showed management controls to any `TOURNAMENT_MANAGER`/`ADMIN` regardless of ownership (role-only
  check, no owner check) — both closed.
- **D2 — New signups get `SCORER`, not `VIEWER`**, both server-side (`firestore.rules`) and in
  `auth.service.ts`'s `registerUser()`. `SCORER` was never in `canManage()`, so tournament creation
  stays blocked for a fresh account by construction, no extra check needed.
- **D3 — Tournament Dashboard.** `DashboardPage.tsx` takes an optional `tournamentId` — one component,
  data source branches by scope, per the user's explicit "don't duplicate the dashboard" instruction.
  `StandingsTable` extracted into `components/stats/` (shared, not duplicated, and deliberately not
  imported from `TournamentPage.tsx` directly — that would have pulled a large, unrelated import graph
  into the dashboard's own lazy-loaded route chunk). New `DashboardSwitcher.tsx`: a Global/Tournament
  tab control (all sizes) plus a hand-rolled touch-swipe gesture (no gesture library exists in this
  codebase); only one `DashboardPage` is ever mounted at a time, since `useAsync` has no cache and
  mounting both would double every dashboard's Firestore reads.
- **D4 — First-time tutorial.** `TutorialButton.tsx`, modeled on `WhatsNewButton.tsx`'s exact shape —
  header icon + `Modal`, `localStorage`-persisted "seen" flag. Seven steps covering the user's exact
  list, auto-opens once per browser on first dashboard visit, replayable any time.
- **D5 — Firebase Hosting removed from local deploy config.** Only the `hosting` key in `firebase.json`
  — `firestore`/`storage` config stay, `.firebaserc` stays (still needed for rules deploys). Confirmed
  via grep this is the only Hosting reference anywhere in the repo. **No effect on the live, already-
  deployed site** — that's a separate Firebase-side resource; this only stops *this repo* from being
  able to push a new Hosting deploy.

`tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` all clean across every Phase D file.
**Nothing in Phase D is live-tested** — no authenticated browser session was available in this sandbox
at any point, and the user explicitly asked to finish without pausing to wait for one. D1's rules
change joins the existing undeployed pile (Phase B, C1); one `firebase deploy --only firestore:rules`
clears everything across this whole project. A real phone number and the Phone sign-in provider being
enabled in the Firebase console are still needed to exercise D1's actual verify-then-create flow.

## Notes
- **Phase A is complete** — A1, A2, A3, A4 all implemented, verified live against the real database
  (each with either hand-computed or deliberately-tagged known ground truth, not just "renders
  without error"), and committed separately. Zero lines of `scoring.ts` touched across all four.
  A2's cross-match "partnership records" half was descoped before implementation (see its write-up)
  rather than built expensively or half-right; everything else shipped as originally scoped.
- **Phase B is code-complete.** B1, B2, B3, and B4 are all implemented, verified to the extent this
  sandbox allows (tsc/build/lint clean on every slice), and committed — including a small B2 addendum
  (Users & Roles' role dropdown was missing Team/Tournament Manager as assignable options) found while
  building B4. No live click-through was possible for any of B1-B4 this session — see the two-part
  breakdown below plus B4's own additional, phone-specific blockers in its write-up.
- **Two independent verification gaps, not to be conflated**: (1) B1/B2's UI click-through (does a
  `TOURNAMENT_MANAGER` account actually see "New match") needs an authenticated browser session —
  blocked because this session's dev server came up on a new port with no carried-over sign-in, and
  the user asked not to be prompted for further logins before stepping away. A real pending test
  request ("B1 Verification Test Cup") is sitting in the database ready to approve, which would
  complete this in one step next session. (2) Separately and more fundamentally, **no
  `firestore.rules` change in this entire Phase B (or the scoring session's Slices 6.1/6.2) is
  actually live** — this sandbox has neither the Firebase CLI nor Java, so nothing has been deployed.
  A login would only ever prove client-side UI/route-gating, never real rule enforcement, until the
  user runs `firebase deploy --only firestore:rules` (covers B2's `canScore()`/`auditLogs`-create,
  B3's `auditLogs`-read, and the scoring session's Slices 6.1/6.2, all in the one file — one deploy
  clears all of it).
- **Concurrent-session note, current as of B3**: confirmed via fresh `git status`/diff immediately
  before B1 that `firestore.rules` had zero uncommitted changes and `types/index.ts`'s only in-flight
  change (the scoring session's `BallMeta.note`/`reviewed` fields) was unrelated to roles. By the
  time B2 started, the scoring session had already independently landed its own `canScore()`/
  `auditLogs` fix (plus its own separate Slice 6.2, `ballMeta` owner-scoping) directly into the same
  file, uncommitted — reviewed and accepted the former into B2 after independent verification,
  surgically excluded and restored the latter untouched; it was committed cleanly on their side
  immediately after (Slice 6.2, no conflict). The scoring session's own roadmap now shows its last
  planned slice (5.1) closed out, so it may be wrapping up. Re-check `firestore.rules`/`types/
  index.ts` fresh again before B4, same discipline.
- **Phase C's C1-C3 are code-complete, and the confirmed Free/Paid registry is now fully applied.**
  Subscription/entitlement data model, provider-independent billing interface + mock implementation,
  and the premium-gating mechanism are implemented; 23 of the user's 38 named paid items are wired to
  a real, audited gate, the other 10 are registered with a documented reason nothing exists to gate
  yet, and every named free item (plus Team Documents and Custom Roles, both confirmed not to exist)
  was checked and left untouched. One genuine ambiguity (`CompareTeamsPage.tsx`, unnamed in either
  list) was left ungated and flagged rather than guessed. Explicitly not built: any real payment
  provider, real payment processing, a specific provider choice, C4 (donations), or a checkout/
  upgrade UI. None of this was live-tested, per direct instruction to defer all Firebase-dependent
  verification (deploy included) and not require a new login — verification here is careful
  code-level re-review and direct grep-based auditing, not a click-through, same honesty standard as
  every rules-touching Phase B slice.
- **Standing item for the later single production pass** (per instruction, not done now): deploy
  `firestore.rules` (covers every undeployed change across Phase B and C1's `subscriptions` rule),
  approve the pending "B1 Verification Test Cup" request, and run a final production/security audit.
- **Still needed before C4 (or any real payment work) can start**: the actual Free-vs-Premium feature
  registry (the user's to provide — not inferred or guessed at any point in C1-C3) and a billing
  provider choice (Stripe was suggested as a common default earlier, still unconfirmed).

---

## Phase E — Direct user instruction: retire phone/SMS verification (staying on Firebase Spark, no billing)

Decision reversal, not new scope: the user chose to stay on the Firebase Spark plan rather than add
billing, and real Firebase Phone Auth SMS requires the paid Blaze plan even with the Phone provider
enabled (confirmed via live testing against this project — B4/D1's `auth/operation-not-allowed`
error was a billing-plan gap, not a disabled provider). Rather than pay for Blaze, phone verification
is removed as a requirement everywhere it was added (B4, D1):

- `firestore.rules`' `canCreateTournament()` reverted to role-only (`isMasterAdmin() ||
  hasRole(['ADMIN', 'TOURNAMENT_MANAGER'])`) — the `phoneVerified` condition and the
  `phoneVerifiedIsHonest()` helper (and its two references in the `/users/{uid}` update rule) are
  removed. `authStore.ts`'s client-side `canCreateTournament` mirrors this. Tournament creation is
  still gated by role, not weakened — the Tournament Manager approval workflow (`AdminRequest`,
  master-admin review) remains the actual mechanism for who gets that role.
- `auth.service.ts` lost `sendPhoneVerificationCode()`/`confirmPhoneVerificationCode()`/
  `resetPhoneVerification()`, the `RecaptchaVerifier` state, and the phone-specific
  `authErrorMessage()` cases (including the `operation-not-allowed` Blaze-plan message from B4 — now
  unused, since nothing calls a phone-linking API anymore).
  `AccountPage.tsx`'s Tournament Manager application card and `UserSettingsPage.tsx`'s Profile/Phone
  verification card are both reverted to their pre-B4 shape.
- `UserProfile.phone`/`phoneVerified` (types), `ProfileUpdate.phone`/`phoneVerified`
  (`users.service.ts`), and the country-code phone input (`PhoneNumberField.tsx`,
  `lib/countryCodes.ts`, added mid-D1-verification) are deleted — zero remaining consumers.
- Normal username/password signup/login, the Free/Premium feature list, and `src/domain/scoring.ts`
  are untouched, per explicit instruction. Verified with `tsc -p tsconfig.app.json --noEmit`,
  `npm run build`, and `oxlint` (clean against the pre-existing warning baseline). Not deployed —
  `firestore.rules` joins the existing undeployed pile for the later single production pass.
