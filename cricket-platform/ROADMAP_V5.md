# CricketHub — Roadmap V5 (Scoring Engine)

**Ownership**: this roadmap is owned by the scoring-engine session. In scope: Last Man Standing,
Super Over, DRS/Reviews, Delivery metadata, Compatibility/migration work, Scoring security,
Match-rule validation, Scorecard changes, Mobile scoring. **Out of scope, not to be touched by this
roadmap**: account pages, Tournament Admin, donation, subscription work — those are other sessions'
areas. Other sessions may be editing non-scoring files concurrently; every slice below checks
`git status --short` (both `cricket-platform/` and the repo root) immediately before staging, and
is scoped to avoid files those other areas would touch (`AccountPage.tsx`, tournament-admin pages,
billing/subscription code, etc. are never in an affected-files list here).

**This file is planning only — nothing below has been implemented.** It's the result of a direct
code audit (not assumption) of the current scoring engine, security rules, and adjacent UI, done
before writing any code, mirroring how `ROADMAP_V4.md` was run in this same project. Every slice
carries an explicit **Restrictions compliance** line.

Legend: ⬜ planned · ✅ done and verified · 🚫 out of scope (reasoning inline).

---

## ⚠️ Standing restriction, and why most of this roadmap doesn't need to touch it

Per `CLAUDE.md`: **`src/domain/scoring.ts` is treated as verified and reliable — do not modify it.
New features READ from it.** This restriction is unchanged by the V5 ownership assignment; "owning
the critical scoring files" is read here as owning the *surrounding* service/UI/security layer that
depends on the engine, not licence to edit the engine itself. Nothing in this roadmap modifies
`scoring.ts` unless a slice below says so explicitly, and no such slice will be implemented without
first surfacing the exact proposed change and getting explicit confirmation — the same bar this
project has applied to every prior engine-adjacent decision (e.g. `ROADMAP_V4`'s Slice 2.1a, which
was re-planned specifically to avoid an engine change once one was found necessary).

Two of the nine owned phases have a sub-feature that **would** require an engine change if built in
full generality:
- **Last Man Standing** — true solo-batter scoring (continuing with no non-striker) needs
  `applyBall`'s hard `if (!strikerId || !nonStrikerId || !bowlerId) throw` (line 177–178) to accept
  a null non-striker, plus new `swapStrike()` semantics for one batter. **Not proposed below.**
  `ROADMAP_V4` already closed the scorer-facing symptom (Slice 2.1a: detect the stranded state,
  guide into `endInnings()`) without this; V5 does not reopen it without your explicit sign-off.
- **DRS / Reviews**, if built as literal ball-outcome reversal, could touch the engine. The slice
  proposed below (3.1) deliberately avoids this — it reuses `rebuildInnings()`, an existing public
  engine *export* built exactly for replay-from-corrected-history (`undoLastBall()` already uses it
  this way), so no line inside `scoring.ts` changes. This is the same "read from, don't modify"
  pattern every V4 slice used.

**Super Over** (Phase 2) turns out *not* to need engine changes at all — see 2.1 below: the engine
already supports arbitrarily short innings (`oversPerInnings: 1`), so a Super Over is just another
`Match` document scored through the unmodified engine, linked to its parent.

---

## Priority overview

| Priority | Slice | Files touched | Kind |
|---|---|---|---|
| **P0** | 🚧 6.1 — Scorer delegation is silently non-functional (code written, deploy pending) | `firestore.rules`, `matches.service.ts`, `MatchesPage.tsx` | Security/correctness bug |
| P1 | ✅ 7.1 — Wicket modal allows illegal dismissal types on Wide/No-ball | `ScoringModals.tsx`, `ScoringPage.tsx` | Correctness bug |
| P1 | ✅ 2.1 — Super Over scoring (linked match, reuses engine unmodified) | `matches.service.ts`, `ScoringPage.tsx`, `scoring.service.ts`, `MatchPage.tsx`, `types/index.ts` | Feature |
| P2 | 3.1 — Wicket-decision correction ("review") via `rebuildInnings()` | `scoring.service.ts`, `ScoringModals.tsx`, `ScoringPage.tsx` | Feature |
| P2 | ✅ 4.1 — Extend delivery metadata (ballMeta) with a review/DRS tag and free-text note | `ballMeta.service.ts`, `types/index.ts` (BallMeta only) | Feature |
| P2 | 8.1 — "Did not bat" list on the scorecard | `ScorecardView.tsx` | Feature |
| P2 | 6.2 — `ballMeta` write rule has no owner scoping (hygiene, not exploitable today) | `firestore.rules` | Security hygiene |
| P3 | 5.1 — Optional-field fallback audit across Match/Delivery/InningsState | none (audit only) / `Platform Tools` maintenance script | Audit + maybe tooling |
| P3 | 9.1 | — | 🚫 Deferred — see below |
| P3 | 1.1 | — | 🚫 Deferred — see below |

