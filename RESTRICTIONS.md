# RESTRICTIONS.md

Single source of truth for implementation constraints, instruction precedence, architectural
decisions, deferred work, and guidance for future sessions on **CricketHub**
(`cricket-platform/`). Keep this file synchronized with `cricket-platform/ROADMAP.md`,
`cricket-platform/ROADMAP_V2.md`, and `cricket-platform/CHANGELOG.md` — update it the moment a new
restriction, conflict, deferral, or architectural decision is made, without pausing implementation
work to do so.

**Two roadmaps exist**: `ROADMAP.md` is the original "commercial platform" feature expansion (32
phases, all done). `ROADMAP_V2.md` (started per explicit user request) is a follow-on
cleanup/hardening/polish pass — not new feature surface, but making the existing surface more
solid (repo cleanup, media management, notification polish, UI/UX, performance, production
hardening, dev tooling). Every constraint/precedent below applies to both equally.

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
| Exhaustive accessibility audit | Already `🚫` in ROADMAP.md (Phase 9) | Open-ended by nature; unchanged. |
| Real email/SMS delivery for invitations | Deferred | This is a client-only Firebase app with no backend to send mail from (no Cloud Functions, no SMTP/SES key). The invitation system (Phase 25) is fully functional via an in-app shareable link and the existing notification center instead — an invitee sees it in-app or gets a copy-able link from the master admin. Wiring a real transactional-email provider is a bounded future add-on, not invented speculatively. |
| Background job system (async queue + progress UI for stats recompute, exports, reports) | Deferred | Same reasoning as the event-bus deferral above: no Cloud Functions/Admin SDK here, so a real job queue needs a server to survive a closed tab; a fake client-side one would silently drop in-flight work. Existing long operations (recompute stats, exports) already run synchronously and complete quickly at this app's scale. |
| Full operational/performance monitoring (storage usage %, Firestore read counts, cache efficiency, render performance, sync latency, "platform health score") | Deferred, beyond a scoped error dashboard (Phase 31) | Real APM needs either a backend to aggregate across clients or a third-party vendor (Sentry/Datadog) this project has no key for. The one piece of this ask that *is* genuinely buildable without new infra — error-rate aggregation from the `clientErrors` collection Phase 15 already writes to from every client — is scoped into Phase 31. The rest (storage %, read-count instrumentation, cache/render metrics) has no data source today and would need new instrumentation added throughout the app for uncertain payoff. |
| Rate limiting, CSRF protection, account lockout, suspicious-activity detection | Deferred (documented instead, Phase 30) | A client-only implementation of any of these (e.g. a localStorage-based lockout counter) is trivially bypassable by clearing storage or reloading, and would be a false sense of security — worse than not building it, same reasoning as the financial-ledger deferral. CSRF specifically doesn't apply here: Firebase Auth uses bearer tokens, not cookies, so there's no ambient credential for a forged cross-site request to ride on. XSS is covered by React's default JSX escaping — confirmed via grep, no `dangerouslySetInnerHTML` anywhere in `src/`. Real rate limiting/lockout needs a backend (Cloud Functions + Firestore security rules working together, or a WAF) to be tamper-proof — revisit if/when this project gets one. |
| Custom tournament registration forms (custom fields, payment-status tracking, notes/attachments) | Deferred | Payment-status tracking is financial (already deferred above). The custom-field builder itself is a sizable new subsystem (dynamic field types + a validation engine) with no existing self-serve tournament-registration flow to attach it to today — bigger than a bounded slice; flagged for a future milestone with the user rather than invented speculatively. |
| Media library scope beyond a housekeeping view (galleries, sponsor-graphic categories, document storage, duplicate-upload prevention) | Deferred, beyond Phase 27 | Phase 27 covers the concrete, bounded ask (browse/delete already-uploaded images in one place). A full DAM-style content library with categorization and document storage has no current content type driving it — nothing in this app produces sponsor graphics or documents today. |
| Push notification (FCM) architecture ("prepare for future push notifications") | Deferred | Building unused scaffolding (service worker, VAPID keys) with no backend to send *from* and nothing wired to trigger it would be exactly the kind of half-finished implementation `CLAUDE.md` warns against. Revisit only when a concrete push-sending mechanism (a backend, or a third-party push service) is actually being added. |
| Disaster recovery: restore-from-backup / rollback tooling | Deferred, explicitly flagged as high-risk | Phase 1's JSON platform-backup export already exists. An automated one-click *restore* (overwrite/merge live Firestore data from an uploaded JSON file) is a destructive, hard-to-reverse operation with no dry-run/diff preview and no undo beyond Trash's soft-delete (which doesn't cover overwrites) — building this speculatively inside an autonomous slice pass, without the user explicitly scoping the exact safety mechanism first (dry-run diff, confirmation gates, partial-restore scoping), risks catastrophic, unrecoverable data loss if ever misused. Requires explicit user sign-off before any implementation. |
| Database migration tooling (schema-evolution, rollback, migration history, validation) | Deferred | The project already avoids needing this via an additive-optional-fields convention for every schema change made this session (new fields are always optional, old docs read fine without them). Building dedicated migration tooling is an infrastructure decision for the user to make, not one to bootstrap unasked. |
| Invitation system extended to new-player / "club member" invites | Deferred | Phase 25 covers inviting an *existing* user to an admin-side role. Inviting a brand-new person (no account yet) to become a player, or a "club member" concept, doesn't exist in the data model today (`Club` has no membership list) and is a different feature (self-service account creation/claiming tied to a `Player` record) — bigger scope than a bounded follow-up to Phase 25; flagged for a future milestone. |
| Security response headers (CSP, `X-Frame-Options`, etc.) in `firebase.json` hosting config | Deferred, recommended follow-up (Phase 30 finding) | Genuinely missing today — no headers configured at all. Not authored blind: this app uses inline `style={{...}}` extensively (31 occurrences, 18 files — team colors, charts, background themes), which needs `style-src 'unsafe-inline'` to keep working, and `firebase.json`'s `headers` only take effect on a real Firebase Hosting deploy — there's no way to verify a CSP against the production origin from local dev. Shipping one unverified risks silently breaking styling or Firebase SDK connectivity with no way to catch it here. Author + verify this against a real deploy, not inside an autonomous local pass. |
| Hat-trick / award-won / record-broken activity + notification triggers | Deferred, beyond Phase 26's century/half-century/five-wicket-haul | Hat-trick needs consecutive-wicket-ball parsing across the delivery log (meaningfully more complex and risk-prone than a threshold check on a denormalized card). "Record broken" would need comparing this match's figures against every other completed match's, an expensive cross-match query with no existing precedent. "Award won" (Player of the Match) is set manually by an admin post-game, not at a single automatic trigger point like match completion — there's no clean hook for it. All three flagged for a future milestone rather than rushed into Phase 26. |
| Feature-flag club-specific scoping | Deferred, beyond Phase 21 | Phase 21 built global on/off + percentage rollout + beta-only gating; no flags gate an actual per-club feature yet (no experimental feature exists that would need it) — prepared architecture for the next one, not a current need. |
| Platform analytics: retention, feature-usage tracking | Deferred, beyond Phase 22/31 | Same root cause as the already-documented DAU/MAU gap — no session/login log exists to compute return-visit retention from, and per-feature usage needs an event-tracking pipeline this app has never had. Phase 22 already discloses what it doesn't measure rather than fabricating a number; the same honesty applies here. |
| Multi-tagging `logActivity()` so scoped detail-page feeds (Phase 34) show related match activity, not just the entity's own creation event | Deferred, beyond Phase 34 | `refId` is a single field; making a match's activity entries also reference both team ids and the tournament id (and milestones filterable by player) means touching every call site in `matches.service.ts`/`scoring.service.ts` plus deciding whether `ActivityLog` needs a `refIds: string[]` shape change — a schema/call-site change across already-verified services, bigger than "wire up the existing prop." |

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
13. **Re-audit (post slices 2-12) → Phases 26-31 planned** — Cross-referenced `fps/add_these.md`
    against `RESTRICTIONS.md` §7 and `ROADMAP.md`'s ✅ markers (delegated the raw diff to an
    Explore agent to keep the 1792-line spec file out of the main context window; judgment on what
    to build vs. defer stayed with me). Found 12 genuinely-unaddressed areas; scoped 6 into bounded
    Phase 26-31 slices (activity milestones, media library, audit log detail, in-app release notes,
    a security-hardening documentation pass, error monitoring) and explicitly deferred the rest to
    §4's table (background job system, full ops/performance monitoring beyond a scoped error
    dashboard, rate limiting/CSRF/lockout, custom tournament registration forms, push notification
    architecture, disaster-recovery restore tooling, database migrations, player/club-member
    invites) — each with its own reasoning, mostly "needs a real backend this client-only app
    doesn't have" or "would be a false sense of security if faked client-side."
