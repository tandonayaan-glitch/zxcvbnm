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
- **Pass 8**: **Slice 3.1 (Innings-break scorecard link) implemented and verified live** — a small,
  low-risk addition; four of the six zero-V3-overlap slices are now done.
- **Pass 9**: **Slice 4.2a (mobile scorer experience audit) completed** — read-only,
  live at a real 375×812 viewport against a real match, walking the full lifecycle including
  `WicketModal`'s most complex state. Found the responsive foundation holds up here too, with one
  genuine issue: the "Keyboard shortcuts" button is undersized *and* leads to information that's
  meaningless on a touch-only device. Slice 4.2b, previously unscoped, is now fully scoped to fix
  exactly that one thing.
- **Pass 10**: **Slice 4.2b (hide the Shortcuts button on touch-primary devices)
  implemented and verified live end-to-end**, including the discovery that the Browser pane's
  mobile viewport preset doesn't emulate `pointer: coarse` and the `matchMedia` override/SPA-remount
  workaround used to test it anyway. All P1-and-above slices are now done; only P2/P3 slices remain.
  User authorized continuing through the remaining ROADMAP_V4 slices in priority order without
  pausing for per-slice approval.
- **Pass 11**: **Slice 1.4 (toss re-confirmation at match start) implemented and verified
  live end-to-end**, including a real batting-team flip (not just a same-result round-trip) to
  conclusively prove `battingFirstTeamId` — not just `toss` — gets recomputed on save. Proceeding
  autonomously through the remaining P2/P3 slices per the user's standing authorization.