### 9. Mobile scoring — 🚫 largely already covered, not reopened speculatively
`ROADMAP_V4` Slices 4.2a (live 375px audit of `ScoringPage`/`ScoringModals`) and 4.2b (fix shipped)
already covered this ground thoroughly, finding the responsive foundation solid with one issue
(fixed). Re-auditing the same screens now with no new mobile-specific complaint would be repeating
V4's work for no reason. **Not reopened as its own slice.** Where V5 adds new UI (Super Over start
flow, review/DRS controls, delivery-metadata tags), each of those slices' own acceptance criteria
includes a mobile-viewport check — that's how mobile scoring stays covered going forward, rather
than as a separate audit pass.

### 1. Last Man Standing — 🚫 not reopened without explicit sign-off
Covered above. `ROADMAP_V4` Slice 2.1a already shipped the non-engine fix. The only remaining work
(true solo batting) requires an engine change this file won't make without your explicit request.

---

## P0 — Scoring security

### Slice 6.1 — Scorer delegation is silently non-functional 🚧 Code written, not yet deployed/verified
**Problem, confirmed by direct code read, not assumption**: `MatchSetupPage.tsx`'s "Assign scorer"
field lets an admin set a match's `scorerId` to a *different* user than the match's `ownerId`
(`ownerId` is always the creating admin — see `payload.ownerId = profile.id` in
`MatchSetupPage.tsx`, vs. `scorerId: form.scorerId || profile.id`, independently selectable). But:
- `firestore.rules`'s `/matches/{id}` rule is `allow update, delete: if isOwnerOrMaster(resource.data.ownerId)`
  — it checks **only `ownerId`**. `scorerId` is never referenced anywhere in `firestore.rules`.
- `ownerScope()` (`authStore.ts`) returns the current user's own uid for **every non-master role,
  including SCORER** — and `MatchesPage.tsx` filters its list with `list.filter((m) => m.ownerId ===
  scope)`. So a SCORER-role user assigned via `scorerId` to a match they don't own won't even see
  it in their own Matches list.
- Even if that user navigated directly to `/scoring/:id` by URL, every scoring write —
  `startMatch`, `recordBall`, `undoLastBall`, `endInnings`, `abandonMatch`, `setPlayerOfTheMatch` —
  goes through `updateDoc`/`writeBatch` on the match doc, gated by the same owner-only rule. It
  would fail with a permission error.
- `scorerId` is used for exactly one other thing today: `notifyMatchDone` includes it in the
  notification recipient set (`scoring.service.ts` line 45) — so the assigned scorer *is* notified
  when "their" match completes, despite never having been able to actually score it. That mismatch
  is itself a small, confusing side effect of the same root gap.

Net effect: **"Assign scorer" to anyone other than yourself (or the master admin) currently produces
a match that user cannot see or score at all.** This isn't a hypothetical — it's the literal,
traceable behavior of the checked-in rules and list-filtering code, confirmed by reading both
independently rather than inferring one from the other. It also wouldn't reliably surface in ad hoc
manual testing against a dev Firestore project running in open/test mode (per `CLAUDE.md`'s own
note that the live dev DB may not enforce these rules) — which is likely why it hasn't been caught
yet.

- **Affected files**: `firestore.rules` (the actual fix), `src/services/matches.service.ts` (if a
  server-side helper is useful), `src/features/matches/MatchesPage.tsx` (list filtering needs to
  also include matches where `scorerId === scope`, not just `ownerId === scope`).