14. **Activity feed milestones + type filter (Phase 26)** — **Done**, no collision. New
    `domain/milestones.ts` (pure) detects centuries/half-centuries/five-wicket hauls from a
    completed match's `battingCard`/`bowlingCard`; wired into `scoring.service.ts`'s
    `notifyMatchDone()`. **Found and fixed a real bug while wiring this in**: `notifyMatchDone` was
    reading `match.innings`, but at two of its four call sites the just-computed final innings
    state lives in a local variable not yet reflected on `match` — a milestone on the innings-
    ending ball would have been silently missed. Fixed by threading the fresher local array through
    explicitly. `ActivityFeed` gained an optional `filterable` chip row, enabled on the Dashboard.
    Verified live end-to-end against the real database via the actual `completeMatch()` service
    call (not a reimplementation): both milestone types logged correctly with real player
    names/values, and the linked-user notification fired with the right copy. All test data cleaned
    up. **Note**: the `filterable` chip UI itself was verified by code review + `tsc`'s
    exhaustiveness check on the two new `Record<ActivityLog['type'], …>` maps, not a live click-
    through — the preview browser's authenticated session was lost when the dev server restarted
    mid-slice, and no login credentials were available to re-establish it. Per the standing safety
    rules (`Creating accounts` is a prohibited action-category, not something to route around),
    self-registering a new account via the signup form to work around this was correctly not
    attempted.