- **Pass 12**: **Slice 2.4 (auto-recompute stats/standings on completion) implemented and
  verified live end-to-end for both completion paths** (a natural run-chase finish via `recordBall`
  and a declared finish via `endInnings`), using before/after Stats-page snapshots rather than just
  checking for the absence of errors. Every P0/P1/P2 no-overlap slice is now done except 3.2 (P2,
  still open) and 3.3 (P2, hard-blocked pending a fresh `MatchPage.tsx` read); remaining P3 slices
  (1.2, 1.3, 4.1, 4.3) and 1.1 (P2, `MatchSetupPage.tsx`) are also still open. **Re-evaluated 4.1 and
  4.3 and formally closed both as intentionally deferred** — re-reading `ScorePad` found no concrete
  slow tap-sequence to fix, and "remembered preferences" has open design questions (which fields,
  per-scorer vs per-device, silent vs confirmed) that only a real friction report can answer;
  building either now would mean designing for a hypothetical need, which this codebase's own
  conventions (and each slice's own original write-up) say to avoid. Proceeding to the remaining
  concretely-scoped slices: 1.1, 1.3, 1.2, 3.2, then 3.3 last (needs the freshest `MatchPage.tsx`
  read given its blast radius).
- **Pass 13**: **Slice 1.1 (setup wizard validation feedback) implemented and verified
  live end-to-end**, walking every one of the six sub-cases across the wizard's five gated steps
  (including the compound powerplay-exceeds-overs check) and confirming each shows the correct
  specific reason and clears exactly when `canAdvance()` would allow "Next" — no data write involved,
  so no test match needed creating or cleaning up. First slice of this pass to touch
  `MatchSetupPage.tsx`; confirmed (per the file itself, unchanged from Pass 3's audit) it hasn't
  picked up any conflicting edits since V3 merged.
- **Pass 14**: **Slice 1.3 (team size/wickets bounds sanity) implemented and verified
  live end-to-end**, confirming the advisory warning appears with live-interpolated values exactly
  when `maxWickets >= teamSize`, stays out of the way at normal defaults and after the existing
  team-size-change auto-recompute, and never blocks "Next" — no test match needed.
- **Pass 15 (this one)**: **Slice 1.2 (quick rematch/duplicate match) implemented and verified live
  end-to-end, with one real bug found and fixed during verification** — the duplicate-load effect
  originally reset title/date/time/toss *by omission* (relying on the form's initial blank state)
  rather than explicitly, which leaked stale values if `MatchSetupPage` stayed mounted across a mode
  switch (not reachable via the real product UI, but a genuine latent robustness gap caught by
  testing an SPA-navigation edge case, not by code review alone). Fixed and re-verified. Also caught
  and corrected a test-methodology mistake along the way: the first attempt to set a knockout stage
  on the throwaway source match silently didn't take (a tool-sequencing artifact), which would have
  made the stage-reset regression check pass vacuously — caught by checking the actual saved value
  rather than assuming the write succeeded, then corrected via the match's own Edit flow before
  re-testing. Eleven of thirteen implementable slices now done (two more, 4.1/4.3, formally
  deferred rather than implemented); only 3.2 and the hard-blocked 3.3 remain.

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
| P1 | ✅ 4.2a — Mobile scorer audit (read-only) | none (measurement only) | No |
| P2 | ✅ 4.2b — Mobile scorer fixes (hide Shortcuts button on touch devices) | `ScoringPage.tsx` | No |
| P2 | ✅ 1.1 — Setup wizard validation feedback | `MatchSetupPage.tsx` | Low (Phase-5-polish note) |
| P2 | ✅ 2.4 — Auto-recompute stats on completion | `scoring.service.ts` | No |
| P2 | 3.2 — In-scoring scorecard view | `ScoringPage.tsx` (reuses `ScorecardView`) | No |
| P2 | 3.3 — Scorecard in-page navigation | `MatchPage.tsx` | **Yes, heavily — hard-blocked** |
| P3 | ✅ 1.2 — Quick rematch/duplicate match | `MatchesPage.tsx`, `MatchSetupPage.tsx` | Low |
| P3 | ✅ 1.3 — Team size/wickets bounds validation | `MatchSetupPage.tsx` | Low |
| P3 | ✅ 1.4 — Toss re-confirmation at match start | `ScoringPage.tsx` | No |
| P3 | 🚫 4.1 — Faster scoring taps *(deferred, no concrete case)* | `ScoringPage.tsx` | No |
| P3 | 🚫 4.3 — Remembered scorer preferences *(deferred, no concrete case)* | `MatchSetupPage.tsx`, new local store | Low |
| 🚫 | Phase 5 items (now including true solo LMS batting) | `src/domain/scoring.ts` | N/A — permanently out of scope |

### What can start the instant V3 merges, no further check needed
**4.1** (2.1a, 2.2, 2.3, 3.1, 4.2a, 4.2b, 1.4, and 2.4 all done — see below) — files touched are
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
now done** — see their write-ups below. **Slice 4.2a is also now done** (read-only audit; see its
write-up). **Slice 4.2b is also now done** (hid the Shortcuts button on touch-primary devices; see
its write-up). **Slice 1.4 is also now done** (toss re-confirmation on `PreMatch`; see its
write-up). **Slice 2.4 is also now done** (auto-recompute stats/standings on completion; see its
write-up). **Slices 4.1 and 4.3 have been formally closed as intentionally deferred** — no concrete
case for either after re-evaluation; see their write-ups. **Slice 1.1 is also now done** (setup
wizard validation feedback; see its write-up). **Slice 1.3 is also now done** (team size/wickets
bounds sanity; see its write-up). **Slice 1.2 is also now done** (quick rematch/duplicate match,
including a real stale-mount bug found and fixed during verification; see its write-up). **Slice 3.2
(in-scoring-screen scorecard view) is next**, leaving only 3.2 and the hard-blocked 3.3 remaining.

---

## Phase 1 — Match Setup & Playing Conditions

### Slice 1.1 — Setup wizard validation feedback ✅ Done (P2)
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

**Implemented and verified exactly as planned.** Added `advanceBlockedReason(): string | undefined`
directly after `canAdvance()`, one branch per step, kept adjacent with a cross-referencing comment
on `canAdvance()` per the plan's own drift-mitigation note. Step 2's messages use the actual team's
`shortName` (falling back to "Team A"/"Team B" if unresolved) rather than a generic "this team",
reusing the already-derived `teamA`/`teamB` locals. The footer nav wraps the existing "Next" button
in a `flex-col` with the reason rendered above it only when `!canAdvance() && advanceBlockedReason()`
— purely additive, the `disabled={!canAdvance()}` gate itself untouched. `tsc -p
tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
database by walking the entire wizard, deliberately leaving each gated step's condition unmet in
turn** (no match was created — this slice has no data-write path to test): Step 1 (Details) showed
"Enter a match title to continue." and cleared once typed; Step 2 (Teams) showed "Select Team A to
continue." → "Select Team B to continue." → "Team A and Team B must be different teams." across the
three sub-cases, each clearing correctly as the form state resolved it; Step 3 (Playing XI) showed
"Pick at least 2 players for MWA's Playing XI." then "Pick at least 2 players for MWB's Playing XI."
using the real team short names; Step 4 (Toss) showed "Select who won the toss to continue."; Step 5
(Match Rules) showed "Overs per innings must be between 1 and 120." when set to 0, and — the most
compound of the six conditions — "Powerplay overs cannot exceed the total overs per innings." when
powerplay overs (15) exceeded total overs (10), both clearing once reset to valid values with "Next"
re-enabled. Confirmed `Next`'s disabled/enabled state matched the message's presence/absence at
every step, exactly as required. No test match was created or needed to be cleaned up.

### Slice 1.2 — Quick rematch / duplicate match ✅ Done (P3)
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

**Implemented and verified, with one real bug found and fixed during verification.** Added a
`Duplicate` `Link` (`Copy` icon) to `MatchesPage.tsx`'s row actions, next to "View", gated by
`canScore(profile)` only — available at any match status, unlike "Edit"/"Start" which are
`setup`-only, since a rematch is meaningful for a completed or abandoned match too. Added a
`duplicateId` load `useEffect` in `MatchSetupPage.tsx` mirroring the edit-mode effect's field
mapping, using a functional `setForm((f) => ({...f, ...}))` update so unlisted fields keep the
form's current value, with `title`/`date`/`time`/`tossWinner`/`tossDecision`/`stage` explicitly
listed and reset rather than simply omitted (see bug below for why "omitted" isn't safe here). Since
`editId` stays unset for a duplicate, `submit()`'s existing `else` branch (`createMatch(payload)`)
runs unchanged — a genuinely new document, zero changes needed to `submit()` itself. `tsc -p
tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing, unrelated
`ScoreHeader` lint warning).
**Bug found during live verification, fixed before considering this slice done**: the first
implementation reset `title`/`date`/`time`/`tossWinner`/`tossDecision` by *omission* — relying on
the form's initial blank `useState` defaults rather than explicitly setting them — which works when
`MatchSetupPage` mounts fresh (the real, only user-reachable path: the "Duplicate" link is on
`/matches`, a different route, so React always remounts the page), but fails if the component
somehow stays mounted across a mode switch (discovered while testing edit-mode's stage field via
`history.pushState`/`popstate` SPA navigation from `?edit=` straight to `?duplicate=` on the same
`/matches/new` route, which does **not** force a remount) — a stale `title` from the prior edit
session leaked through. Fixed by explicitly setting all five fields in the duplicate effect instead
of relying on implicit initial state, and re-verified the exact same stale-mount scenario shows a
correctly blank title. Not reachable via the actual product UI today, but a real latent bug in the
component's own robustness, worth fixing rather than leaving as a "won't happen in practice"
assumption.
**Verified live against the real database, full cycle, including the corrected stage-reset
regression check**: created a real throwaway source match ("Duplicate Source Test") on the
knockout-capable "CricketHub Cup" tournament with distinctive values throughout (`CUSTOM` format,
15 overs, a real venue, asymmetric 3-vs-2 squads, Last Man Standing on, Retired Hurt off, Super Over
on) — the *first* attempt to also set its knockout stage to "Final" during creation silently failed
(a `form_input` write to a select that hadn't re-rendered yet, an artifact of the tool sequencing,
not an app bug), which was caught by directly checking the saved value afterward rather than
assuming the write took — corrected via the match's own Edit flow before re-testing. With the
source genuinely at `stage: 'final'`, duplicating it produced a form with: title blank ("Enter a
match title to continue." shown, confirming no carry-over), teams/asymmetric squad counts (3/2)
carried over exactly, toss unset ("Select who won the toss to continue." shown), format/overs/
venue/team-size/wickets/powerplay/LMS/no-retired-hurt/Super-Over all carried over exactly matching
the source, tournament ("CricketHub Cup") carried over, and — the specific regression check —
**knockout stage reset to "Group / league phase" (`''`), not "Final"**. Completed the duplicate
match creation and confirmed its ID differs from the source's; confirmed the source match's own
tournament/venue/format/toss were unaffected by the duplication (read via its own Edit screen).
Both throwaway matches soft-deleted after verification; neither had ever started scoring, so no
stats-cache pollution occurred (unlike Slice 2.4's test, no post-cleanup recompute was needed).

### Slice 1.3 — Team size / wickets bounds sanity ✅ Done (P3)
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

**Implemented and verified exactly as planned.** Added a conditional amber advisory `<p>` (matching
this codebase's existing non-blocking-hint amber styling, e.g. `ScorePad`'s active-extra hint —
deliberately not `Field`'s red `error` prop, which would visually read as blocking even though
nothing here is) directly below the Team size / Number of wickets field grid, shown only when
`form.maxWickets >= form.teamSize`. No new validation branch added to `canAdvance()` or
`advanceBlockedReason()` — this is a parallel, independent check with no interaction with Slice
1.1's gating logic. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified
live against the real database** — no test match was created, since this slice has no data-write
path: reached the Match Rules step with the wizard's defaults (11-a-side, 10 wickets, no warning,
confirming no false positive at normal values), set team size to 2 (auto-adjusted wickets down to 1
via the existing `onTeamSizeChange` default-recompute — still no warning, confirming that
interaction doesn't produce a false positive either), then set wickets to 2 (equal to team size) and
confirmed the exact warning text with live values interpolated ("Wickets (2) is at or above team
size (2)..."), then to 5 (wickets exceeding team size, text updated to "Wickets (5)..."), confirming
`Next` stayed enabled at every one of these states (the actual acceptance criterion — advisory, not
blocking), then reset wickets to 1 and confirmed the warning disappeared cleanly.

### Slice 1.4 — Toss re-confirmation at match start ✅ Done (P3)
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

**Implemented and verified exactly as planned.** Added local `editingToss`/`tossWinner`/
`tossDecision` state to `PreMatch` and an inline "Edit" toggle next to the existing read-only toss
line, reusing the same two-row team/bat-or-bowl button styling as `MatchSetupPage.tsx`'s Toss step
(duplicated, not extracted, per the plan). Saving calls a new `editToss()` handler in `ScoringPage`
that writes **both** `toss` and a freshly re-derived `battingFirstTeamId` in the same `updateMatch()`
call — re-reading `MatchSetupPage.tsx`'s own creation-time derivation confirmed `battingFirstTeamId`
is always explicitly written at match creation (bat → toss winner, bowl → the other team), so
`battingFirstTeamId(match)` (which prefers the stored field over recomputing from `toss`) would
otherwise silently keep pointing at the *original* toss's batting team even after the `toss` field
itself was edited — writing both fields together was necessary to make the edit actually take
effect, not just cosmetic. `PreMatch`'s own `onStart` and `ScorePad`/live-scoring code paths were
untouched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing,
unrelated `ScoreHeader` lint warning). **Verified live against the real database, with a
genuine flip, not just a round-trip**: created a throwaway match ("Toss Edit Test") where the
original toss (Team A bat first) already matched what the edit produced — a same-result edit that
proved the `toss` field write path (Firestore doc updated, both derived label and the toss line
itself changed to reflect the new winner/decision) but not, on its own, that `battingFirstTeamId`
specifically had been recomputed rather than left stale. Created a second throwaway match ("Toss
Edit Test 2") specifically to close that gap: original toss (Team A win, bowl → Team B bats first),
edited on `PreMatch` to (Team A win, bat → Team A bats first) — a genuine flip of the batting team,
not just a re-save of the same outcome. Confirmed the `PreMatch` summary updated to "Batting first:
MSW Test Team A" immediately after saving, then started the match and confirmed the live
`ScoreHeader` showed **MWA** (Team A) batting, not MWB — conclusively proving the edited toss (and
not the original, stale `battingFirstTeamId`) drove the actual first innings. **Testing nuance**:
firing multiple synthetic `.click()` calls back-to-back in one synchronous script can hit stale
React closures (a click on "Save toss" queried in the same script as the preceding "bat first"
click can still bind to the pre-re-render handler, silently saving the *old* decision) — not an app
bug, since a real user's clicks are naturally separated by render cycles; worked around by splitting
each click into its own tool call with a short wait before the next, and confirming the intermediate
selection's active-state CSS class before proceeding. Both throwaway matches deleted via the
Matches page after verification — no leftover test data.

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

### Slice 2.4 — Auto-recompute stats/standings on completion ✅ Done (P2)
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

**Implemented and verified exactly as planned.** Added a private `autoRecomputeStats(match)` helper
in `scoring.service.ts` (imports `recomputeAllStats`/`recomputeTournamentStandings` from
`stats.service.ts` — confirmed no circular-import risk, since `stats.service.ts` doesn't import
`scoring.service.ts`) that fires both fire-and-forget with `.catch(e => console.error(...))`,
mirroring `notifyMatchDone`'s existing error-swallowing convention exactly. Called it from both of
`recordBall()`'s and `endInnings()`'s `patch.status === 'completed'` branches, right alongside the
existing `notifyMatchDone(...)` call in each — the same two, and only two, places `status` flips to
`'completed'` confirmed live (`completeMatch()` remains untouched, still dead code, still deferred
to the Phase 5 note). `abandonMatch()` was not touched at all, so it categorically cannot trigger a
recompute. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing,
unrelated `ScoreHeader` lint warning). **Verified live against the real database, both completion
paths, with before/after stats snapshots — not just absence of errors**: recorded the public Stats
page's baseline (130 runs scored platform-wide, J Bumrah at 2 innings/10 runs). Created a throwaway
1-over match ("Auto Recompute Test A") and let the second innings complete **naturally via a scored
ball** (`recordBall()`'s own completion branch, chasing a 1-run target) — without ever clicking
"Update stats", the Stats page immediately reflected 131 runs and J Bumrah at 3 innings/11 runs.
Created a second throwaway match ("Auto Recompute Test B") and completed it by tapping "End innings"
on the **second** innings directly (`endInnings()`'s completion branch, a declared/tied finish) —
again without touching "Update stats", the Teams leaderboard picked up both new teams at "P: 2"
each. Both throwaway matches were then trashed via the Matches page; since deleting a match doesn't
itself trigger a recompute, ran the existing manual "Recompute leaderboards & standings" action
(Platform Tools) once afterward to restore the public leaderboard to its clean 130-run baseline —
confirmed by re-checking the Stats page. This cleanup step is specific to this slice's own test
methodology (intentionally polluting then un-polluting the shared cache), not a new gap in the
underlying feature.

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

### Slice 4.1 — Fewer taps for common scoring actions (P3) 🚫 Deferred — no code change
- Deliberately least-specified — no concrete slow sequence identified in either audit pass.
  **Affected files**: `ScoringPage.tsx` (`ScorePad`). **Risk**: low but speculative — don't build
  ahead of real scorer feedback. **Dependencies**: none. **Rollback**: trivial. **Restrictions**:
  ✅ compliant (UI-only). **Acceptance criteria**: deferred until a concrete case is named.

**Re-evaluated this pass, closed without a code change.** Re-read `ScorePad`'s current run/extras
flow specifically looking for a "too many taps" pattern to fix: a plain run is already one tap
(`onRun(r)`); a plain extra is already two taps (select the extra type, then tap `0` for "just the
extra" — the UI's own helper text confirms this is the intended fast path, not an oversight); a
run-plus-extra (e.g. a wide with 2 run) is two taps, which is the minimum possible given both pieces
of information are independent inputs. No dead-end or redundant-confirmation sequence was found
anywhere in the pad. Building a "faster taps" feature without a concrete slow sequence to fix would
mean inventing the requirement rather than discovering it — exactly the kind of speculative,
un-asked-for scope this codebase's own conventions (and this roadmap's own stated `4.1` reasoning
from the start) say to avoid. **Formally closed as intentionally deferred, not abandoned** — if a
real scorer reports a specific slow sequence, that becomes a new, concretely-scoped slice reusing
this file's existing risk/rollback shape, not a reopening of this one.

### Slice 4.2a — Mobile scorer experience audit (read-only) ✅ Done (P1)
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

**Done — audited live at a real 375×812 viewport against a real throwaway match, not a static
read of the JSX.** Walked the full lifecycle: `PreMatch` → `OpenersPanel` → live scoring (scored
real balls, including triggering the shot-detail prompt and a full over to reach the bowler-change
prompt) → `WicketModal` in both its default and most complex state (`run_out`, which adds a
fielder select + a runs-completed row) → the bowler-selection `PlayerPickModal` →
`ShortcutsHelpModal`. Measured via `document.body.scrollWidth` vs `window.innerWidth` (page-level
overflow) and `getBoundingClientRect()` (per-element tap-target sizing), the same technique
`ROADMAP_V3` Slice 1.2 used when screenshot tooling proved unreliable.

**Result: the responsive foundation holds up here too, with one genuine finding.**
- **Zero page-level horizontal overflow** anywhere in the flow — `PreMatch`, `OpenersPanel`, the
  live `ScoreHeader`/batter-bowler card, the "This over" ball-token strip (checked both near-empty
  and populated with 4 tokens including a boundary and a six — its `overflow-x: auto` correctly
  scopes scrolling to itself without ever pushing the page wider, matching the already-proven
  tournament-tab-bar pattern from `ROADMAP_V3` Slice 1.2), `WicketModal` (including its `run_out`
  state — the widest configuration, with a fielder select and a 4-button runs-completed row, and
  its "Confirm wicket" button stayed visible without needing to scroll), the bowler-selection
  `PlayerPickModal`, and `ShortcutsHelpModal`.
- **Tap targets are comfortably sized almost everywhere**: `ScorePad`'s run buttons are 96×64,
  extras (Wide/No ball/Bye/Leg bye) 71×44, Wicket/Undo 151×48, the footer's End innings/Abandon
  match/Scorecard controls 87–124×54, and `PlayerPickModal`'s option rows 335×54 — all at or above
  the 44px accessible touch-target guideline. `OpenersPanel`'s three `<select>`s and its "Start
  scoring" button measured 37–40px tall — a shade under the ideal but consistent with this app's
  existing `Button`/native-`<select>` baseline elsewhere, not a new regression introduced by this
  screen; noted as a minor polish candidate, not a blocking finding.
- **The one genuine, concrete finding**: the "Keyboard shortcuts" trigger button measured **84×24**
  — well under the 44px guideline, and unlike every other undersized element above, this one has a
  second, independent problem layered on top: its entire purpose (a list of keyboard shortcuts) is
  **functionally meaningless on a touch-only device with no physical keyboard**. A scorer on a
  phone who taps it (already a precision challenge at 24px tall) is shown a list of key combos
  they can never use, in place of anything actually relevant to how they're scoring. This is the
  one item this audit is naming as worth fixing — see Slice 4.2b below.

### Slice 4.2b — Mobile scorer fixes ✅ Done (P2 — scoped by 4.2a's findings)
**Problem**: 4.2a found exactly one genuine issue: the "Keyboard shortcuts" affordance
(`ScoringPage.tsx`'s `ScorePad`, `onShowShortcuts`/`Keyboard` button, and the `ShortcutsHelpModal`
it opens) is undersized (84×24, below the 44px guideline) and, more fundamentally, presents
keyboard-only information to a device class that can never use it.

- **Affected files**: `src/features/scoring/ScoringPage.tsx` only (`ScorePad`'s shortcuts button
  and the surrounding conditional that renders it).
- **Architecture**: Detect touch-primary devices with a `matchMedia('(pointer: coarse)')` check
  (standard, no new dependency — already the conventional way to distinguish "primarily touch"
  from "primarily mouse/trackpad" without relying on brittle user-agent sniffing) and hide the
  "Shortcuts" button entirely on that class of device, rather than just enlarging its tap target —
  enlarging it would still leave a touch-only scorer tapping into a modal full of information that
  can never apply to them. `ScoringShortcuts`'s `keydown` listener itself stays completely
  unchanged — a device with an attached physical keyboard (e.g. an iPad with a keyboard case)
  should keep working exactly as today; this only hides the *discovery* affordance for devices
  that can't use what it leads to.
- **Risks**: Low. `matchMedia('(pointer: coarse)')` is well-supported and this is a purely additive
  conditional around an existing button — no change to the shortcuts logic itself, so a
  misdetection in either direction degrades to today's exact behavior (shortcuts button
  shown/hidden), never to a broken or crashing state.
- **Dependencies**: None — this is the only fix 4.2a's findings justify; everything else measured
  within acceptable range and isn't being touched.
- **Rollback**: Trivial — revert the file; no data or schema involvement.
- **Restrictions compliance**: ✅ Compliant — pure UI conditional, no engine or schema involvement.
- **Acceptance criteria**: On a touch-primary viewport (`pointer: coarse`), the "Shortcuts" button
  is not rendered at all; on a mouse/trackpad-primary viewport, it renders exactly as today, same
  84×24 size, same modal content, unaffected. The underlying keyboard shortcuts themselves
  (0/1/2/3/4/6, W, Q, N, B, L, U, E, Esc) keep working identically on both device classes if a
  physical keyboard happens to be attached — only the *button* is conditional, not the
  `keydown` handling. `tsc`/`npm run build` clean; live-verified at both a touch-emulated (375px
  mobile preset) and a standard desktop viewport.

**Implemented and verified exactly as planned, with one testing nuance worth recording.** Added a
one-time `useState(() => matchMedia('(pointer: coarse)').matches)` check (mirrors this codebase's
existing `matchMedia` usage in `prefsStore.ts` — a synchronous check, no live-updating listener,
since pointer type doesn't realistically change mid-match) and made `ScorePad`'s
`onShowShortcuts` prop `undefined` when `touchPrimary` is true — reusing the prop's existing
optionality (`ScorePad` already only renders the button `{onShowShortcuts && (...)}`), so no change
to `ScorePad` itself was needed at all. `tsc -p tsconfig.app.json --noEmit` and `npm run build`
both clean (same pre-existing, unrelated `ScoreHeader` lint warning).
**Testing nuance**: the Browser pane's "mobile" viewport preset (375×812) only changes *viewport
dimensions* — it does **not** emulate touch input, so `matchMedia('(pointer: coarse)').matches`
stayed `false` even at that width (confirmed directly, not assumed). Verified correctly instead by
overriding `window.matchMedia` to force `pointer: coarse` true, then re-entering `ScoringPage` via
client-side routing (`history.pushState` + a dispatched `popstate` event — this project's own
documented SPA-testing technique per `CLAUDE.md`, not a hard reload, which would have reset the
override) so the `useState` initializer re-ran with the override active. **Verified live against
the real database**: confirmed the button renders by default (`pointer: coarse` false, matching
4.2a's own audit); confirmed it's absent once `pointer: coarse` is forced true; and — the part that
actually proves the "don't touch the keydown handling" requirement — dispatched a real `keydown`
event for `'1'` while the button was hidden and confirmed the score updated (0/0 → 1/0) exactly as
it would with the button visible, proving `ScoringShortcuts`'s listener is completely unaffected by
the button's visibility. Test match cleaned up after verification.

### Slice 4.3 — Remembered scorer preferences (P3) 🚫 Deferred — no code change
- No concrete pain point identified in either audit pass — deliberately undesigned pending real
  friction reports, same reasoning as 4.1. **Affected files**: `MatchSetupPage.tsx` + a new
  localStorage-backed store (mirrors `favStore`/`bgStore`'s existing pattern). **Risk**: low
  technically; real risk is building unused scaffolding for a need that never materializes.
  **Restrictions**: ✅ compliant in principle. **Acceptance criteria**: deferred.

**Re-evaluated this pass, closed without a code change.** The blocker isn't technical — a
localStorage-backed store following `favStore`/`bgStore`'s existing shape would be straightforward —
it's that "remembered preferences" has no defined scope without a real friction report to answer the
actual design questions: which fields get remembered (last team pairing? last venue? last overs
config? all of it?), per-scorer or per-device, and does a remembered value silently pre-fill or
require confirmation. Picking arbitrary answers to those questions now would mean designing for a
hypothetical need rather than an observed one — the exact risk this slice's own write-up already
called out ("real risk is building unused scaffolding for a need that never materializes"), and this
codebase's stated convention against building ahead of real requirements. **Formally closed as
intentionally deferred, not abandoned** — a real friction report converts this into a concretely-
scoped slice reusing the `favStore`/`bgStore` pattern already noted here.

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
- **`ROADMAP_V3` is complete, merged, and verified.** ROADMAP_V4 implementation is underway,
  proceeding one verified slice at a time in priority order, without pausing for per-slice approval.
- Priority order within the no-overlap set: 2.1a ✅ → 2.2 ✅ → 2.3 ✅ → 3.1 ✅ → 4.2a ✅ → 4.2b ✅ →
  1.4 ✅ → 2.4 ✅ → 4.1 🚫 (deferred) → 4.3 🚫 (deferred) → 1.1 ✅ → 1.3 ✅ → 1.2 ✅ → **3.2 (next)**.
- **3.3** needs a fresh read of the merged `MatchPage.tsx` before being scoped further and should not
  start until its post-merge scope is re-confirmed, given its blast radius (the single
  largest-blast-radius file in this roadmap) — planned last for that reason.
- Every slice ends with `tsc` + `npm run build` green and a live smoke test where auth allows it.
- Eleven of fifteen slices are done (2.1a, 2.2, 2.3, 3.1, 4.2a, 4.2b, 1.4, 2.4, 1.1, 1.3, 1.2); two
  (4.1, 4.3) are formally closed as intentionally deferred, no code shipped; the remaining two (3.2,
  3.3) are tracked above with full architecture/risk/rollback write-ups ready to implement.
