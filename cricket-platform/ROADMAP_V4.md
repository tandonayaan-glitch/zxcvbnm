# CricketHub — Roadmap V4 (Scorer Experience)

`ROADMAP.md` (37 phases), `ROADMAP_V2.md` (7 phases), and `ROADMAP_V3.md` (League Ecosystem, being
finished by a concurrent session as of this writing) cover the public/spectator/admin surfaces.
This fourth roadmap audits the **other half of the app that's never had a dedicated pass**: the
actual scorer's journey from creating a match to completing it — `MatchSetupPage.tsx` →
`ScoringPage.tsx` (`PreMatch` → live scoring → innings break → completion) → back to the scorecard.

**This file is planning only — nothing below has been implemented, and nothing will be until
`ROADMAP_V3` is complete, merged, and verified.** Every slice is ⬜.

Legend: ⬜ planned · 🚫 out of scope (reasoning inline) — no ✅/🟡 yet, nothing here is built.

Same standing rules as every prior roadmap: `src/domain/scoring.ts`, `Delivery`/`BallInput`, and
offline infrastructure are never touched. Every slice below carries an explicit **Restrictions
compliance** line confirming this was checked, not assumed.

---

## Revision history of this plan

- **Pass 1**: initial audit — traced the scorer's full lifecycle, found 15 candidate improvements,
  prioritized P0-P3.
- **Pass 2**: added per-slice affected-files/risks/dependencies/acceptance-criteria, and a file-level
  overlap matrix against `ROADMAP_V3`'s current working set.
- **Pass 3**: architecture review of every slice, **one critical correction** (Slice 2.1 was wrong
  — see below), rollback considerations added to every slice, two slices split for production-ready
  sizing, and two new findings surfaced (an orphaned `completeMatch()` function, and a missing
  "reopen match" safety net for the abandon-match slice).
- **Pass 4**: user approved 2.1a and 2.2 exactly as revised in Pass 3 — solo-batter scoring
  explicitly not attempted (deferred to Phase 5), reopen safety net scoped strictly to abandoned
  matches. Both remain unimplemented, blocked on `ROADMAP_V3` being fully completed, merged, and
  verified; they'll be the first two slices built once that happens.
- **Pass 5**: `ROADMAP_V3` confirmed complete, merged, and verified. **Slice 2.1a implemented and
  verified live against the real database**, committed. 2.2 approved to begin next.
- **Pass 6**: **Slice 2.2 (Abandon match control + reopen safety net) implemented and verified live
  end-to-end**, including the abandon → reopen → abandon-again cycle and the negative case (a
  genuinely completed match correctly offers no reopen control). Both P0 slices are now done.
- **Pass 7**: **Slice 2.3 (Player of the Match at end-of-match) implemented and verified
  live end-to-end**, using the preferred zero-`MatchPage.tsx`-touch approach exactly as planned —
  reused the existing `PlayerPickModal` component rather than a new one, and widened
  `setPlayerOfTheMatch()`'s signature (`string` → `string | null`) to support clearing, a
  backward-compatible change that needed no update to `MatchPage.tsx`'s existing call site.
- **Pass 8 (this one)**: **Slice 3.1 (Innings-break scorecard link) implemented and verified live**
  — a small, low-risk addition; four of the six zero-V3-overlap slices are now done.

## ⚠️ Critical correction from this pass: Slice 2.1 was wrong

Pass 2 assumed `applyBall` "doesn't require a non-striker to be present" and proposed a UI-only fix
that would let a Last-Man-Standing batter score with `nonStrikerId: null`. **Re-reading
`scoring.ts` directly (not assumed from memory) disproves this**:

```
// scoring.ts, applyBall(), line 177-178
if (!strikerId || !nonStrikerId || !bowlerId) {
  throw new Error('Striker, non-striker and bowler must be set before scoring.')
}
```

`applyBall` **hard-requires** a non-null `nonStrikerId` for every single ball — there is no "solo
batting" mode in the engine at all, and the standing restriction (`src/domain/scoring.ts` is
permanently off-limits) means this cannot be changed to add one. The original Slice 2.1 plan would
have traded a confusing-but-harmless dead end (a "No eligible players" modal) for a **crash**: the
very next scoring tap would throw an unhandled exception, since `recordBall` would call `applyBall`
with a null `nonStrikerId`.

**Slice 2.1 is revised below** into an engine-compliant fix that solves the actual scorer-facing
problem (being stuck with no clear next action) without attempting true solo batting. The
"literal solo batting" capability is moved to Phase 5 as a confirmed engine-change requirement, not
a plannable slice. This correction is exactly the kind of thing this pass exists to catch — flagged
prominently rather than quietly folded in, since it changes what "done" means for what was the
plan's top priority item.

---

## Coexistence with ROADMAP_V3 — the actual current state, not a guess

Checked `git status --short` again for this pass. The concurrent session finishing V3 currently has
uncommitted changes in `src/features/public/MatchPage.tsx`, `src/features/public/TournamentPage.tsx`,
plus new `FixturesCalendar.tsx`/`calendarExport.ts`/`AddToCalendarButton.tsx`. None of
`MatchSetupPage.tsx`, `ScoringPage.tsx`, `ScoringModals.tsx`, or `scoring.service.ts` are in V3's
working set — matching V3's own scope (spectator/community/tournament-ecosystem only, nothing in it
ever touches the live-scoring screen or the setup wizard file).

**Working rule, unchanged from the last pass**: no slice below is implemented while V3 is in
flight, regardless of file overlap. **Nothing is implemented this pass either** — this is
architecture review and re-planning only.

## Priority overview (revised)