15. **Media library (Phase 27)** — **Done**, no collision. New `/admin/media` (master-admin):
    per-folder browsable list of Storage uploads across players/teams/clubs/tournaments/users,
    with a running total and delete, cross-referencing each image's URL against the live entity
    collections to flag orphaned/unused uploads. **Found and fixed a real bug**: Firebase
    Storage's `listAll()` hangs indefinitely (never resolves, never rejects) on a folder prefix
    that's never had an object uploaded — confirmed directly against this project's live bucket
    (a raw REST call to the same prefix returned a 404 in under a second; the SDK call sat for
    15+ seconds with no resolution and no network request even visible for a later, unrelated
    upload attempt). Every one of this dev database's five folders is in that never-touched state
    today, so this would have shipped as an infinite spinner on first load. Fixed with an 8s
    client-side timeout race in `storage.service.ts` that treats a hang as "empty folder."
    Verified live: reproduced the hang pre-fix, confirmed the fix resolves correctly across all
    five real folders post-fix. **Did not get a full round-trip test with a real uploaded image**
    — constructing a `File` from a canvas in a raw eval context hung before issuing any network
    request (a test-harness artifact, not a reproduced app bug; Phase 12's real upload path via an
    actual file picker was already verified when that phase shipped). No test data was created (no
    Storage object exists to clean up — confirmed via a fresh list call after the stuck attempt).
16. **Audit log detail (Phase 28)** — **Done**, no collision. `AuditLog` gained optional
    `before`/`after` and `userAgent`; `logAudit()` takes an optional `{before, after}` arg, pruned
    via the existing `pruneUndefined()` convention when omitted. Wired into the two call sites
    with a genuine before/after value already in hand at no extra read cost (`UsersPage.tsx`'s
    role change and suspend/reinstate; `featureFlags.service.ts`'s emergency-disable, now its own
    `featureFlag.emergencyDisable` audit action). Other callers left as-is — their `details`
    message already states the full new value, or there's no single before/after field to
    capture. IP address deferred (§4) — no backend to observe a real request IP from. Verified
    live via direct service calls against the real database (same master-admin-auth-loss caveat
    as Phase 26 — Platform Tools needs auth the preview session didn't have): a `logAudit()` call
    with a diff writes both fields correctly with no Firestore `undefined`-field rejection, a call
    with no diff correctly omits both while still capturing `userAgent`, and the new `briefUA()`
    helper parses a real user-agent string into `"Chrome on Windows"`. Test entries cleaned up.
17. **In-app release notes (Phase 29)** — **Done**, no collision. New header `WhatsNewButton`
    (any signed-in user) opening a panel of curated highlights (`lib/releaseNotes.ts`, static,
    read-only — no new Firestore collection), with a `localStorage`-backed seen/unseen dot badge.
    `package.json` bumped `0.0.0` → `1.0.0`. Deliberately a small hand-picked subset of
    `CHANGELOG.md`, not a raw dump of every internal phase — that file remains the full
    engineering record. Verified the data module and localStorage logic directly; the button
    itself lives inside the signed-in `AppShell`, so a live click-through wasn't possible without
    master-admin auth (same caveat as Phases 26/28) — it only composes already-verified
    primitives (`Modal`) and passed `tsc`/build clean.
18. **Security hardening review (Phase 30)** — **Done**, no collision. A documentation pass, no
    new code. Grepped `src/` for `dangerouslySetInnerHTML`, `eval(`/`new Function(`,
    `.innerHTML =`/`document.write`, and `target="_blank"` — zero matches on all four, so no XSS
    escape-hatch and no reverse-tabnabbing risk exist today. Confirmed CSRF doesn't apply (bearer-
    token auth, no cookies). Confirmed `.env.local` is correctly gitignored (only `.env.example`
    placeholders are tracked). **Found one genuine new gap**: no security response headers (CSP,
    `X-Frame-Options`) configured anywhere in `firebase.json`. Deliberately **not implemented**
    this pass and added to §4's deferred table instead — this app uses inline `style={{...}}`
    extensively (31 occurrences, 18 files), so a CSP needs careful `style-src` scoping, and
    `firebase.json`'s `headers` only take effect on a real Firebase Hosting deploy with no way to
    verify from local dev; authoring one blind risks silently breaking production styling or
    Firebase connectivity with no way to catch it here. Flagged as a recommended follow-up for the
    user's own deploy-and-verify cycle.