- **Architecture**: Two independent things need to change together, or the fix is incomplete:
  1. **List visibility**: `MatchesPage.tsx`'s `filtered` should show a match if
     `m.ownerId === scope || m.scorerId === scope` (not `ownerId` alone) when `scope` is set.
  2. **Write authorization**: `firestore.rules`'s `/matches/{id}` update rule needs an `isOwnerOrMaster(...)
     || (isSignedIn() && resource.data.scorerId == request.auth.uid && request.auth-role is a scoring
     role)` branch — deliberately **not** widening this to "any signed-in user with a matching uid
     field", since `scorerId` must still be paired with a scoring-capable role (`canScore()`), so a
     VIEWER accidentally listed as `scorerId` (there's no role check on the wizard's dropdown today
     either — worth tightening there too, see Risks) can't gain a write hole. The `deliveries`/
     `ballMeta` subcollection rules already use the broader `canScore()` (no owner check) and don't
     need to change for this specific fix, though see Slice 6.2 for a related, separate hygiene note.
  3. Decide (and this is worth a explicit product call, not an engineering default): should a
     *reassigned* scorer be allowed to delete the match too, or only score it? Recommend: score-only
     (`recordBall`/`startMatch`/etc. all go through the same generic match-doc `update`, so
     Firestore rules can't structurally separate "can score" from "can delete" without inspecting
     *which fields changed* — `request.resource.data.diff(resource.data).affectedKeys()` — which
     is more rule complexity than this fix strictly needs; simplest safe default is delete staying
     owner/master-only via a slightly more surgical rule, detailed at implementation time).
- **Risks**: This is a security-rules change to a production Firestore project — the single
  highest-blast-radius kind of edit in this entire roadmap, worse than any UI bug. Must be tested
  against the **real** rules (not the possibly-open dev-mode database) before being called done —
  i.e. verify by simulating both the "should be allowed" and "should still be denied" cases, not
  just the happy path. The wizard's "Assign scorer" dropdown currently has no role filter at all
  (`users.filter(u => u.role === 'SCORER' || u.role === 'ADMIN')` — actually checked, this exists at
  `MatchesPage`-adjacent code; needs re-confirming exactly at implementation time) — if it doesn't
  already restrict to scoring-capable roles, tighten that too, since a rules fix that trusts
  `scorerId` for write access needs the field itself to only ever contain a scoring-capable uid.
- **Dependencies**: None on other V5 slices.
- **Rollback**: Revert `firestore.rules` and re-deploy (`firebase deploy --only firestore:rules`);
  revert the `MatchesPage.tsx` filter change. No data migration involved — this only changes who is
  *authorized*, not any stored shape.
- **Restrictions compliance**: ✅ Compliant — `scoring.ts` untouched; this is entirely security-rules
  and list-filtering.
- **Acceptance criteria**:
  - A match with `scorerId` set to user B (≠ ownerId, ≠ master) appears in B's Matches list.
  - B can open `/scoring/:id` and successfully record a ball, undo it, end an innings, and complete
    the match — verified against real (not open-mode) rules, or as close to that as the environment
    allows; flag explicitly if the dev project can't be tested with rules actually enforced.
  - A user who is neither `ownerId`, `scorerId`, nor master **cannot** write to the match (negative
    case — must be verified, not assumed, given this is the exact class of bug being fixed).
  - `firebase deploy --only firestore:rules` dry-run/lint passes (or equivalent local rules test) —
    `tsc`/`npm run build` clean for the TS-side changes.

**Implemented, code-reviewed field-by-field, but genuinely not live-verified — flagged explicitly
rather than claimed done.** Added `isDelegatedScorer()` to `firestore.rules`: `canScore() &&
isSignedIn() && resource.data.scorerId == request.auth.uid && request.resource.data.diff(resource.data)
.affectedKeys().hasOnly([...])`, where the allowed-fields list was built by grepping every real
`updateDoc`/`batch.update` call on the match doc across `scoring.service.ts` **and**
`ScoringPage.tsx`'s own direct `editToss()` call (`matches.service.ts`'s generic `updateMatch()`,
not routed through `scoring.service.ts`) — `status, innings, currentInnings, startedAt, completedAt,
result, playerOfTheMatchId, toss, battingFirstTeamId, updatedAt, linkedMatchId` (the last one added
after Slice 2.1 revealed `startSuperOver()` also needs to write it, caught and folded in before
either slice was committed). Checking `resource.data.scorerId` (the value already stored, evaluated
before the write) rather than `request.resource.data.scorerId` (the incoming value) is the key
safety property: a non-owner cannot grant themselves access by writing their own uid into
`scorerId` in the same request, since only the match's existing owner (who already has full write
access) can set that field to begin with. `delete` stays owner/master-only via a separate rule, not
widened. `MatchesPage.tsx`'s list filter now shows a match if `ownerId === scope || scorerId ===
scope`. Re-confirmed the wizard's "Assign scorer" dropdown already restricts candidates to
SCORER/ADMIN roles (`MatchSetupPage.tsx` line ~504), so `scorerId` can never point at a non-scoring
role — the rule doesn't need its own separate role check for that. Zero lines of `scoring.ts`
touched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean.
**What's genuinely not verified, and why**: this sandbox has no Firebase CLI (`firebase --version`
fails — not installed) and no Java (`java -version` fails — required for the Firestore rules
emulator), so neither of the two ways to test rule enforcement offline is available here, and the
rules file itself has zero effect until deployed (`firebase deploy --only firestore:rules`), which
this environment also cannot do. Regression risk for the *unchanged* owner/master path is low (that
branch of the `update` rule is untouched), but the actual fix — a non-owner, non-master, `scorerId`-
assigned user gaining write access, and everyone else still being denied — has not been exercised
against real Firestore. **This needs you to**: (1) run `firebase deploy --only firestore:rules`
yourself, and (2) ideally spot-check with a genuine second account assigned as `scorerId` on a match
they don't own, confirming they can score it and a third, unrelated account still cannot.

---

## P1 — Match-rule validation

### Slice 7.1 — Wicket modal allows illegal dismissal types on a Wide or No-ball ✅ Done
**Problem, confirmed by direct code read**: `WicketModal` (`ScoringModals.tsx`) always offers the
full wicket-type list (bowled/caught/lbw/run_out/stumped/hit_wicket/retired_out/retired_hurt/other,
minus retired_hurt if disabled) with **no awareness of the currently-active extra** — its props are
`strikerId, nonStrikerId, battingPlayers, fieldingPlayers, retiredHurtEnabled, onConfirm, onClose`;
`activeExtra` is never passed in from `ScoringPage.tsx`'s call site (confirmed by reading both the
component's prop signature and its one call site). By the actual laws of cricket, on a **wide** only
`run_out` and `stumped` are legal dismissals; on a **no-ball**, only `run_out` is legal (bowled/
caught/lbw/stumped/hit-wicket cannot happen on a no-ball). Today a scorer can select "Bowled" while
a Wide is active and the engine (which has no opinion on this — it just records whatever `WicketType`
it's given) will happily record a cricket-impossible dismissal.
- **Affected files**: `src/features/scoring/ScoringPage.tsx` (pass `activeExtra` into `WicketModal`),
  `src/features/scoring/ScoringModals.tsx` (`WicketModal` filters `wicketTypes` by the active extra).
- **Architecture**: Add `activeExtra: ExtraType | null` to `WicketModal`'s props. Filter the
  `wicketTypes` list: if `activeExtra === 'wide'`, keep only `run_out`/`stumped`/`other`/
  `retired_out`/`retired_hurt` (the non-delivery-outcome types stay allowed regardless of extra,
  since "retired hurt" etc. aren't about how the ball was bowled); if `activeExtra === 'no_ball'`,
  keep only `run_out`/`other`/`retired_out`/`retired_hurt`. No change to `scoring.ts` — the engine
  keeps accepting any `WicketType` it's handed; this is purely about not *offering* an illegal one
  in the picker. `isLegalForWicketCredit` in `scoring.ts` already independently handles bowler-credit
  correctly for whatever type does get submitted, so this is additive UI narrowing, not a
  correctness fix to the engine's own math.
- **Risks**: Low. Purely a client-side option-filtering change; if the filtering logic has an off-by-
  one bug, the worst case is temporarily hiding a legal option (annoying, not incorrect data) or
  showing one extra illegal option (same as today, no regression) — never a *new* way to enter bad
  data beyond today's status quo.
- **Dependencies**: None.
- **Rollback**: Trivial — revert both files.
- **Restrictions compliance**: ✅ Compliant — `scoring.ts` untouched.
- **Acceptance criteria**:
  - With Wide active, the Wicket modal offers only Run out / Stumped / Retired (hurt/out) / Other.
  - With No ball active, the Wicket modal offers only Run out / Retired (hurt/out) / Other.
  - With no extra active, all types remain available exactly as today (regression check).
  - `tsc`/`npm run build` clean; live-verified by triggering the Wicket modal with each extra active.

**Implemented and verified exactly as planned.** Added a `LEGAL_TYPES_BY_EXTRA` lookup
(`ScoringModals.tsx`) mapping `wide`/`no_ball` to their legal dismissal subsets, an `activeExtra`
prop on `WicketModal` (defaulting to `null`, so every other caller — there are none besides
`ScoringPage.tsx` — is unaffected), and a filter on `wicketTypes` combining it with the existing
`retiredHurtEnabled` filter. The default selected type also now starts at `run_out` (the first legal
option) instead of `bowled` when an extra restricts the choices, so the modal never opens with an
already-invalid selection. `ScoringPage.tsx`'s one call site passes `activeExtra={activeExtra}`
straight from its existing score-pad state — no new state introduced. Zero lines of `scoring.ts`
touched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against
the real database**: created a throwaway match, confirmed all 9 types show with no extra active
(baseline/regression check), activated Wide and confirmed the modal showed exactly Run out/Stumped/
Retired out/Retired hurt/Other, then switched to No ball and confirmed exactly Run out/Retired out/
Retired hurt/Other (Stumped correctly excluded here, unlike Wide). Test match cleaned up after
verification.

---

## P1 — Super Over

### Slice 2.1 — Super Over scoring, as a linked match through the unmodified engine ✅ Done
**Problem**: `superOverEnabled` is confirmed (by the field's own doc comment in `types/index.ts`) to
be "rule flag only... **No Super Over scoring is implemented**; this just drives a confirmation note
on a tied result." `ScoringPage.tsx`'s completed-tie screen already shows: *"Super Over enabled per
match rules — to be scored as a separate match"* — the intended design is already named in the UI
copy; it's just never been built.
- **Affected files**: `src/services/scoring.service.ts` or a new `src/services/superOver.service.ts`
  (a `startSuperOver(match)` that creates a new linked `Match` doc), `src/features/scoring/
  ScoringPage.tsx` (a "Start Super Over" button on the tied-result screen, replacing the current
  static note, gated on `match.result?.outcome === 'tie' && match.superOverEnabled`), `src/features/
  public/MatchPage.tsx` (show a link to the Super Over match once one exists, and vice versa).
- **Architecture**: A Super Over is structurally nothing new to the engine — it's a `Match` with
  `oversPerInnings: 1`, the two same teams, and (per most rule sets) a reduced batting squad
  (commonly 3 batters). Create it via the **existing, unmodified** `createMatch()` +
  `newInnings()`/`applyBall()` path — zero engine changes. New field needed: `Match.linkedMatchId?:
  string | null` (points from the Super Over match back to its parent, and — written on the
  parent — from the parent to the Super Over) so both pages can cross-link and so a tied Super Over
  can itself recurse (rare but real; most formats replay the Super Over on a further tie). Squad
  selection for the Super Over: reuse the parent's `squadA`/`squadB` as the candidate pool in a
  small picker (3 batters + a bowler quota per rule sets, though bowler-overs limits beyond 1 total
  aren't meaningfully enforceable at 1-over length, so this narrows mainly to a batting-XI picker).
- **Risks**: Medium — this is the largest genuinely new feature in this roadmap, touching several
  files across scoring + public pages, though the engine risk is zero (it reuses `applyBall`
  unmodified). Main risk is scope creep: a "full" Super Over feature (recursive tie-break chains,
  enforcing the reduced-batting-XI rule, an explicit combined-scorecard view spanning both matches)
  is bigger than a first slice should attempt. Recommend scoping the first slice to: create the
  linked match, let the scorer pick any subset of the squad (no hard 3-batter enforcement yet — matches
  this codebase's "advisory not blocking" convention from `ROADMAP_V4` Slice 1.3), score it through
  the normal `ScoringPage` flow unchanged, and link both match pages together. Recursive tie handling
  and a combined summary view become a natural follow-up slice once this lands and is used.
- **Dependencies**: None on other V5 slices.
- **Rollback**: Trivial for the mechanism (deleting a Super Over match is the same soft-delete every
  match already supports); the new `linkedMatchId` field is additive/optional, so older matches and
  a revert of this slice are both unaffected.
- **Restrictions compliance**: ✅ Compliant — `scoring.ts` untouched; every ball in a Super Over goes
  through the exact same, unmodified `applyBall`.
- **Acceptance criteria**:
  - A tied match with `superOverEnabled: true` shows a "Start Super Over" action (not just a note).
  - Starting it creates a new, real `Match` with `oversPerInnings: 1`, the same two teams, scored
    through the normal live-scoring screen with no engine errors.
  - Both the parent and the Super Over match pages link to each other.
  - `tsc`/`npm run build` clean; live-verified end-to-end with a real throwaway tied match, played
    into a genuine tie (feasible with a tiny squad/overs setup similar to `ROADMAP_V4`'s own test
    patterns), then scoring a full Super Over.

**Implemented and verified exactly as planned.** Added `linkedMatchId?: string | null` to `Match`
(`types/index.ts`) and `CreateMatchInput`/`createMatch()` (`matches.service.ts`). New
`startSuperOver(match, callerId)` in `scoring.service.ts`: derives the team that batted second in
the original match (per standard playing conditions, that team bats first in the Super Over),
creates a new `Match` via the existing, unmodified `createMatch()` (format `CUSTOM`, 1 over,
`maxWickets: min(parent, 2)`, same teams/squads/venue/tournament, a synthetic toss the scorer can
still edit via the Super Over's own `PreMatch` toss editor from `ROADMAP_V4` Slice 1.4), then writes
`linkedMatchId` back onto the parent. **Important correctness detail**: `ownerId`/`createdBy` on the
new match are set to `callerId` (whoever clicks "Start Super Over"), not inherited from the parent —
required because `firestore.rules`'s `create` rule checks `request.resource.data.ownerId ==
request.auth.uid`, which only holds for the actual caller, not necessarily the parent's original
owner (e.g. a delegated scorer per Slice 6.1 starting a Super Over on someone else's match would
otherwise fail to create their own new match). `ScoringPage.tsx`'s completed-tie screen replaced the
old static note with a real "Start Super Over" button (shown when tied + enabled + not already
linked) or a "View linked Super Over" button (once it exists) — a single conditional covers the
parent-before, parent-after, and child-match states without needing to detect direction separately.
`MatchPage.tsx` shows the same cross-link publicly. Zero lines of `scoring.ts` touched — every ball
in a Super Over goes through the exact same `applyBall`/`newInnings` as any other match. `tsc -p
tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
database, full cycle, not a shortcut**: created a throwaway 1-over-per-side match with Super Over
enabled, played out a genuine 0-0 tie (six dot balls each innings — not a shortcut like force-ending,
since `chased`/`allOut`/`oversDone` all needed to resolve correctly through real ball-by-ball
scoring to reach an actual tie via `computeResult`), confirmed "Match tied" showed a real "Start
Super Over" button, clicked it, and confirmed the resulting new match had every derived value
correct: `CUSTOM · 1 overs`, "Toss: MSW Test Team B chose to bat" (correctly the second-innings
batting team from the tied match), "Wickets: 2" (correctly `min(10, 2)`), "Powerplay: 0 overs",
squads inherited. Confirmed the parent match's own completed screen and its public `MatchPage.tsx`
both now show a working "View linked Super Over" link pointing at the correct new match id. All
three throwaway matches (the tied match, its Super Over, and an earlier unrelated test match)
soft-deleted after verification.