| Priority | Slice | Files touched | Overlaps V3's working set? |
|---|---|---|---|
| **P0** | ✅ 2.1a — Last-man-stranded detection + guided closure *(revised scope)* | `ScoringPage.tsx` | No |
| **P0** | ✅ 2.2 — Abandon match control **+ reopen safety net** *(expanded scope)* | `ScoringPage.tsx`, `scoring.service.ts` | No (landed entirely in the zero-overlap file set) |
| P1 | ✅ 2.3 — Player of the Match at end-of-match | `ScoringPage.tsx`, `scoring.service.ts` | No (preferred approach used — `MatchPage.tsx` untouched) |
| P1 | ✅ 3.1 — Innings-break scorecard link | `ScoringPage.tsx` | No |
| P1 | 4.2a — Mobile scorer audit (read-only) | `ScoringPage.tsx`, `ScoringModals.tsx` | No |
| P1/P2 | 4.2b — Mobile scorer fixes (scoped by 4.2a's findings) | Same as 4.2a | No |
| P2 | 1.1 — Setup wizard validation feedback | `MatchSetupPage.tsx` | Low (Phase-5-polish note) |
| P2 | 2.4 — Auto-recompute stats on completion | `scoring.service.ts` | No |
| P2 | 3.2 — In-scoring scorecard view | `ScoringPage.tsx` (reuses `ScorecardView`) | No |
| P2 | 3.3 — Scorecard in-page navigation | `MatchPage.tsx` | **Yes, heavily — hard-blocked** |
| P3 | 1.2 — Quick rematch/duplicate match | `MatchesPage.tsx`, `MatchSetupPage.tsx` | Low |
| P3 | 1.3 — Team size/wickets bounds validation | `MatchSetupPage.tsx` | Low |
| P3 | 1.4 — Toss re-confirmation at match start | `ScoringPage.tsx` | No |
| P3 | 4.1 — Faster scoring taps | `ScoringPage.tsx` | No |
| P3 | 4.3 — Remembered scorer preferences | `MatchSetupPage.tsx`, new local store | Low |
| 🚫 | Phase 5 items (now including true solo LMS batting) | `src/domain/scoring.ts` | N/A — permanently out of scope |

### What can start the instant V3 merges, no further check needed
**1.4, 2.4, 4.1, 4.2a/4.2b** (2.1a, 2.2, 2.3, and 3.1 all done — see below) — files touched are
exclusively `ScoringPage.tsx`/`ScoringModals.tsx`/`scoring.service.ts`, which nothing in V3's scope,
current or planned, goes near. 2.2 and 2.3 both ended up landing entirely in this same zero-overlap
set — each slice's own plan preferred keeping `MatchPage.tsx` untouched, and both stuck to it.

### What needs a fresh look at the merged file before starting
**3.3** (touches `MatchPage.tsx` directly, which was under active V3 development — check its
current state before starting), and **1.1/1.2/1.3/4.3** (low risk, but `MatchSetupPage.tsx` could
have been touched by V3's Phase 5 "UI consistency pass over Phases 1-4").

---

## P0 findings — both done

- **Slice 2.1a — Last-man-stranded detection + guided innings closure** ✅ **Done and verified** —
  see the full write-up below for implementation and live-verification details.
- **Slice 2.2 — Abandon match control + reopen safety net** ✅ **Done and verified** — see the full
  write-up below.

`ROADMAP_V3` was confirmed complete, merged, and verified before 2.1a started. Both P0 slices are
now implemented, `tsc`/`npm run build` clean, and verified live end-to-end, each committed
separately per the one-verified-slice-at-a-time process. **Slices 2.3 and 3.1 (both P1) are also
now done** — see their write-ups below. **4.2a (Mobile scorer experience audit) is next.**

---

## Phase 1 — Match Setup & Playing Conditions

### Slice 1.1 — Setup wizard validation feedback
**Problem**: `MatchSetupPage.tsx`'s `canAdvance()` silently disables "Next" with no message
explaining why.

- **Affected files**: `src/features/matches/MatchSetupPage.tsx` only.
- **Architecture**: Additive-only — introduce a sibling `advanceBlockedReason(): string |
  undefined` next to the existing `canAdvance(): boolean`, one branch per step mirroring the
  existing validation conditions exactly (no restructuring of the boolean gate itself, so there's
  zero chance of the messaging logic and the actual gate silently drifting apart over time —
  though this is worth a code-review note: **a future edit to `canAdvance()` without a matching
  edit to `advanceBlockedReason()` would produce a wrong or missing message** — mitigate by keeping
  the two functions adjacent in the file with a comment cross-referencing them).
- **Risks**: Low. Purely additive messaging; the identified drift risk above is cosmetic (wrong
  hint text), never a functional regression, since the boolean gate is untouched.
- **Dependencies**: None.
- **Rollback**: Trivial — revert the file. No data, schema, or Firestore write is involved; nothing
  to clean up post-revert.
- **Restrictions compliance**: Does not touch `scoring.ts`, `Delivery`/`BallInput`, or offline
  infrastructure. ✅ Compliant.
- **Acceptance criteria**:
  - Each of the 5 gated steps shows a specific, correct reason when blocked, verified by
    deliberately leaving each step's condition unmet in turn.
  - Zero change in *when* `Next` is enabled/disabled versus current behavior.
  - `tsc`/`npm run build` clean; live-verified by walking the wizard end to end.

### Slice 1.2 — Quick rematch / duplicate match
**Problem**: No way to reuse a previous match's teams/squads/Match Rules for a repeat fixture.

- **Affected files**: `src/features/matches/MatchesPage.tsx` (new "Duplicate" row action),
  `src/features/matches/MatchSetupPage.tsx` (new `?duplicate=<matchId>` load path, sibling to the
  existing `?edit=<matchId>` one).
- **Architecture**: Reuses the existing edit-mode `useEffect`'s field-mapping shape rather than
  inventing a new one — add a second branch (`duplicateId` from `useSearchParams`) that calls the
  same `getMatch()` and maps to the same `FormState` shape, but explicitly **excludes** fields that
  shouldn't carry over: `title` (would produce a literal duplicate title), `date`/`time` (a
  rematch is a new fixture, not the same timestamp), `tossWinner`/`tossDecision` (reset to unset —
  a new match needs its own toss), and — **found during this pass's review, missed in the last
  one** — `stage` (a duplicated "Final" would silently carry the `final` knockout-stage tag onto an
  unrelated new match; reset to `''`/group-phase default, since the scorer duplicating a match is
  very unlikely to also mean "and make this the new Final").
- **Risks**: Low-moderate.
  - Squad pre-fill may reference player IDs no longer on the team roster (a player left since the
    source match) — `candidatePlayers()` already tolerates squad members not in `team.playerIds`
    for display purposes, so this degrades gracefully (shows the stale name) rather than crashing,
    but worth surfacing a subtle "some players have left this team" hint if a pre-filled squad
    member no longer appears in the team's current roster.
  - The `stage` carry-over bug identified above — must be explicitly reset, not just left to
    "whatever the source match had."
- **Dependencies**: None on other V4 slices; can ship independently of 1.1 despite sharing a file.
- **Rollback**: Trivial for the mechanism itself (no schema change — a duplicated match is a
  perfectly normal `Match` doc, deletable via the existing Trash/soft-delete flow like any other
  mis-created match). No special rollback path needed.
- **Restrictions compliance**: No `scoring.ts`/`Delivery` change. ✅ Compliant.
- **Acceptance criteria**:
  - Duplicating a real match pre-fills teams/squads/format/overs/wickets/team size/powerplay/LMS/
    retired-hurt/Super-Over/tournament, but leaves title/date/time/toss/stage blank or reset.
  - The resulting match is a genuinely new document; the source match is unchanged.
  - Duplicating a knockout-stage match does not carry the stage tag onto the new match (explicit
    regression check for the bug found in this pass).
  - `tsc`/`npm run build` clean; live-verified once auth is available.

### Slice 1.3 — Team size / wickets bounds sanity
**Problem**: No upper bound or sanity check when wickets ≥ team size.

- **Affected files**: `src/features/matches/MatchSetupPage.tsx` only.
- **Architecture**: Advisory-only text, no new validation gate — deliberately not blocking, since
  an unusual-but-intentional configuration should stay possible (matches this codebase's existing
  "don't add validation for scenarios that must be prevented vs. do flag scenarios that are
  probably a mistake" distinction, e.g. the powerplay-overs-vs-total-overs check which *is* a hard
  gate because exceeding total overs is never valid, unlike wickets ≥ team size which is unusual
  but not invalid).
- **Risks**: Very low.
- **Dependencies**: None.
- **Rollback**: Trivial — revert the file.
- **Restrictions compliance**: ✅ Compliant.
- **Acceptance criteria**: Warning shows exactly when `maxWickets >= teamSize`; wizard still
  advances normally either way. `tsc`/`npm run build` clean.

### Slice 1.4 — Toss re-confirmation at match start
**Problem**: The toss is fixed at setup time, often before the real pitchside coin toss; no way to
correct it without leaving the scoring flow.

- **Affected files**: `src/features/scoring/ScoringPage.tsx` (`PreMatch` component only). Reuses
  the already-accepting `updateMatch()` (`matches.service.ts`) — no new service function.
- **Architecture**: Duplicate the small toss-picker UI inline in `PreMatch` rather than extracting
  a shared component with `MatchSetupPage.tsx`'s Toss step — matches this codebase's stated
  preference for "three similar lines" over a cross-file abstraction for two small, independently
  evolving UIs (the wizard's toss step also has to coordinate with `canAdvance()`/step navigation;
  `PreMatch`'s copy doesn't need any of that machinery, so sharing one component would mean
  threading unused props through for one side).
- **Risks**: Low. `PreMatch` only renders pre-`startMatch()` — no live innings state exists yet to
  disturb, so re-editing toss any number of times before starting is inherently harmless. **One
  edge case to explicitly handle**: if the scorer edits toss *after* already having picked openers
  in a prior visit to this screen... actually not possible, since openers are only selectable after
  `startMatch()` flips status to `'live'` (a separate screen state) — confirmed no overlap window
  exists where both toss-editing and openers-picking are simultaneously reachable.
- **Dependencies**: None.
- **Rollback**: Trivial — reverting the toss edit is just picking it again before `startMatch()`;
  once the match has started, this screen is unreachable anyway (status is no longer `'setup'`), so
  there's no "rollback after the fact" scenario to design for.
- **Restrictions compliance**: ✅ Compliant — no engine involvement, `PreMatch` is pre-`startMatch()`.
- **Acceptance criteria**: Editing toss on `PreMatch` and starting the match produces a `Match`
  whose `toss`/`battingFirstTeamId`/first-innings `battingTeamId` reflect the edited toss, not the
  original. `tsc`/`npm run build` clean; live-verified once auth is available.

## Phase 2 — Live Scoring Correctness & Flow

### Slice 2.1a — Last-man-stranded detection + guided innings closure ✅ Done (P0 — revised scope)
**Problem** (re-verified against `scoring.ts` directly this pass): `ScoringPage.tsx`'s
`needBatter` has no concept of a true last-man scenario. When Last Man Standing is enabled and a
team's second-to-last recognized batter falls, `needBatter` still fires, `incomingOptions` is
empty, and `PlayerPickModal` shows a generic "No eligible players" with **no path forward** — the
scorer is stuck on that screen. **Unlike Pass 2's plan, the fix does not attempt to let scoring
continue solo** — confirmed impossible without modifying `scoring.ts`'s hard `nonStrikerId` guard,
which is off-limits.

- **Affected files**: `src/features/scoring/ScoringPage.tsx` only — the `needBatter` derivation and
  `PlayerPickModal`'s rendering for this specific case.
- **Architecture**:
  1. Compute `lastManStranded = match.lastManStanding && !inn.isComplete && incomingOptions.length
     === 0 && (!inn.strikerId || !inn.nonStrikerId)` — same inputs as today's `needBatter`, just
     distinguishing "no eligible replacement exists at all" from "one exists and just needs
     picking."
  2. When `lastManStranded` is true, render a distinct, purpose-built message in place of the
     generic `PlayerPickModal` empty state: something like "No partner remains for \[batting team\]
     — this innings is effectively over," with a prominent button that calls the **already-existing
     and already-correct** `endInnings()` (no new service logic — this slice is entirely a
     detection-and-messaging layer over an existing, working action).
  3. `endInnings()` was re-checked this pass and confirmed to have no striker/non-striker/bowler
     precondition (it only flips `isComplete`/`closeReason` on the innings snapshot and updates
     match status) — safe to call from this stranded state.
- **Risks**: Low-moderate, now that the plan doesn't touch the engine at all.
  - Getting the "no eligible replacement" detection subtly wrong is still the main risk — needs
    explicit test coverage for **both** directions: a normal 9th-wicket-down state with one
    eligible incoming batter (must still show the normal picker, not the stranded message), and a
    true LMS-stranded state (must show the stranded message, not the normal picker).
  - **Naming/scope clarity**: this slice does not implement "Last Man Standing" batting in the
    cricket-realism sense (an actual not-out batter continuing to face and run alone) — it makes
    the *existing* flag's effect (a wider all-out threshold) end in a clean, understood UI state
    instead of a confusing dead end. This distinction should be documented plainly wherever this
    feature is described to the user, to avoid it reading as "LMS now works" when only the failure
    mode was fixed, not the underlying capability gap.
- **Dependencies**: None — self-contained, reads only the already-wired `match.lastManStanding`.
- **Rollback**: Trivial — revert the file. No data/schema implication; the underlying `endInnings()`
  call this slice triggers is the same existing, already-safe action a scorer can already invoke
  manually from the footer today.
- **Restrictions compliance**: ✅ Compliant — confirmed via direct re-read of `scoring.ts` (line
  177-178) that no engine change is needed or attempted; this is strictly a `ScoringPage.tsx`
  UI/detection change calling an existing, unmodified service function.
- **Acceptance criteria**:
  - A match with Last Man Standing enabled, played down to the true stranded state, shows the new
    guided-closure message (not the generic "No eligible players" empty state) and successfully
    ends the innings via the provided button.
  - The same match state with Last Man Standing **disabled** is unreachable in the first place
    (the normal all-out threshold closes the innings automatically one wicket earlier, per
    `evaluateInningsEnd`'s existing logic) — confirms this slice only ever activates for the LMS
    case, never changes behavior for the non-LMS majority of matches.
  - A normal 9th-wicket-down state (one eligible replacement batter available) still shows the
    ordinary `PlayerPickModal`, unaffected — explicit regression check.
  - `tsc`/`npm run build` clean. Live verification requires actually playing a squad down to the
    true LMS-stranded state with real Firestore test data — flag clearly if a working authenticated
    session isn't available to complete that specific check, same caveat as before.

**Implemented and verified.** `needBatter`'s derivation was reordered so `incomingOptions` is
computed first (it's now needed by the new `lastManStranded` check too), then `lastManStranded`
excludes that state from `needBatter`, and the score-pad-visible condition gained a matching
`!lastManStranded` exclusion so the normal scoring UI can't render in the dead-end state either.
`tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean (pre-existing, unrelated lint
warning on this file's `ScoreHeader` unused param untouched). **Verified live against the real
database**, not just code review: created a real throwaway 2-a-side match ("LMS Stranded Test",
`maxWickets: 1`, `lastManStanding: true` — the smallest squad that reaches the true stranded state
after exactly one wicket) via the actual wizard, started it, and recorded a real wicket via the
actual `WicketModal`/`recordBall` path. Confirmed:
- The generic "No eligible players" `PlayerPickModal` never appeared.
- The new "No partner remains for MWA" card rendered instead, with the normal score pad correctly
  hidden underneath it (no way to attempt further scoring in the dead-end state).
- Clicking through to "End innings" (the browser automation's native `confirm()` dialog needed a
  one-line `window.confirm` override to click through reliably — a testing-tool limitation, not an
  app issue, confirmed by observing the **pre-existing** footer "End innings" button hit the exact
  same dialog behavior) correctly called the existing `endInnings()`, transitioned to
  `innings_break`, and the second innings started normally chasing the correct target.
- Completed the match end-to-end (Team B won by 2 wickets — incidentally also re-confirming the
  `effectiveSquadSize`/Last-Man-Standing margin math from the earlier Match Settings slice is still
  correct) to fully exercise the flow rather than stopping at the fix's own boundary.
- **Not verified live**: the regression case (LMS disabled, or a normal 9th-wicket-down state with
  an eligible replacement) — this relies on the engine's existing, already-verified
  `evaluateInningsEnd`/`needBatter` logic being unchanged, which a full re-read of the diff confirms
  (no line touching the non-LMS path), so this is asserted by code review rather than a second live
  match, to keep the throwaway test data footprint small.
- **Known cleanup gap**: the "LMS Stranded Test" match could not be deleted through this same
  browser automation session (the delete action also depends on a native `confirm()` dialog, and
  repeated attempts with the same override technique didn't reliably take effect this time) — it
  remains in the database and should be deleted manually.

### Slice 2.2 — Abandon match control + reopen safety net ✅ Done (P0 — expanded scope)
**Problem**: `abandonMatch()` is fully implemented but has zero call sites anywhere — confirmed by
grep, unchanged from Pass 2. **New in this pass**: there is also **no way to reverse an abandoned
match back to live** anywhere in the app (confirmed by grepping `matches.service.ts` for any
status-reset/"reopen" function — none exists). Shipping a one-way, irreversible action with no undo
path is a real production risk this pass surfaces explicitly, per the "rollback considerations"
review.

- **Affected files**: `src/features/scoring/ScoringPage.tsx` (the abandon action itself), plus a
  new small reopen action — either as a second control on `ScoringPage.tsx`'s completed/abandoned
  screen (lowest risk, no new file dependency) or an admin-only control on `MatchesPage.tsx`/
  `MatchPage.tsx` (higher visibility for after-the-fact fixes made by someone other than the
  original scorer, but touches a file V3 may still be modifying if placed on `MatchPage.tsx`).
- **Architecture**:
  1. **Abandon action**: import the already-exported `abandonMatch` into `ScoringPage.tsx`, add a
     footer button styled distinctly (danger tone) from "End innings," gated behind the same
     `confirm()` pattern already used elsewhere in this file.
  2. **Reopen action (new this pass)**: a small `reopenMatch(match)` service function
     (`scoring.service.ts`) mirroring `undoLastBall()`'s existing status-reset shape — `{ status:
     'live', result: null, completedAt: null }` — callable from the `ScoringPage.tsx`
     completed/abandoned screen when `match.status === 'abandoned'` specifically (not for a
     genuinely `completed` match with a real result — reopening a properly finished match is a
     different, riskier operation than undoing a mis-tapped abandon, and is deliberately **not**
     in scope here). Placing this on `ScoringPage.tsx` (not `MatchesPage.tsx`/`MatchPage.tsx`) keeps
     the whole slice inside the zero-V3-overlap file set.
- **Risks**: Low on the abandon side (the underlying function is already correct). The reopen
  action is new logic, so:
  - Must be scoped strictly to `status === 'abandoned'` — reopening a `completed` match with a real
    scored result risks a scorer accidentally re-opening a properly finished game and confusing
    downstream stats that already recomputed against its final state (especially once Slice 2.4's
    auto-recompute ships) — explicitly excluded from this slice's scope for that reason.
  - Since `abandonMatch()` doesn't delete or alter any deliveries, reopening is safe from a data
    standpoint (all prior deliveries and innings state are untouched by `abandonMatch` in the
    first place) — confirmed by re-reading `abandonMatch()`'s implementation, which only ever
    writes `status`/`completedAt`/`result`/`updatedAt`.
  - Mis-tap risk on the abandon button itself — mitigated by the existing `confirm()` convention,
    same as `endInnings()`.
- **Dependencies**: None on other slices, though shares the "don't reopen a genuinely completed
  match" boundary with Slice 2.4 (auto-recompute) — noted above.
- **Rollback**: **This is the slice whose own scope is largely "provide a rollback for another
  action."** For the abandon action itself: the new reopen control *is* the rollback path. For the
  reopen action's own mistakes (reopening then wanting to re-abandon): trivially re-triggerable,
  since abandon remains available on the now-`'live'` match.
- **Restrictions compliance**: ✅ Compliant — no engine involvement; `reopenMatch()` writes the same
  shape of fields `undoLastBall()` already writes today for an analogous "re-open a closed
  match/innings" case, so this isn't a novel data shape either.
- **Acceptance criteria**:
  - Tapping "Abandon match" (through confirmation) transitions a real live match to `status:
    'abandoned'` with the correct result summary — verified by reading the resulting doc.
  - Dismissing the confirmation leaves the match untouched.
  - "Reopen match" is available only when `status === 'abandoned'`, transitions it back to
    `'live'` with the innings state exactly as it was at the moment of abandonment (no deliveries
    lost or altered), and is **not** offered for a genuinely `completed` match.
  - `tsc`/`npm run build` clean; live-verified against a real (throwaway) match through the full
    abandon → reopen → abandon-again cycle, cleaned up after.

**Implemented and verified.** Added `reopenMatch()` to `scoring.service.ts` (guards
`if (match.status !== 'abandoned') throw`, then writes exactly
`{ status: 'live', result: null, completedAt: null, updatedAt }` — the same shape
`undoLastBall()` already writes for its own "re-open a closed state" case, no new data shape
introduced). `ScoringPage.tsx` gained a red/danger-styled "Abandon match" button in the live footer
(next to "End innings", same `confirm()` gate) and a "Reopen match" button shown **only** when
`match.status === 'abandoned'` on the completed/abandoned screen — never for a genuinely
`completed` match, since that branch is gated on the exact same status check both in the UI and
(defensively) inside `reopenMatch()` itself. Zero lines of `scoring.ts` touched; no existing
function's signature or behavior changed — `abandonMatch()` is called exactly as it already existed.
`tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing, unrelated
`ScoreHeader` lint warning, untouched). **Verified live against the real database, full cycle**:
created a real throwaway match ("Abandon Reopen Test"), started it, scored a real ball (4 runs) to
establish genuine in-progress state, then:
- Tapped "Abandon match" → confirmed `status: 'abandoned'`, "Match complete / Match abandoned — no
  result" screen, and — critically — a "Reopen match" button present.
- Tapped "Reopen match" → confirmed the match returned to the live scoring screen with **the exact
  same innings state** (4/0, same striker/non-striker/bowler, same partnership, same "this over"
  ball token) — proof `abandonMatch`/`reopenMatch` never touch deliveries or innings.
- Tapped "Abandon match" again from the reopened state → confirmed it abandons cleanly a second
  time, completing the full abandon → reopen → abandon-again cycle with no errors.
- Navigated to a separate, genuinely `completed` match (from the earlier Slice 2.1a test) and
  confirmed its completed screen shows **no** "Reopen match" button at all — the scoping-to-
  abandoned-only requirement holds for the one case that matters most (a real result should never
  be reversible through this control).
- Both throwaway matches ("Abandon Reopen Test", "LMS Stranded Test" — left over from Slice 2.1a's
  verification) were successfully soft-deleted via the Matches page once verification finished, so
  there is no leftover test-data cleanup gap from this slice.

### Slice 2.3 — Player of the Match at end-of-match ✅ Done (P1)
**Problem**: `setPlayerOfTheMatch()` is only reachable from the public `MatchPage.tsx`; the scorer
finishing the match on `ScoringPage.tsx` has to leave and find a different control.

- **Affected files**: `src/features/scoring/ScoringPage.tsx` (primary). Optionally
  `src/features/public/MatchPage.tsx` — see the two approaches below, carried over from Pass 2 and
  re-confirmed still correct after this pass's review.
- **Architecture** (unchanged from Pass 2, re-confirmed as the right call):
  - **Preferred**: duplicate the small picker UI directly in `ScoringPage.tsx`, calling the same
    `setPlayerOfTheMatch()` — no shared-component extraction, zero touch to `MatchPage.tsx`.
  - **Alternative** (extract a shared picker): only if duplication proves awkward in practice;
    explicitly deferred until after V3 merges, since it touches the file with the heaviest current
    concurrent-edit risk in the codebase.
- **Risks**: Low for the preferred approach. The one addition from this pass: **both pickers must
  write to the exact same field with no client-side caching that could go stale** — confirmed
  `setPlayerOfTheMatch()` is a direct `updateDoc()` with no local state duplication on either page,
  so there's no cache-invalidation risk to design around.
- **Dependencies**: The alternative approach is blocked on V3 merging; the preferred approach has
  none.
- **Rollback**: Trivial — `playerOfTheMatchId` can be re-set (including cleared, if the picker UI
  supports a "none" option — worth adding, not present in the current `MatchPage.tsx` picker per a
  quick re-check, flagged as a small scope addition: allow un-setting POTM, not just setting it).
- **Restrictions compliance**: ✅ Compliant.
- **Acceptance criteria**: Scorer can pick (and un-pick) Player of the Match from
  `ScoringPage.tsx`'s completed screen without navigating away; result matches on the public
  scorecard afterward; no divergence between the two entry points. `tsc`/`npm run build` clean.

**Implemented and verified — the preferred approach, exactly as planned.** Reused the existing
`PlayerPickModal` component (already imported into `ScoringPage.tsx` for the batter/bowler pickers)
rather than hand-rolling a new modal — same `{id, name, photoURL?}` option shape the file's
existing `playerOption()` helper already builds, so the picker is `[...match.squadA,
...match.squadB]` mapped through that helper, with a synthetic `{id: '', name: 'No award /
clear'}` entry prepended for the un-pick case. `setPlayerOfTheMatch()`'s signature widened from
`playerId: string` to `playerId: string | null` — a backward-compatible widening, not a breaking
change; `MatchPage.tsx`'s existing call site (which always passes a string) needed no changes at
all and was not touched. The button on the completed screen shows "Player of the match" when unset
or "POTM: \[name\]" once one is picked, gated to `match.status === 'completed'` only (matching
`MatchPage.tsx`'s own gate — never offered for an abandoned match, which has no result worth
crediting). Zero lines of `scoring.ts` touched; zero lines of `MatchPage.tsx` touched.
`tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing, unrelated
`ScoreHeader` lint warning). **Verified live against the real database, full cycle**: created a
real throwaway match, force-completed both innings via "End innings" (fastest path to a real
`completed` match without needing to score dozens of balls), picked a real player as POTM from
`ScoringPage.tsx` (confirmed the button updates to show the name), confirmed the same name appears
on the public `/match/:id` scorecard's "Player of the match" section, then cleared it via "No
award / clear" and confirmed the button reverts to unset — the full pick → verify-on-public-page →
clear cycle, not just the happy path. Test match cleaned up (soft-deleted) after verification.

### Slice 2.4 — Auto-recompute stats/standings on completion (P2)
**Problem**: "Update stats" is a manual, separate click after completion — easy to forget.

- **Affected files**: `src/services/scoring.service.ts` — specifically the two places `status`
  actually flips to `'completed'` today: `recordBall()`'s second-innings-complete branch and
  `endInnings()`'s match-complete branch. **Correction from this pass**: the exported
  `completeMatch()` function is a *third*, separate completion path in the file, but re-confirmed
  via grep to have **zero call sites anywhere in the app** — it's dead code, not a live third path.
  This slice only needs to instrument the two paths that actually run; `completeMatch()`'s
  dead-code status is a separate, smaller finding folded into Phase 5's "genuine bug fixes" note
  below rather than this slice's scope.
- **Architecture**: After each real completion write succeeds, fire `recomputeAllStats()` (and
  `recomputeTournamentStandings()` if `match.tournamentId` is set) the same way the existing manual
  "Update stats" button does — fire-and-forget (`void recomputeAllStats().catch(e =>
  console.error('auto stats recompute failed', e))`), matching this file's existing
  `notifyMatchDone` error-swallowing convention, so a slow or failed recompute never blocks or
  breaks the scorer's completion flow. Keep the manual button for deliberate re-runs (e.g. after a
  post-match scorecard correction).
- **Risks**: Low-moderate. Needs explicit coverage for `endInnings()`'s match-complete path
  specifically — the least-exercised of the two (a declared/retired-all finish is rarer than a
  normal run-chase completion via `recordBall`), and easy to instrument only one path by mistake.
- **Dependencies**: Should land after Slice 2.2 conceptually (so "abandoned" is excluded from
  auto-recompute — an abandoned match has no result worth recomputing stats against), though not a
  hard code dependency since abandonment already goes through a different function entirely.
- **Rollback**: Trivial to revert (remove the two call sites); no data corruption risk either way,
  since `recomputeAllStats`/`recomputeTournamentStandings` are themselves idempotent, pure
  recomputations from source match data, not incremental mutations — running them extra times or
  reverting the auto-trigger changes nothing about correctness, only about staleness.
- **Restrictions compliance**: ✅ Compliant — no engine involvement, reuses existing stats functions
  unchanged.
- **Acceptance criteria**:
  - Completing a match via a normal run-chase and via a declared/force-closed innings both leave
    stats/standings current with no manual click, verified by reading recomputed docs immediately
    after.
  - Manual "Update stats" still works unchanged for a deliberate re-run.
  - Abandoning a match (Slice 2.2) does **not** trigger a stats recompute.
  - `tsc`/`npm run build` clean.

## Phase 3 — Innings Transition & Scorecard Navigation

### Slice 3.1 — Innings-break scorecard link ✅ Done (P1)
**Problem**: The `innings_break` screen has no link to the scorecard, unlike every other lifecycle
screen.

- **Affected files**: `src/features/scoring/ScoringPage.tsx` (`status === 'innings_break'` branch)
  only.
- **Architecture**: Reuse the exact same `Link to={`/match/${match.id}`}` pattern already used
  twice elsewhere in this file — no new component, no new pattern.
- **Risks**: Negligible.
- **Dependencies**: None.
- **Rollback**: Trivial — revert the file.
- **Restrictions compliance**: ✅ Compliant.
- **Acceptance criteria**: Working scorecard link from the innings-break screen, showing the
  just-completed first innings correctly. `tsc`/`npm run build` clean.

**Implemented and verified exactly as planned.** Used a `Button variant="outline"` alongside the
existing "Start 2nd innings" primary button (`navigate()`-based, matching the completed screen's
button-row convention, rather than the live footer's pill-`Link` style — this screen's layout is
the same centered-card shape as the completed screen, not the footer bar). `tsc -p
tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
database**: created a real throwaway match, force-ended the first innings via "End innings" to
reach a genuine `innings_break` state, confirmed the new "Scorecard" button renders, clicked it,
and confirmed it navigates to `/match/:id` showing the just-completed first innings correctly
("MWA 0/0", "Innings break — 2nd innings about to begin"). Test match soft-deleted after
verification.

### Slice 3.2 — In-scoring-screen scorecard view (P2)
**Problem**: The live footer's "Scorecard" link navigates away entirely.

- **Affected files**: `src/features/scoring/ScoringPage.tsx` (new modal state), reusing
  `src/features/scorecard/ScorecardView.tsx` directly.
- **Architecture note from this pass**: confirmed by reading `ScorecardView.tsx` that it **already
  has its own internal per-innings `Tabs`** (for a completed 2-innings match) — so embedding it in
  a modal gets innings-switching for free, lower implementation risk than Pass 2 assumed. Its props
  (`match`, `players`, `deliveries`) are all already available in `ScoringPage.tsx`'s own state —
  no new data-fetching needed for the modal.
- **Risks**: Low — the component being embedded is already proven via `EmbedScorecardPage.tsx`
  (stable, not part of V3's current changes).
- **Dependencies**: Benefits from, but doesn't require, Slice 3.1's consistent link placement.
- **Rollback**: Trivial — revert the file; `ScorecardView` itself is untouched, so nothing about
  its other consumers (`MatchPage.tsx`, `EmbedScorecardPage.tsx`) is affected either way.
- **Restrictions compliance**: ✅ Compliant.
- **Acceptance criteria**: In-scoring scorecard modal shows figures matching the live `ScoreHeader`
  exactly (no staleness); closing it preserves in-progress UI state (e.g. a half-selected extra).
  `tsc`/`npm run build` clean.

### Slice 3.3 — Scorecard page in-page navigation (P2, hard-blocked)
**Problem**: `MatchPage.tsx` (639 lines pre-V3-merge) has no page-level section-jump navigation
between Scorecard/Insights/Timeline/Comments/Reactions/Gallery.

- **Correction from this pass**: `ScorecardView`'s own innings-switching (confirmed in 3.2's note
  above) means the scorecard *sub-section* is already navigable — the actual gap is strictly at the
  page level, between the scorecard section and every *other* section stacked below it. This
  narrows the slice's real scope versus Pass 2's framing.
- **Affected files**: `src/features/public/MatchPage.tsx` — the single largest-blast-radius file in
  this roadmap, and one of the two files under active V3 development right now.
- **Architecture**: Deferred by design — a sticky in-page sub-nav or the existing `Tabs.tsx`
  (already proven on `TournamentPage.tsx`) grouping Scorecard / Insights / Timeline / Comments,
  finalized only after re-reading the post-merge file, since V3's additions (calendar button,
  `FixturesCalendar` linkage) will change its actual section order/content before this starts.
- **Risks**: **High** — purely about timing, not the idea. Starting before V3 merges guarantees a
  conflict on the highest-churn file in the codebase.
- **Dependencies**: **Hard-blocked on `ROADMAP_V3` merging.** Clearest "must wait" case in this plan.
- **Rollback**: To be assessed once scoped against the merged file — likely trivial (additive
  navigation aid, not a content rearchitecture) but not finalized here on purpose.
- **Restrictions compliance**: ✅ Compliant in principle (pure UI navigation, no engine/data-shape
  involvement) — re-confirm once actually scoped post-merge.
- **Acceptance criteria** (to be refined post-merge): every section currently reachable by
  scrolling remains reachable; no section requires more clicks than today for a visitor who
  prefers to just scroll. `tsc`/`npm run build` clean; live-verified against a real match with
  every optional section populated.

## Phase 4 — Faster, Mobile Scorer Workflow

### Slice 4.1 — Fewer taps for common scoring actions (P3)
- ⬜ Deliberately least-specified — no concrete slow sequence identified in either audit pass.
  **Affected files**: `ScoringPage.tsx` (`ScorePad`). **Risk**: low but speculative — don't build
  ahead of real scorer feedback. **Dependencies**: none. **Rollback**: trivial. **Restrictions**:
  ✅ compliant (UI-only). **Acceptance criteria**: deferred until a concrete case is named.

### Slice 4.2a — Mobile scorer experience audit (read-only) (P1)
**Problem**: `ROADMAP_V3` Slice 1.2 scoped its 375px audit to spectator surfaces only —
`ScoringPage.tsx` has never been checked at a phone viewport.

- **Affected files**: none — read-only measurement pass (`ScoringPage.tsx`, `ScoringModals.tsx`).
- **Architecture**: Same programmatic-measurement technique as `ROADMAP_V3` Slice 1.2 (`scrollWidth`
  vs `innerWidth`, per-element bounding rects), reused for consistency and because that pass found
  screenshot tooling unreliable — no reason to assume it's more reliable now.
- **Split from Pass 2's single "4.2"**: separated the audit (no code risk, pure measurement) from
  the fixes (4.2b, below) so the audit can complete and be reviewed before committing to any
  specific fix — mirrors `ROADMAP_V3` Slice 1.2's own audit-then-fix structure.
- **Risks**: None — read-only.
- **Dependencies**: None. Blocks 4.2b (fixes can't be scoped before findings exist).
- **Rollback**: N/A — produces no code change.
- **Restrictions compliance**: ✅ Compliant (no code change at all).
- **Acceptance criteria**: A findings list covering `ScoreHeader`, `ScorePad`'s tap targets,
  `WicketModal`/`OpenersPanel`/`PlayerPickModal` layouts at 375px, and whether the keyboard-shortcuts
  affordance makes sense on a touch-only device.

### Slice 4.2b — Mobile scorer fixes (scoped by 4.2a) (P1/P2 depending on findings)
- **Affected files**: Whatever 4.2a's findings name — expected to stay within `ScoringPage.tsx`/
  `ScoringModals.tsx` based on the audit's scope, but not finalized until 4.2a completes.
- **Risks/Dependencies/Rollback/Acceptance criteria**: Cannot be meaningfully specified before 4.2a
  runs — intentionally left open rather than guessed at.
- **Restrictions compliance**: To be re-confirmed per actual fix once scoped, but expected ✅ given
  the file set involved.

### Slice 4.3 — Remembered scorer preferences (P3)
- ⬜ No concrete pain point identified in either audit pass — deliberately undesigned pending real
  friction reports, same reasoning as 4.1. **Affected files**: `MatchSetupPage.tsx` + a new
  localStorage-backed store (mirrors `favStore`/`bgStore`'s existing pattern). **Risk**: low
  technically; real risk is building unused scaffolding for a need that never materializes.
  **Restrictions**: ✅ compliant in principle. **Acceptance criteria**: deferred.

## Phase 5 — Identified, but requires touching the verified scoring engine (🚫 out of scope)

- **True solo Last-Man-Standing batting** *(moved here this pass, confirmed by direct code read)*
  — `applyBall`'s hard `nonStrikerId` guard (`scoring.ts` line 177-178) would need to change to
  allow a null non-striker, and `swapStrike()` would need new logic for what "rotating strike"
  means with only one batter. Off-limits; Slice 2.1a above solves the scorer-facing symptom
  (getting stuck) without this.
- **Free hit** (next ball after a no-ball can only dismiss by run-out) — needs `applyBall` to track
  "previous ball was a no-ball" state and change `wicketCountsAsDismissal` behaviour for exactly one
  subsequent ball.
- **DRS / review system** — no umpire-decision or reversal concept exists in `Delivery`/
  `WicketEvent`; would need a new mutation path into already-recorded deliveries.
- **Drinks-break / mid-innings-stoppage timestamps** — would need new fields on `InningsState`
  (off-limits shape).

**Also flagged, not a Phase 5 item but worth a separate note**: `completeMatch()`
(`scoring.service.ts`) is exported but has zero call sites anywhere in the app — genuinely dead
code (distinct from `abandonMatch()`'s prior state, which was unused-but-needed; this one appears
to be superseded by `recordBall`/`endInnings` handling completion inline). Candidate for
`ROADMAP_V3` Phase 5's own "genuine bug fixes" pass (dead-code removal) rather than a `ROADMAP_V4`
slice, since it's not scorer-experience-shaped — noting it here so it isn't lost between the two
roadmaps' scope boundaries.

---

### Notes
- **Nothing in this file is implemented until `ROADMAP_V3` is complete, merged, and verified.**
- Once unblocked, priority order within the no-overlap set: **2.1a, 2.2 (both P0, pending explicit
  approval)** → 3.1 → 4.2a → 4.2b → 1.4 → 2.4 → 4.1 → 1.1/1.2/1.3/4.3 (re-check `MatchSetupPage.tsx`
  post-merge first).
- **2.3** and **3.3** need a fresh read of the merged `MatchPage.tsx` before being scoped further;
  **3.3** specifically should not start until well after merge, given its blast radius.
- Every slice ends with `tsc` + `npm run build` green and a live smoke test where auth allows it.
- This file intentionally has zero ✅ — it is a plan awaiting approval, not a log of completed work.