19. **Error monitoring dashboard (Phase 31)** — **Done**, no collision. New pure
    `domain/errorMonitoring.ts` (`summarizeErrors`) aggregates the existing `clientErrors`
    collection: 14-day daily trend (reused `platformAnalytics.ts`'s `bucketByDay`, exported rather
    than duplicated), top 5 messages, top 5 routes, 7-day total. Wired onto Platform Tools'
    existing "Client errors" card (raised its fetch cap 50→200), reusing `GrowthChart`. This
    closes the one genuinely-buildable piece of the broader "operational monitoring" ask from the
    Phase 26-31 audit — the rest (storage %, Firestore read counts, cache/render performance, sync
    latency) stays deferred in §4, no data source for any of it today. Verified the aggregation
    logic directly: against the real `clientErrors` collection (5 total, 1 in last 7 days) and
    fabricated edge-case data — confirmed the 14-day window correctly excludes an old error,
    confirmed a malformed `NaN` timestamp is skipped in day-bucketing without crashing (same guard
    as Phase 22's `bucketByDay` fix) while still counting toward message/route frequency, and
    confirmed exact top-message/top-route counts. No test data to clean up (pure computation, no
    writes). UI composition wasn't click-tested live — same master-admin-auth-loss caveat as
    Phases 26/28/29.
- **Dashboard widget customization** — **Done**, no collision. `store/dashboardLayoutStore.ts`
  (localStorage-only, mirrors `favStore`/`savedFiltersStore`). This was the one item in the §4
  deferred table explicitly flagged "not blocked, just not picked up yet" — it's picked up now,
  and the table entry above has been removed accordingly. Move-up/move-down buttons instead of
  real drag-and-drop (no DnD library anywhere in this app, and adding one for one feature wasn't
  worth the new dependency); no resize (every widget is a variable-height content list — natural
  height is already the right size, an arbitrary fixed size wouldn't be meaningful here).
  Reordering stays within each of the two existing columns rather than mixing across them, so the
  match-related and leaderboard-related widgets can't end up interleaved. Not click-tested live —
  same master-admin-auth-loss the last several phases have hit; the widget JSX itself is unchanged
  from the already-live-verified original, only relocated into a keyed map.
20. **Global search: Clubs (Phase 33)** — **Done**, no collision. A second-pass audit of
    `fps/add_these.md` against the (now-updated) slice log/deferred table found Clubs was the one
    first-class entity missing from `search.service.ts`'s `globalSearch()`, despite the Command
    Palette's own original spec listing it as searchable. Added `clubs` to `SearchResults`, wired
    into `CommandPalette.tsx` and the public `SearchPage.tsx`. Also formalized several previously-
    undocumented deferrals into §4 during this same audit pass: hat-trick/award-won/record-broken
    activity triggers (beyond Phase 26's threshold-based century/five-wicket-haul), feature-flag
    club-specific scoping (beyond Phase 21), and platform-analytics retention/feature-usage
    tracking (beyond Phase 22/31) — all three were already implicitly out of scope per their
    respective phases' own text but hadn't been cross-referenced into the deferred table. Verified
    live end-to-end via the real public `/search` page (no auth needed): created a real test club,
    searched for it, confirmed "1 result" + a working "Clubs 1" filter chip + correct rendering,
    hard-deleted the test club after (`deleteClub()` isn't the Trash soft-delete). `tsc`/`npm run
    build`/lint clean.
21. **Activity feeds on entity detail pages (Phase 34)** — **Done**, no collision. Wired the
    already-existing `ActivityFeed refId` scoping onto `ClubPage`/`TeamPage`/`PlayerPage`/
    `TournamentPage`. **Judgment call documented, not silently shipped**: `logActivity()`'s `refId`
    is only ever set to the *creating* entity's own id — match lifecycle events and milestones are
    tagged with the match id (milestones use `actorId` for the player, which `listActivity()`
    doesn't filter on) — so a scoped feed today mostly shows its own single creation entry rather
    than related match activity. Extending every `logActivity()` call site in `matches.service.ts`/
    `scoring.service.ts` to multi-tag (team ids, tournament id) would make this richer, but is a
    broader change than "wire up the existing prop" and is added to §4 below rather than expanded
    into here. `tsc`/`npm run build` clean. **Click-tested live** (a follow-up verification pass,
    since these four pages are public routes and don't need the master-admin auth this session has
    repeatedly lost): `/player/prs4`'s Activity tab, `/tournament/seedT1`'s Activity tab, and
    `/team/{id}`'s Activity card all rendered correctly, each showing the expected "No activity
    yet." empty state scoped to that entity. `computer.left_click` didn't register on the tab
    buttons (a JS-dispatched `.click()` worked instead) — a tooling quirk, not an app bug.
22. **`ROADMAP_V2.md` Phase 1 — Repository cleanup** — **Done**, no collision. Removed the dead
    `listMatches(opts)` from `matches.service.ts` (verified zero callers anywhere, including its
    own file) whose shape — equality `where()` filters combined with `orderBy` on a different
    field — would have thrown a missing-composite-index error the first time anyone actually
    called it; also removed its now-unused `limit`/`MatchStatus` imports. New
    `firestore.indexes.json` (empty, registered in `firebase.json`) makes "this app needs zero
    composite indexes" a checked-in decision rather than a silent absence. **A broader grep-based
    dead-export sweep was attempted and abandoned** — same-file-excluding text matching flagged 22
    "unused" functions, but spot-checking showed most are false positives (called internally by a
    sibling exported function in the same file, e.g. `trash.service.ts`'s `bulkRestore()` calling
    `restoreFromTrash()`). Nothing from that list was deleted. A trustworthy version of this sweep
    needs a real TS usage analyzer (e.g. `ts-prune`), not a grep script — noted as a real gap, not
    attempted this pass since introducing a new dev-tooling dependency wasn't itself in scope yet.
23. **Tournament vs Tournament comparison (Phase 35)** — **Done**, no collision (found already
    built and uncommitted on disk mid-verification; completed the live check rather than
    duplicating). New `domain/tournamentCompare.ts` (`aggregateTournamentStats`) + `/compare/
    tournaments`, mirroring `CompareSeasonsPage`'s picker + stat-rows layout exactly. `tsc`/`npm
    run build` clean. **Click-tested live** against the real public page: with only one real
    tournament in the dev database, confirmed the correct "Not enough tournaments to compare"
    empty state; created a real throwaway second tournament, confirmed the comparison table
    populated with genuine aggregated stats (the new empty one read `0/0/0/0` against the real
    seed tournament's `2 teams/1 match/117 runs/7 wickets`), and both dropdown pickers listed both
    tournaments correctly. Test tournament hard-deleted after, confirmed no orphaned activity-log
    entry either.
24. **`ROADMAP_V2.md` Phase 2 — Notification history page** — **Done**, no collision on the
    feature itself. New `/notifications` page reusing the already-existing (previously unused)
    `listNotifications()`, with read/unread + category filter chips and pagination, plus a "View
    all notifications" link added to the bell dropdown. **Hit and documented a new failure mode**:
    a genuine silent concurrent-edit race on `App.tsx` — my first attempt to add the route was
    overwritten by the other session's own `App.tsx` edit (adding `CompareTournamentsPage`), which
    had read the file *before* my edit landed and wrote back based on that stale read, erasing mine
    with no error on either side. Caught only by explicitly grepping for the new symbol after the
    fact rather than trusting the edit succeeded. **New standing practice, recorded here because
    it generalizes beyond this one slice**: after editing a hot, frequently-contended shared file
    (`App.tsx`, `AppShell.tsx`, `types/index.ts`, `collections.ts`, `ROADMAP.md`) — especially the
    kind edited by both sessions in most slices — grep for the specific new symbol/line immediately
    after the edit and before considering the slice's file changes "done," not just after `tsc`
    (which wouldn't have caught this: the file was still syntactically valid and type-safe without
    my route, just missing the route). `tsc`/`npm run build` clean after the fix; not click-tested
    live (no master-admin auth on this session's browser origin — the concurrent session's own
    entry #23 above notes it *does* still have live access, so this is a per-browser-session gap,
    not a project-wide one).

(Appended to as further slices are picked up.)