---

## P2 — DRS / Reviews (scoped, not full DRS)

### Slice 3.1 — Correct a wicket decision after the fact, via `rebuildInnings()`
**Problem**: No review/correction mechanism exists at all today. A full DRS system (review-count
limits per innings, an "under review" pending UI state, umpire's-call semantics) is Phase-5-shaped —
`ROADMAP_V4` already flagged real DRS as needing "a new mutation path into already-recorded
deliveries." **That mutation path already exists and doesn't require touching `scoring.ts`**:
`rebuildInnings()` is an exported, public function built exactly for "replay from a corrected
history" — `undoLastBall()` in `scoring.service.ts` already uses this exact pattern (delete the last
delivery, replay the rest). A wicket-decision correction is the same idea generalized to *any*
delivery, not just the last one.
- **Affected files**: `src/services/scoring.service.ts` (new `correctWicketDecision()` function),
  `src/features/scoring/ScoringPage.tsx` / a new small modal (pick a recent delivery with a wicket,
  choose "not out" or a different dismissal type).
- **Architecture**: `correctWicketDecision(match, deliveryId, newWicket: WicketEvent | null)`:
  1. Fetch all deliveries for the current innings.
  2. Patch the target delivery's `wicket` field in place (a plain Firestore field update — deliveries
     are just data, not engine state).
  3. Re-run `rebuildInnings()` over the corrected delivery list (unmodified engine call, same as
     `undoLastBall()` already does).
  4. Write the rebuilt `InningsState` back to the match doc, same shape `undoLastBall()` writes.
  - Scope this first slice to corrections **within the current innings, not yet completed** — the
    same boundary `undoLastBall()` already operates within — since correcting a *closed* innings or
    a *completed match* raises the same "should stats/standings that already recomputed be
    re-recomputed" question `ROADMAP_V4` Slice 2.4 explicitly called out for abandon/reopen. Treat
    "correct a decision in a completed match" as a deliberately separate, later slice (needs its own
    stats-recompute-interaction design), not bundled into this one.
