# RESTRICTIONS.md

Single source of truth for implementation constraints, instruction precedence, architectural
decisions, deferred work, and guidance for future sessions on **CricketHub**
(`cricket-platform/`). Keep this file synchronized with `cricket-platform/ROADMAP.md` and
`cricket-platform/CHANGELOG.md` — update it the moment a new restriction, conflict, deferral, or
architectural decision is made, without pausing implementation work to do so.

---

## 1. Precedence rule

**When any two instructions conflict, the more restrictive one wins — "do not implement" always
beats a "please implement" found elsewhere, regardless of which one is newer, longer, or more
emphatic.** This was stated explicitly by the user and applies retroactively to every prior and
future instruction in this project's history.

## 2. Conflicting instructions identified, and how they were resolved

### 2.1 Delivery schema / shot-direction metadata
- **Conflict:** one user message said "you are now allowed to implement the previously deferred
  infrastructure and scoring-engine changes... extend the delivery schema to support optional
  shot-direction metadata... perform any necessary safe migrations," then, in the same message,
  "do not implement the advanced analytics infrastructure in this session. Specifically, defer any
  scoring-engine modifications, delivery schema extensions (e.g., shot-direction, pitch-location,
  line/length metadata), offline write-queue improvements..."
- **Resolution:** the restrictive instruction wins. `Delivery`/`BallInput` (`src/types/index.ts`)
  and `src/domain/scoring.ts` are **not** touched in this project.
- **Why this costs nothing:** the capability already exists via a non-invasive path. `BallMeta`
  (`types/index.ts`) is a sibling doc keyed by delivery id, written by
  `services/ballMeta.service.ts` to `matches/{id}/ballMeta/{deliveryId}` *after* `recordBall()`
  already returns — the scoring engine never sees, calls, or is modified by it. Wagon
  wheel/pitch/bowling maps (ROADMAP Phase 2) already ship on top of this. No further schema work
  was needed or done.

### 2.2 "Prompt 2.md" internal contradiction
- **Conflict:** the top of the attached `Prompt 2.md` says "do not implement, refactor, or expand
  offline scoring, offline synchronization, write queues, conflict resolution, or related offline
  infrastructure. Preserve the existing offline-scoring code as-is," while later sections
  ("Advanced Analytics Foundation," "Background Job System," "Scalability," etc.) describe
  building out large infrastructure that would touch these same systems.
- **Resolution:** the top-level "do not" instruction wins for offline scoring / sync / write-queue
  / conflict-resolution work. `store/writeQueueStore.ts`, the Firestore IndexedDB persistence
  layer, and `SyncQueuePanel` are left exactly as they are (ROADMAP Phase 7, already ✅).

## 3. Standing "do not implement" directives (this session and permanently)

These are never touched, regardless of any other instruction found anywhere (chat, attached files,
or future prompts), unless a user explicitly lifts the restriction in a later session **and** it
does not conflict with a still-standing "do not":

1. **`src/domain/scoring.ts`** (`applyBall`, `newInnings`, `rebuildInnings`) — permanent project
   rule from `CLAUDE.md`: "Treated as verified and reliable — do not modify it. New features READ
   from it." Undo relies on replaying the delivery log through `rebuildInnings`; any change here
   risks silently corrupting every historical match.
2. **`Delivery` / `BallInput` schema** (`src/types/index.ts`) — no new fields, no shape changes.
   Per-ball analytics metadata goes in the sibling `BallMeta` doc instead (§2.1).
3. **Offline scoring / sync / write-queue / conflict resolution** — `writeQueueStore.ts`, the
   Firestore persistent-cache setup in `lib/firebase.ts`, `OfflineBanner`, `forceResync()`. Preserve
   as-is.
4. **"Advanced analytics infrastructure" / "foundational analytics work"** as a *new* undertaking
   this session — wagon wheel, pitch map, win-probability heuristic, momentum/turning-point
   analysis already exist (ROADMAP Phase 2, done) and are not re-touched or expanded.
