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
3. **A3 — Expected Score** (real first-innings projection model, paired with the existing Win
   Probability module)
4. **A4 — Career-level Wagon Wheel + Bowling Heat Map** (reuse the existing pure domain functions
   across a player's whole match history, not just one match)

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

### A3 — Expected Score
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

### A4 — Career-level Wagon Wheel + Bowling Heat Map
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

---

## Notes
- Phase A starting now, one slice at a time, verified before moving on.
- Phase B needs no external input but does need the `firestore.rules` concurrent-session check
  re-run immediately before B1/B2 specifically, since those touch roles.
- Phase C is scoped but paused pending: (1) which billing provider to target for the abstraction's
  first real implementation (Stripe is the common default for this kind of app, but that's your
  call), and (2) confirmation you want architecture/scaffolding built now vs. only once you're ready
  to actually launch payments.