- **Risks**: Medium. `rebuildInnings()` replays *every* subsequent delivery — if the corrected
  wicket removes/changes a dismissal, downstream batter-card/partnership/strike-rotation state for
  every ball after it needs to come out right, which is exactly what `rebuildInnings()` already
  guarantees (it's the same function `undoLastBall()` trusts for a similar, already-shipped
  correction). Main new risk is UI: picking *which* delivery to correct out of potentially dozens
  needs a clear, mistake-resistant picker (recommend scoping to "the last N deliveries with a
  wicket," not an arbitrary full-innings browse, to keep the blast radius of a mis-click small).
- **Dependencies**: None on other V5 slices, though naturally pairs with 4.1 (tagging a delivery as
  "under review" via `ballMeta` before a correction is confirmed).
- **Rollback**: Trivial — the function is new and additive; nothing else calls it. A wrongly-applied
  correction can itself be corrected the same way (or via the existing `undoLastBall()` if it's the
  most recent ball).
- **Restrictions compliance**: ✅ Compliant — confirmed by design that zero lines of `scoring.ts`
  change; this calls the existing, unmodified `rebuildInnings()` export exactly as `undoLastBall()`
  already does.
- **Acceptance criteria**:
  - Overturning a wicket (e.g. caught → not out) on ball N correctly restores the batter to the
    crease and correctly re-plays every ball after N (runs/strike rotation/partnership all match
    what a fresh, correct scoring of the same sequence would have produced).
  - Changing a dismissal *type* (e.g. bowled → lbw) without removing the dismissal leaves everything
    else unchanged.
  - Scoped to the live, current innings only — not offered once the innings has closed.
  - `tsc`/`npm run build` clean; live-verified with a real throwaway match: record a wicket, score a
    few more balls, correct the wicket to "not out", and confirm the resulting state matches what
    directly scoring the corrected sequence from scratch would produce.

---

## P2 — Delivery metadata

### Slice 4.1 — Extend `ballMeta` with a review/DRS tag and a free-text note ✅ Done
**Problem**: `ballMeta.service.ts` already exists as exactly the right extension point — "optional
and additive — never called from the scoring engine or its write path," currently carrying
`zone`/`line`/`length` for the wagon wheel / pitch map. Nothing currently lets a scorer attach an
arbitrary note to a delivery (e.g. "given out, review requested" ahead of Slice 3.1's correction, or
just "great yorker" commentary color) or flag it as reviewed.
- **Affected files**: `src/types/index.ts` (`BallMeta` interface only — add `note?: string`,
  `reviewed?: boolean`), `src/services/ballMeta.service.ts` (no logic change needed —
  `recordBallMeta`'s `Partial<Pick<BallMeta, ...>>` signature just needs the new keys added to the
  `Pick`), a small UI affordance in `ScoringPage.tsx`'s existing shot-detail flow or ball-by-ball
  commentary view.
- **Architecture**: Purely additive fields on an already-optional, already-non-engine-critical type.
  No migration needed — old `ballMeta` docs simply don't have these keys, exactly like every other
  optional field in this codebase (`Match.maxWickets`, `Match.teamSize`, etc.).
- **Risks**: Low — same shape and risk profile as the existing `zone`/`line`/`length` fields.
- **Dependencies**: Useful ahead of Slice 3.1 (flag a delivery before correcting it) but not
  required by it.
- **Rollback**: Trivial — revert the type addition; no reads assume the new fields exist.
- **Restrictions compliance**: ✅ Compliant — `scoring.ts` untouched; `ballMeta` is explicitly outside
  the scoring engine's own write path, as its own file comment already states.
- **Acceptance criteria**: A note/review flag can be attached to a delivery and persists/displays
  correctly; older deliveries with no `ballMeta` doc at all are unaffected. `tsc`/`npm run build`
  clean; live-verified against a real delivery.

**Implemented and verified, with the UI landing in `ShotDetailPrompt` rather than a new surface.**
Added `note?: string` and `reviewed?: boolean` to `BallMeta` and widened `recordBallMeta`'s
`Partial<Pick<...>>` to include them — no other logic change to `ballMeta.service.ts`. For the UI,
reused `ShotDetailPrompt` (already shown after every scored ball via the existing `pendingMeta`
state, including after a wicket) rather than building a new component or a separate ball-by-ball
affordance: added a "Flag for review" toggle (disabled once flagged, matching the one-way nature of
a review flag for a single delivery) and a note input + Save button, both calling the same
`saveShotMeta()` merge-write already used for zone/line/length — no new write path, no new failure
mode. `pendingMeta` gained a local `reviewed` boolean so the button's disabled/label state reflects
the current delivery's status without a re-fetch. Zero lines of `scoring.ts` touched. `tsc -p
tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
database with a direct document read, not just UI state**: created a throwaway match, scored a
boundary to trigger the prompt, typed a note and saved it, then flagged for review — confirmed the
button switched to "Flagged for review" and disabled itself. Rather than trusting the UI alone,
dynamically imported `ballMeta.service.ts` via Vite's dev-server module serving
(`await import('/src/services/ballMeta.service.ts')`) directly in the browser and called
`listBallMeta()` for the match, confirming the actual stored document: `{note: "Given out, review
requested", reviewed: true}` — proving the write reached Firestore correctly, not just that the
button re-rendered. Test match abandoned and deleted after verification.

---

## P2 — Scorecard changes

### Slice 8.1 — "Did not bat" list
**Problem, confirmed by reading `ScorecardView.tsx`**: the batting card only lists players who
actually appear in `InningsState.battingCard` (populated by `ensureBatter()` when they face a ball
or are run out etc.) — any squad member who never got to bat (very common: a low-overs chase won
before the tail is needed, or a side batting first declares/all-outs early) is completely invisible.
Standard cricket scorecards list these under "Did not bat."
- **Affected files**: `src/features/scorecard/ScorecardView.tsx` only.
- **Architecture**: For each innings, compute `squadFor(match, battingTeamId).filter(pid =>
  !battingCard.some(b => b.playerId === pid))` and render as a small "Did not bat: X, Y, Z" line
  under the batting table, gated by `cfg.showBatting` (same config flag the batting table itself
  uses) and only shown when the list is non-empty.
- **Risks**: Very low — pure additive rendering from data already fully available on the client
  (`match.squadA`/`squadB` and the innings' own `battingCard`), no new service call.
- **Dependencies**: None.
- **Rollback**: Trivial — revert the file.
- **Restrictions compliance**: ✅ Compliant.
- **Acceptance criteria**: A completed match where not every squad member batted shows a correct
  "Did not bat" list; a match where everyone batted (or an incomplete innings) shows nothing extra.
  `tsc`/`npm run build` clean; live-verified against a real match with a genuine unused-squad-member
  case (or one constructed via a small throwaway match).

---

## P2 — Scoring security (hygiene, not exploitable today)

### Slice 6.2 — `ballMeta` write rule has no owner scoping
**Problem**: `firestore.rules`'s `matches/{id}/ballMeta/{ballId}` allows write to **any**
`canScore()` user — no `isOwnerOrMaster` check, unlike the match doc itself. Unlike the
`deliveries` subcollection (which is *always* written inside the same atomic batch as a
match-doc update, so the match doc's own owner check is the real gate in practice),
`recordBallMeta()` is a **standalone** `setDoc`, not batched with anything — so this rule is the
*only* gate for that write, and it currently lets any scorer/admin tag shot-placement metadata on
any match they don't own.
- **Affected files**: `firestore.rules` only.
- **Architecture**: This is a genuine open question, not an obvious bug fix, which is why it's
  scoped separately from 6.1 rather than bundled in: is "any scorer can tag any match's shot data"
  an intentional, low-stakes permissiveness (it's optional visual metadata, not the scored result
  itself), or should it mirror the match's own owner-scoping? Recommend surfacing this as an explicit
  question before changing it, rather than defaulting either way — flagged here so it isn't lost,
  not resolved.
- **Risks**: Low either way — worst case today is unwanted shot-placement tags on someone else's
  match, not falsified scores/results.
- **Dependencies**: None.
- **Rollback**: Trivial rule revert.
- **Restrictions compliance**: ✅ Compliant.
- **Acceptance criteria**: TBD pending the product decision above.

---

## P3 — Compatibility / migration work

### Slice 5.1 — Optional-field fallback audit
**Problem**: This codebase has a strong, consistent convention (documented inline at each field:
`Match.maxWickets`, `teamSize`, `powerplayMode`, `powerplayOvers`, `retiredHurtEnabled`, etc. all use
`??`/`!== false` fallbacks for pre-existing docs) — plus a full export/import round-trip already
built (`matchExport.ts` + `matchImport.service.ts`) usable as a real backup/restore path. V5 will
keep adding optional fields (`linkedMatchId`, `BallMeta.note`/`reviewed`, possibly more) — worth a
deliberate audit pass confirming every read site has a correct fallback, rather than assuming.
- **Affected files**: none by default — this is a read-only audit. If gaps are found, they become
  their own small, targeted slices.
- **Architecture**: Grep every optional `Match`/`Delivery`/`InningsState`/`BallMeta` field for its
  read sites and confirm each one degrades sensibly for a doc predating that field, mirroring how
  `ROADMAP_V4`'s Slice 2.1a and others verified `effectiveSquadSize()`'s fallback math directly
  rather than assuming it. If a genuine backfill is ever wanted (rather than runtime fallback
  forever), the existing "Platform Tools → Maintenance" pattern (`Recompute leaderboards &
  standings`, `Export platform backup`) is the established place for a one-time script, using the
  Firestore REST API per `CLAUDE.md`'s guidance for Node-side Firestore scripts (the SDK's gRPC is
  blocked in this environment).
- **Risks**: None for the audit itself; any resulting fix slice is scoped and risk-assessed on its
  own.
- **Dependencies**: None.
- **Restrictions compliance**: ✅ Compliant — audit only.
- **Acceptance criteria**: A findings list (fields checked, fallback confirmed correct or a gap
  found), no code change unless a gap is found, in which case it becomes its own slice.

---

## Revision history
- **Pass 1 (this one)**: Initial audit of all nine owned phases against the real, current codebase —
  `scoring.ts` read in full, `firestore.rules` read in full, `ballMeta.service.ts`/
  `matchImport.service.ts`/`ScorecardView.tsx`/`ScoringModals.tsx` read for precedent and gaps.
  Found two genuine, evidence-backed bugs (6.1 scorer-delegation security gap; 7.1 illegal
  wicket-type selection on extras) rather than starting from speculative feature ideas. Confirmed
  Super Over needs zero engine changes (reuses the unmodified engine as a linked match) and a
  scoped DRS/review correction is achievable via the existing `rebuildInnings()` export, also
  without touching `scoring.ts`. Nothing implemented yet — awaiting confirmation before starting,
  particularly on: (a) priority/order across the slices above, (b) the 6.2 product question, (c)
  explicit confirmation that Last Man Standing's true-solo-batting sub-feature stays out of scope
  (as currently proposed) unless you say otherwise.
- **Pass 2 (this one)**: User confirmed the recommended order. **Slice 6.1's code was written**
  (`firestore.rules` + `MatchesPage.tsx`) and traced field-by-field against every real scoring write
  path, but hit two genuine environment blockers: no Firebase CLI here to deploy the rules, and no
  Java for the rules emulator to test enforcement offline — so this slice's actual security
  enforcement is **not yet live-verified**, only code-reviewed. Flagged clearly rather than claimed
  done; see Slice 6.1's own write-up for exactly what was and wasn't checked, and what deploying it
  requires from you. **Slices 7.1 and 2.1 implemented and fully verified live** against the real
  database — 7.1 with both extras individually confirmed to restrict the correct dismissal subset,
  2.1 with a genuine ball-by-ball tie (not a shortcut) followed by a full Super Over creation and
  cross-link check on both the scoring screen and the public match page. A concurrent session's own
  commit (`437337a`) swept `CHANGELOG.md`/`RESTRICTIONS.md`/`MatchPage.tsx` alongside its own
  Expected Score work while this slice's changes to those same files were still uncommitted —
  diffed the commit against what was intended and confirmed byte-for-byte identical, nothing lost.

### Notes
- **6.1's code is written but not deployed or live-verified** — needs you to run
  `firebase deploy --only firestore:rules` (no CLI available in this sandbox), and ideally a
  post-deploy spot-check with a genuine non-owner, non-master `scorerId`-assigned account.
- **7.1 and 2.1 are done and fully verified.**
- Recommended order for what's left: **4.1 (P2, small, pairs with 3.1) → 3.1 (P2, review
  corrections) → 8.1 (P2, scorecard) → 6.2 (P2, needs your product call) → 5.1 (P3, audit)** — say
  the word to reorder or drop anything.
- Every slice ends with `tsc` + `npm run build` green and a live smoke test against the real
  database, exactly like every `ROADMAP_V4` slice.
- `git status --short` (both `cricket-platform/` and the repo root) is checked immediately before
  staging every commit, to catch any concurrent-session collision before it happens — this already
  caught the `437337a` sweep above.