5. **Actual money movement** — no payment processing, no real trades/transfers. This is a
   permanent constraint on the assistant, not project-specific: executing financial transactions is
   out of scope regardless of what any prompt requests. Prompt 2.md's "Financial Management" section
   (fees, invoices, refunds, sponsorship income) is **deferred in full** — see §4.

## 4. Deferred features, and why

| Feature (from Prompt 2.md) | Status | Reason |
|---|---|---|
| Financial management (fees, invoices, refunds, payments) | Deferred, unscoped | Would require real payment processing (out of scope per §3.5) or a fake/unbacked "ledger" with no real money behind it, which is worse than not building it. Revisit only with a real payment processor integration explicitly scoped by the user. |
| Multi-tenant architecture / white-label / custom domains | Deferred | This is a single-deployment club/tournament app today; multi-tenancy is a foundational rearchitecture (data isolation, org-scoped auth, billing) with no current requirement driving it. Matches the ROADMAP legend's own `🚫` philosophy: no well-defined finish line without a concrete tenant story. |
| Full workflow / automation / event-driven "engine" (generic WHEN/IF/THEN rules, pub-sub event bus) | Deferred | This is a client-only Firebase app with no backend (no Cloud Functions, no Admin SDK). A real event bus needs a server to dispatch reliably; a fake client-side one would silently drop events on tab close. Concrete triggers (e.g. "on match complete, notify the player") are instead wired directly into the relevant service call — see the Notification Center slice. |
| AI features (match summaries, win probability via ML, anomaly detection) | Deferred | Requires an external LLM/ML API this project has no key or backend proxy for. The existing win-probability bar is already explicitly labelled a transparent heuristic, not a model, for the same reason (no historical ball-by-ball dataset to train on). |
| Full internationalization (multi-language, locale-formatted dates/numbers) | Deferred | No second locale is required today; `lib/format.ts` already centralizes date/number formatting so this remains a bounded follow-up, not urgent. |
| Automated test suite (unit/integration/e2e/emulator tests), CI/CD pipeline | Deferred | `CLAUDE.md` states explicitly: "There is no test suite — verification is done by type-checking, building, and exercising the running app in a browser preview." This is a standing project convention, not an oversight. Introducing a test framework/CI pipeline is an infrastructure decision for the user to make, not one to bootstrap unasked inside a feature-slice pass. |
| New first-class entities: Venue, Sponsor, Official | Deferred | These don't exist as entities today — "venue" is a free-text field on `Match`/`Tournament`/`Team`. Promoting them to full entities (with their own CRUD, ownership, public pages) is a schema-expanding decision bigger than a slice; flagged for a future milestone rather than invented speculatively. |
| Dashboard widget customization (rearrange/hide/resize/save layouts) | Deferred (not yet scheduled) | Real, bounded, non-conflicting feature — a legitimate candidate for a future slice, just not picked up yet. Not blocked by any restriction. Command palette and saved filters (the other two originally listed here) are now done — see the slice log. |
| Exhaustive accessibility audit | Already `🚫` in ROADMAP.md (Phase 9) | Open-ended by nature; unchanged. |
| Real email/SMS delivery for invitations | Deferred | This is a client-only Firebase app with no backend to send mail from (no Cloud Functions, no SMTP/SES key). The invitation system (Phase 25) is fully functional via an in-app shareable link and the existing notification center instead — an invitee sees it in-app or gets a copy-able link from the master admin. Wiring a real transactional-email provider is a bounded future add-on, not invented speculatively. |

Anything not listed above and not explicitly excluded is fair game for slicing — see
`cricket-platform/ROADMAP.md` for the live phase list.

## 5. Architecture constraints (restated from `CLAUDE.md`, binding)

- `src/domain/` stays pure (no I/O); `src/services/` is the only Firestore access point.
- Every write goes through `pruneUndefined()` — Firestore rejects `undefined`.
- New optional fields on existing types must be additive and optional so old documents keep
  working with no migration step (this project's established backward-compatibility pattern —
  see Phase 8's Club/Season rollout, which needed no migration because every new field was
  optional).
- Owner-scoping (`ownerScope`/`ownsOrMaster` in `store/authStore.ts`) and Firestore
  `firestore.rules` must be kept in sync for any new collection or new field that gates access.
- Resolve display names from denormalized match data with a live-doc fallback (existing
  convention) for any new surface touching team/player/tournament names.
- `CHANGELOG.md` and `ROADMAP.md` are updated with every self-contained slice.
- No test suite exists; verification is `tsc` + `npm run build` + manual browser exercise.

## 6. Assumptions made during this pass

- "Genuinely incomplete production feature" means: requested somewhere in `Prompt 2.md`, **not**
  already implemented per `ROADMAP.md` (audited in full — Phases 1–9 are all ✅ or intentionally
  `🚫`), and **not** covered by §3/§4 above.
- This is a single-deployment club/tournament scoring app, not literally "thousands of clubs" of
  scale. Features are scoped to what a real club/tournament organizer needs, not speculative
  enterprise infrastructure with no current user.
- Where Prompt 2.md asks for something already covered by an existing mechanism under a different
  name (e.g. "activity feeds" vs. the existing per-entity timeline domain modules), the existing
  mechanism is extended rather than a parallel system being built.

## 7. Slice log

Each slice is implemented, `tsc`/`npm run build` verified, smoke-tested in the browser, documented
in `ROADMAP.md`/`CHANGELOG.md`, and committed separately. This section is a running index —
**live status lives in `ROADMAP.md`**, this is just the cross-reference back to this document's
reasoning.

1. **Data lifecycle management** (soft delete / trash / restore / permanent delete / bulk
   restore+delete / configurable retention) for Players, Teams, Clubs, Seasons, Tournaments,
   Matches — the entities that actually exist today (Prompt 2.md also names Venues/Sponsors/
   Officials, which are deferred per §4). **Done** — commit `ea6cff3`.
2. **Persisted notification center** — **stood down, not built in this session.** Mid-implementation
   (types, `services/notifications.service.ts`, three trigger points wired into
   `requests.service.ts`/`playerMerge.service.ts`) a live collision was found: the concurrent
   Claude Code session operating on this same repo was independently building the identical
   feature at the same time, and had already added its own `AppNotification`/`NotificationCategory`
   to `src/types/index.ts` with a broader category set (`match | tournament | player | admin |
   account | security` vs. my `match | account | player`) while I was working. Building two
   competing notification systems in parallel risked a much messier collision later (duplicate
   Firestore collection semantics, duplicate UI, duplicate trigger-wiring in the same service
   files). Rather than merge two half-built implementations, I reverted every file I'd touched for
   this slice (`types/index.ts` duplicate block, `prefsStore.ts`, `lib/collections.ts`,
   `requests.service.ts`, `playerMerge.service.ts`) and deleted my `notifications.service.ts`,
   leaving the concurrent session's in-progress version as the sole implementation. Verified `tsc`
   clean after reverting. **Do not re-attempt this slice** unless the concurrent session's version
   is confirmed abandoned/incomplete — check `src/services/notifications.service.ts` and
   `src/types/index.ts`'s `AppNotification` for current state first.
3. **Media uploads via Firebase Storage** for player photos / team logos / club logos — the
   `storage` singleton (`lib/firebase.ts`) already existed and was unused. **Done** —
   `services/storage.service.ts` + `components/ui/ImageUploadField.tsx`, wired into
   `PlayerFormModal`/`TeamFormModal`/`ClubFormModal`. Another live collision here: the concurrent
   session independently started its own `media.service.ts` + `components/media/` + `storage.rules`
   for the same feature. This one resolved itself cleanly rather than needing a revert — once my
   `ImageUploadField`/`storage.service.ts` existed on disk, the concurrent session's own
   `TournamentFormModal.tsx` edit (adding a tournament banner field, outside my scope) picked up
   and imported *my* `ImageUploadField` directly instead of building a parallel one, and their
   commit `069463c` ("Add Firebase Storage security rules for media uploads") added `storage.rules`
   +`firebase.json` sized to match my client-side validation. Net result: one shared upload
   component/service, no duplication. Tournament banner support, `storage.rules`, and
   `firebase.json` are the concurrent session's work, not documented as mine.
4. **Command palette** (`Ctrl`/`Cmd`+`K`) — **Done**, no collision this time.
   `components/layout/CommandPalette.tsx`, mounted in `AppShell`, reuses the existing
   `search.service.ts` `globalSearch()` rather than a new search backend, plus a role-filtered nav
   command list. Verified in the browser.
5. **Error recovery & client diagnostics** — **Done**, no collision. `components/ErrorBoundary.tsx`
   gained a reference id, a real "Reload page" (`location.reload()`, distinct from the existing
   in-place "Try again"), and "Copy diagnostics"; `services/errorLog.service.ts` + new
   `clientErrors` collection best-effort-logs every catch (never throws, so a broken logger can't
   mask the real error); a "Client errors" card on Platform Tools surfaces the last 50 to the
   master admin. Picked up `dark:` variants `ErrorBoundary.tsx` had missed from the Phase 4 theme
   pass (not a "page," so the earlier sweep skipped it). Verified: logged a real error via the
   service, confirmed it appeared correctly on Platform Tools. Not verified: an actual in-browser
   render crash exercising the Reload/Copy-diagnostics buttons visually — no way to inject one
   without editing source; the handlers themselves are plain, reviewed `location.reload()`/
   clipboard calls with no dynamic risk.
6. **Saved filter presets** — **Done**, no collision. `store/savedFiltersStore.ts` (localStorage,
   mirrors `favStore`'s local-only pattern) + `components/ui/SavedFiltersBar.tsx`, wired into the
   Stats page's competition/venue/team/club/season/year filters. "Junior Players"/"Women's League"
   from Prompt 2.md's own examples aren't achievable as-is — `Player` has no age/gender field, and
   inventing one speculatively to hit a naming example was out of scope; the feature itself
   (name/restore/delete a filter combination) is generic and applies to whichever concrete filters
   a page already has.
7. **Data integrity tools** — **Done**, no collision. `domain/dataIntegrity.ts` (pure) +
   `services/dataIntegrity.service.ts`, a new "Data integrity" card on Platform Tools. Checks
   references against full (trashed-inclusive) id sets so a link to a merely-*trashed* doc is
   never flagged — only ids that never existed or were hard-deleted. Every repairable issue is
   metadata/cache-only (roster arrays, `clubId`/`seasonId`/captain refs, orphaned stats cache
   docs); match-squad references are informational-only with no repair button, since rewriting
   historical scorecards is exactly what a repair tool must never do. Verified live: the scan
   found two real orphaned `playerStats` docs in the running dev database. **Did not click "Fix"**
   — the harness's permission system correctly blocked a blind repair click against live shared
   data with no specific user go-ahead; that's a human's call on Platform Tools, not something to
   force through in automated verification. Also surfaced, incidentally, via the Client-errors
   card while testing: a real `Maximum update depth exceeded` render-loop error on `/stats`,
   logged today — not mine to fix (outside this slice, and `StatsPage.tsx`/`savedFiltersStore.ts`
   are the concurrent session's active files), flagged to the user instead.
8. **Compare clubs & seasons** — **Done**, no collision. `domain/clubCompare.ts`/
   `domain/seasonCompare.ts` (both reuse existing aggregation — `aggregateTeamStats` for clubs,
   plain match rollup for seasons — no new stats math), new `/compare/clubs`/`/compare/seasons`
   pages mirroring the existing `CompareTeamsPage` layout, cross-link chain extended to a
   4-page loop. Venue vs Venue deliberately not built — Venue isn't a first-class entity (§4).
   Verified live: both pages render, correct empty state (dev DB only has one club/season so the
   populated table itself wasn't visually exercised — the arithmetic is a straightforward reuse
   of already-verified aggregation code), cross-link chain navigates correctly, no console errors.
9. **Maintenance mode** — **Done**, no collision. `AppSettings.maintenance` +
   `MaintenanceScreen.tsx` + a gate in `App.tsx` (checked once at app root, bypassed for
   `isMasterAdmin()`). Deliberately one mechanism for both "scheduled" and "emergency" maintenance
   (an ETA field is informational only — there's no backend to auto-start a maintenance window at
   a future time in this client-only app). No read-only mode built — Prompt 2.md listed it as "if
   appropriate," and retrofitting a read-only guard across every mutation in the app is a much
   bigger, separate undertaking than the gate itself, which already covers the real use case
   (stop non-admins using the app during a deploy/fix). Verified live: the toggle/message field on
   Platform Settings render and respond correctly. **Did not save `maintenance.enabled: true`** —
   the harness's permission system correctly blocked persisting that to the live settings doc,
   since it would have actually taken the real app offline for every non-master visitor with no
   user request or authorization; the `App.tsx` gate itself was verified by code review.
10. **Platform analytics** — **Done**, no collision. `domain/platformAnalytics.ts` + new
    `/admin/analytics` page + `components/charts/GrowthChart.tsx`. True DAU/MAU is **not**
    tracked — no session/login log exists in this client-only app, and building one (hooking
    `auth.service.ts`'s login) was judged out of scope for this slice; every number is derived
    from existing `createdAt`/`scorerId` fields instead, with an explicit "what this doesn't
    measure" disclosure on the page itself. **Found and fixed a real bug during verification**:
    `bucketByDay()` crashed (`RangeError: Invalid time value`) on a real malformed `createdAt` in
    the live `users` collection — fixed with a `Number.isFinite` guard (skip, don't crash),
    matching Phase 0's "resilience to legacy/foreign docs" convention. Caught live by this
    session's own Phase 15 error-recovery work: reproduced the crash, confirmed the error boundary
    + `clientErrors` log worked correctly, then fixed it and confirmed the page renders real data.
11. **Legal & compliance pages** — **Done**, no collision. `/privacy` + `/terms`, project-specific
    content (not generic boilerplate) reflecting this app's real data practices, each with an
    explicit "template, not a substitute for legal review" disclaimer — accurate framing rather
    than a false claim of legal sufficiency. Linked from the public footer and a new `/signup`
    consent notice. Verified live: both pages render, footer links present, signup notice renders.
12. **Invitation system** — **Done**, no collision (the `/admin/invitations` lazy import + route
    had already been folded into the concurrent session's Phase 24 commit since it was sitting on
    disk at the time; only the `/invite/:code` public route remained to be added to `App.tsx`).
    New `invitations.service.ts` + `/admin/invitations` (master-admin) + public `/invite/:code`.
    Real email delivery deferred (§4) — the invite is a shareable in-app link plus a notification,
    not an email. Expiry resolved lazily (`effectiveStatus()`), same pattern as Trash retention —
    no backend cron in this client-only app. Verified live end-to-end against the real database:
    created an invitation via the UI, confirmed list badges/expiry, confirmed the public page's
    wrong-account branch for a mismatched signed-in user, then exercised accept (role actually
    flipped `VIEWER`→`SCORER`, inviter notified), decline, cancel, and resend (expiry extended) via
    direct service calls, and confirmed `effectiveStatus()` returns `expired` for a past-due doc.
    All test invitations, the test notification, and the test user's role were cleaned up after.

(Appended to as further slices are picked up.)
