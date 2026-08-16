# RESTRICTIONS.md

Single source of truth for implementation constraints, instruction precedence, architectural
decisions, deferred work, and guidance for future sessions on **CricketHub**
(`cricket-platform/`). Keep this file synchronized with `cricket-platform/ROADMAP.md`,
`cricket-platform/ROADMAP_V2.md`, `cricket-platform/ROADMAP_V3.md`, and
`cricket-platform/CHANGELOG.md` — update it the moment a new restriction, conflict, deferral, or
architectural decision is made, without pausing implementation work to do so.

**Three roadmaps exist**: `ROADMAP.md` is the original "commercial platform" feature expansion (37
phases, all done). `ROADMAP_V2.md` (7 phases, all done) was a follow-on cleanup/hardening/polish
pass — not new feature surface, but making the existing surface more solid. `ROADMAP_V3.md`
("League Ecosystem," started per explicit user request) is the next major product milestone —
genuinely new, spectator/community-facing feature surface (sharing, comments, reactions, following,
public profiles, embeds, QR codes, tournament sponsors/galleries/announcements/downloads/calendar).
Every constraint/precedent below applies to all three equally.

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
| Cross-device follow sync (`favStore` moving from localStorage to a per-user Firestore doc) | Deferred, beyond `ROADMAP_V3.md` Slice 2.2 | `favStore` stays device-local for every visitor including signed-in ones. Syncing it server-side (so e.g. a public user profile could show what that person follows, per Slice 2.1's own note) needs new writes, a `firestore.rules` block, and a migration path for whatever's already in a user's `localStorage` — a real design decision bigger than widening the `FavKind` enum, which is all this slice did. Revisit as its own scoped slice if a concrete need (cross-device follows, public follow lists) makes it worth the write cost. |
| Duckworth-Lewis (D/L) rain-rule support, even as a placeholder | Omitted per explicit user instruction ("future-ready placeholder only if already supported; otherwise omit") | Confirmed via grep (`Duckworth\|D/L\|DLS\|dls`) — zero hits anywhere in the codebase. Not implemented in any form, so no placeholder was added to the Match Rules step. Revisit only if the user explicitly scopes a real D/L (or simplified target-reset) implementation. |
| Follow-On rule in the Match Rules step | Omitted per explicit user instruction ("only if applicable to the match format") | `MatchFormat` is `'T20' \| 'ODI' \| 'T10' \| 'THE_HUNDRED' \| 'CUSTOM'` — no multi-day/Test format exists anywhere in the type system, and Follow-On is meaningless for any of these (all are single-innings-per-side limited-overs formats). Revisit only if a multi-day format is ever added. |
| Super Over — actual scoring/resolution engine | Deferred; implemented as a rule flag only | The user's ask listed "Super Over enabled" as a plain setting to include (not conditioned like D/L or Follow-On), so `Match.superOverEnabled` exists and a confirmation note shows on a tied result ("Super Over enabled per match rules — to be scored as a separate match"). No existing tie-breaker/Super-Over infrastructure was found anywhere in `domain/scoring.ts` or its callers, and building a second mini-match scoring flow (its own innings, its own all-out rule, linking back to the parent match's result) is materially bigger than "read a configuration value" — it would mean *adding* scoring logic, which conflicts with the user's own explicit constraint ("Do not modify scoring logic beyond reading these configuration values"). A tied Super-Over match today is just scored as its own separate `Match` document, same as any other match. |

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
25. **Audit log: login events + search (Phase 36)** — **Done**, no collision (same pattern as
    entry #23: found already built and uncommitted on disk — `logAudit()` wired into both
    successful-login paths in `auth.service.ts`, plus a search box + raised fetch cap on Platform
    Tools' audit card — completed verification rather than duplicating). `tsc`/`npm run build`
    clean. Reviewed the login-audit change for a real correctness point: `logAudit()` is
    fire-and-forget (`void`, not `await`ed) in both paths, so a non-admin's login — whose audit
    write Firestore rules correctly reject (`allow create: if isAdmin()`) — can never delay or fail
    the actual sign-in; confirmed by reading `firestore.rules`' `auditLogs` match block directly,
    not assumed. **Click-tested a follow-up verification pass** once the preview browser could
    reach the dev server again: wrote a real `auth.login` audit entry directly via `logAudit()`
    and confirmed its schema (`action`, `details`, `userAgent`, actor fields) came out correct;
    separately unit-tested the search filter's exact OR-across-action/details/actor logic against
    three fabricated entries, confirming both true-positive and true-negative matches (including a
    query that matched via the *actor name* rather than the action, correctly — the filter is
    meant to be inclusive across all three fields). Test audit entry cleaned up after. Signing in
    through the actual login form still wasn't exercised (no credentials available), but the
    write path and search logic are now verified independently of the UI.
26. **`ROADMAP_V2.md` Phase 3 — Match photo galleries** — **Done**, no collision. New
    `components/media/MatchGallery.tsx`, built entirely on the already-existing
    `storage.service.ts` exports (`uploadImage`/`deleteUploadedImage`/`listFolderImages`) — no
    service-layer or `storage.rules` changes needed, since the rules file's `match /{allPaths=**}`
    wildcard already covers a new `matches/{id}/` folder. Wired into the public `MatchPage.tsx`
    right after the scorecard, passing the page's existing `canScore(profile)` boolean through as
    `canManage`. Multi-file upload + per-photo delete for the match's scorer/owner (or master
    admin); a lazy-loaded grid + built-in lightbox for everyone else; renders nothing (not an empty
    placeholder) for a read-only visitor when there are zero photos. **Hit the tsc run mid-slice
    while the concurrent session had an uncommitted, in-flight edit to `PlayerFormModal.tsx`**
    (a new "reason for change" field) that didn't type-check yet (`Field` doesn't accept the
    `className` prop it was passed) — confirmed via `git diff --stat` this belonged to the other
    session, not this slice, and correctly left it untouched rather than fixing someone else's
    active edit (risks a second silent-overwrite race, same class of risk as entry #24's `App.tsx`
    incident). Both new/changed files for this slice type-check clean on their own. **Click-tested
    live**: started a second dev-server instance (port 5174, alongside whatever the concurrent
    session has running on 5173) and loaded a real completed match's public page — no auth needed,
    since a signed-out visitor is exactly the `canManage=false` path this needed to prove out;
    confirmed the Storage SDK loads, the section shows "Loading photos…" then correctly resolves to
    fully hidden for a zero-photo read-only visitor, and no console/network errors. Upload/delete
    (the `canManage=true` path) not exercised — same master-admin-auth-loss caveat as several
    recent phases.
27. **Optional edit reason on regular edits (Phase 37)** — **Done**, no collision (entry #26 above
    correctly spotted my in-flight, not-yet-type-checked edit to `PlayerFormModal.tsx` mid-slice
    and left it alone — this entry is that same work, finished). Added an optional "Reason for
    this change" field to all five edit surfaces (`PlayerFormModal`/`TeamFormModal`/
    `ClubFormModal`/`TournamentFormModal`, shown only when editing not creating, and
    `MatchSetupPage`'s review step, shown only when `?edit=` is set), threaded through each page's
    save handler into `snapshotVersion()`'s existing `reason` param (supported since Phase 18,
    never previously populated by a manual-edit caller). **Found the same real bug at all five
    call sites**: `Field` doesn't accept a `className` prop — passing one is a `tsc` error, not a
    silent no-op. Fixed by wrapping each new field in a plain `<div className="mt-4">` instead.
    Verified live end-to-end against the real database: created a throwaway test player, updated
    it, called `snapshotVersion()` exactly as a save handler does (with a real reason string), and
    confirmed `listVersions()` returned the entry with the reason correctly stored — the actual
    Firestore round-trip this feature depends on. Test player and version entry both cleaned up
    after. The five forms' UI wasn't click-tested (gated behind auth this session has repeatedly
    lost), but each is a straightforward `tsc`-verified prop-threading change riding on a
    round-trip that's now independently proven. `tsc`/`npm run build`/lint clean.
28. **Performance: bundle chunking (`ROADMAP_V2.md` Phase 5)** — **Done**, no collision (touches
    only `vite.config.ts`, untouched by anyone else this session). Added
    `build.rolldownOptions.output.manualChunks` — **not** `build.rollupOptions`, which still works
    here but is marked deprecated in this Vite 8/Rolldown build per `node_modules/vite`'s own type
    definitions; confirmed by reading them rather than assuming Rollup-era config keys carry over
    unchanged. Splits `vendor-firebase`/`vendor-react`/`vendor` off from the app's own code — the
    old monolithic `collections-*.js` chunk (680kB, everything importing `lib/collections.ts` plus
    the whole Firebase SDK bundled together) is gone; the app's own entry chunk dropped from ~305kB
    to ~72kB. The 500kB+ chunk build warning still fires on `vendor-firebase` alone — expected,
    left as-is, it's the SDK's real size, not something manual chunking reduces further. **Click-
    tested the actual production bundle**, not the dev server (`manualChunks` only affects
    `vite build`, `vite dev` never bundles) — added a `cricket-platform-preview` entry to
    `.claude/launch.json` (`vite preview`, port 4173), loaded the public home page (real live
    match/leaderboards/results rendered from genuine Firestore data, all three vendor chunks
    fetched with zero console errors), then navigated to the separately lazy-loaded `/stats` route
    and confirmed it rendered correctly too, proving the split survives real chunk-to-chunk
    navigation, not just first load.
29. **Production hardening: form validation audit (`ROADMAP_V2.md` Phase 6)** — **Done**, no
    collision. Scoring (`ScoringPage.tsx`) needed no fix — every run value is a discrete button
    (0/1/2/3/4/6), not free-text, so there's no numeric range to violate by construction.
    Player/Team/Club forms have no numeric fields. **Found and fixed two real gaps in
    `MatchSetupPage.tsx` and `TournamentFormModal.tsx`**: both had a numeric `<Input min={1}>`
    whose HTML `min`/`max` attributes aren't actually enforced (no wrapping `<form>` or
    `reportValidity()` call anywhere in this app), paired with a `Number(x) || fallback` pattern at
    submit time that silently swaps in the fallback for `0` but lets negative numbers straight
    through unchanged — a user really could click through the match-setup wizard with `0` or
    negative overs/balls-per-over, or save a tournament with an invalid teams-advancing-per-group
    count, all the way to a real Firestore write. Fixed with explicit range checks (`canAdvance()`
    gate for match setup, `setError(...)` early-returns for the tournament form, matching how
    `!name.trim()` was already handled there) rather than silent substitution. `tsc`/`npm run
    build` clean. Not click-tested live — both are auth-gated admin forms; confirmed via a fresh
    `vite preview` tab that no session/credentials are available this pass (loaded the sign-in
    screen, as expected — consistent with every other master-admin-gated phase this session).
30. **Developer tooling (`ROADMAP_V2.md` Phase 7)** — **Done**, no collision. Scoped directly from
    Phase 1's own audit finding ("no `CONTRIBUTING.md`... `README.md` status unconfirmed"): read
    the existing `README.md` and found it's a real, accurate setup doc (not a placeholder), just
    stale in two spots — a 5-role list missing `MASTER_ADMIN`, and a "first admin" bootstrap
    description instead of the actual reserved-username mechanism — both fixed. New
    `CONTRIBUTING.md`: a short, human-facing dev-loop doc (run/verify commands, the "no test suite"
    convention, where things live, the off-limits list restated briefly with a pointer here for the
    full detail). Deliberately **not** built: CI/CD, pre-commit hooks, or a test framework — already
    covered by §4's standing deferral of automated test/CI infrastructure ("an infrastructure
    decision for the user to make"); this phase's scope was documentation, not new tooling. Docs-
    only change, `tsc`/`npm run build` unaffected.
31. **UI/UX polish pass (`ROADMAP_V2.md` Phase 4)** — **Done**, no collision. Audited the shared UI
    kit (`primitives.tsx`, `Modal.tsx`) first — `Button`/`Input`/`Select`/`Textarea` already have
    consistent focus/disabled states, no gap there. Real gap found: every full-screen overlay's
    backdrop appeared instantly with no transition while its panel faded in (where a panel
    transition existed at all) — genuinely inconsistent, not a nitpick. Added
    `animate-fade-in-opacity`/`animate-slide-in-left` to `index.css` and applied to the three real
    instances: `Modal.tsx`'s backdrop, `AppShell.tsx`'s mobile nav drawer (backdrop + the drawer
    panel, previously snapping open with no slide), `PlatformToolsPage.tsx`'s "Clear all
    leaderboards" dialog (backdrop + panel). Both new keyframes fall under the existing
    `.reduce-motion` rule automatically, no extra a11y work needed. **Deliberately skipped
    `CommandPalette.tsx`** despite it having the same backdrop pattern — the concurrent session had
    very recently and actively edited that exact file (Phase 33); touching it for a cosmetic gain
    risked exactly the concurrent-edit-race class of incident already documented twice this session
    (entries #24, #26) for no real benefit. `tsc`/`npm run build` clean. **Verified the animation
    mechanism directly against the running browser's CSS engine** (not just presence in the CSS
    source): injected a throwaway element with each new class via a real `vite preview` tab and read
    back `getComputedStyle().animationName`/`animationDuration`, confirming both fire correctly. The
    two auth-gated surfaces weren't click-tested through their real trigger — same master-admin-
    auth-loss caveat as recent phases.
32. **`ROADMAP_V3.md` created; Phase 1 Slice 1.1 — Shareable links** — **Done**, no collision. This
    starts the third roadmap, a genuinely new product milestone ("League Ecosystem") rather than
    more cleanup — see `ROADMAP_V3.md` for the full 5-phase plan and which of the user's requested
    items already existed from prior roadmaps vs. are net-new (most of Phase 1's asks — live mode,
    public pages — already existed; Phases 2-4 are mostly genuinely new). This slice: new
    `components/ui/ShareButton.tsx` (native share sheet → clipboard-copy fallback), added to all six
    public entity pages. **Found and fixed a real bug during live verification, not a hypothetical
    one**: `navigator.clipboard.writeText()` can reject (this session's own browser automation hit
    it live — `NotAllowedError: Document is not focused` — but focus loss/permissions/insecure-
    context are all real conditions a genuine visitor can hit too), and the first version had no
    handling for that rejection at all, so a failed copy would fail with zero user feedback. Fixed
    with a second-level error toast. `tsc`/`npm run build` clean. Verified live: `aria-label="Share"`
    confirmed present exactly once on Match/Tournament/Player/Team pages via direct DOM query (this
    turn's browser tooling had a `window.innerWidth/innerHeight` of 0 and `computer`/`read_page`
    timed out — a genuine tooling glitch, not an app issue, confirmed by `get_page_text` and
    `javascript_tool` working normally throughout; worked around it by verifying through the DOM
    directly rather than the accessibility tree); Club/Season pages use the identical one-line
    pattern, verified by code review only (this dev database has no club/season to click through).
33. **`ROADMAP_V3.md` Phase 1 Slice 1.2 — Mobile spectator polish** — **Done**, no collision. A real
    375px-viewport audit (page `scrollWidth`/`innerWidth`, per-element bounding rects, not
    eyeballed screenshots — this turn's `computer`/screenshot tool was intermittently timing out;
    confirmed via `get_page_text`/`javascript_tool`, which worked fine throughout, that this was a
    tooling glitch, not an app bug) of a completed match page, a live match page, and the
    tournament page's 11-tab bar. **Result: found zero page-level horizontal overflow anywhere** —
    the responsive foundation from prior roadmaps genuinely already holds up, confirmed by testing
    rather than re-asserting the earlier audit's read of the code. **One real, if minor, gap found
    and fixed**: the public footer's four links (`PublicLayout.tsx`, present on every public page)
    had only a ~20px tap target with no padding; added padding + hover state, measured 40px after
    the fix. `tsc`/`npm run build` clean.
34. **`ROADMAP_V3.md` Phase 2 Slice 2.1 — Public user profiles** — **Done**. The code landed via a
    joint commit (the concurrent session's own large "Final production audit" commit swept in my
    still-uncommitted `App.tsx`/`users.service.ts`/`UserProfilePage.tsx` changes alongside its own
    unrelated dead-code/a11y/bug fixes) — confirmed via `git show --stat HEAD` that all three files
    are present and correct, and re-ran `tsc` against the combined state afterward to be sure their
    changes and mine compile together cleanly. Same established, accepted pattern as entries #23/
    #25. New
    `/u/:username` page + `getPublicProfile()` in `services/users.service.ts`, resolving the
    existing `usernameLookup/{u}` → `users/{uid}` chain (both already public-read in
    `firestore.rules` — no rules change needed) into a narrowed `PublicProfile` (no email/status/
    bannedAt). A banned/pending account resolves identically to an unknown username — never
    reveals which case it is. **Deliberately shipped without a "followed teams/players" section**:
    `favStore` is localStorage-only (per-device), so there is no data to show for anyone's follows
    but the current browser's own; a real public follows list needs Slice 2.2 to decide on
    server-side sync first — noted there as a possible follow-up rather than faked here. `tsc`/
    `npm run build` clean. **Verified live end-to-end against the real database**, not a stub:
    `/u/ayaan` renders the actual master-admin profile through the real lookup chain (avatar
    initials, name, username, "Master Admin" badge, real join date); an unknown username correctly
    settles to "User not found"; no console errors either way.
35. **`ROADMAP_V3.md` Phase 2 Slice 2.2 — Extended following + activity feed coverage** — **Done**,
    no collision. `favStore.ts`'s `FavKind` grows to `clubs`/`seasons` (from `players | teams |
    tournaments`); `FollowButton` added to `ClubPage`/`SeasonPage`/`TournamentPage` (all three had
    none before — tournaments were already followable but had no button on their own page);
    `ActivityFeed refId` added to `SeasonPage.tsx` (`ClubPage.tsx` already had it). **Found and
    fixed a real, pre-existing bug unrelated to the two new kinds**: `AccountPage.tsx`'s "Following"
    card only ever rendered `favs.players`/`favs.teams` — `favs.tournaments` was already a
    followable kind before this slice but was never shown there, so following a tournament had no
    visible confirmation anywhere. Fixed by rendering all five kinds now, not just patching in the
    two new ones. **Cross-device sync intentionally deferred** — see §4's new table entry;
    `favStore` stays localStorage-only, which is also why Slice 2.1's profile page still can't show
    a real "follows" section for anyone but the viewer's own browser. `tsc`/`npm run build` clean.
    **Verified live against the real database**: followed the real `seedT1` tournament through the
    actual `FollowButton` click handler and confirmed `localStorage['crickethub.favs']` updated
    correctly with the new `clubs`/`seasons` keys present as empty arrays. `ClubPage`/`SeasonPage`'s
    additions and the `AccountPage.tsx` fix verified by code review only — same caveats as recent
    entries (no club/season reachable from a real link in this dev database; `/account` needs auth
    this session's browser doesn't have).

35. **Final comprehensive production audit** — user-requested, explicit scope: verify
    production-readiness across code quality, dead/duplicate code, unused dependencies, Firestore
    efficiency/indexes, TypeScript strictness, error handling, edge cases, UI consistency,
    accessibility, performance, security, and documentation accuracy — fix genuine issues, invent
    no new features. Delegated the broad multi-file investigation to three parallel agents (dead
    code/duplication; Firestore efficiency/security; accessibility/error-handling/UI consistency),
    independently verified their highest-confidence findings myself before acting on any of them,
    same discipline as every prior finding this session.
    - **Real, high-severity bug found and fixed**: `logActivity()` wrote `actorId`/`refId`
      straight into `setDoc()` without `pruneUndefined()` — Firestore rejects `undefined` field
      values (a standing, documented project constraint), so every call omitting `actorId` (the
      large majority of call sites — every entity-creation event) threw, was silently swallowed by
      the function's own best-effort try/catch, and the activity entry was never written. This
      means the "No activity yet." empty states verified live during Phases 26/34 were this bug
      manifesting, not genuinely empty feeds. Verified live: reproduced the write succeeding
      post-fix against the real database with the exact args a real caller uses (no `actorId`).
    - **Real, high-severity security bug found and fixed**: `invitations.service.ts`'s
      `acceptInvitation()` (built and live-verified in Phase 25) calls `setUserRole()`, which
      writes the invitee's OWN `role` field on `users/{uid}` — but `firestore.rules`' self-update
      rule only permits a role-unchanged self-write; any actual role change requires
      `isMasterAdmin()`. Since accept is always invoked by the non-master invitee themselves, this
      write would be rejected by real rule enforcement every time — the invitation would get stuck
      at `status: 'accepted'` (a terminal, non-retryable UI state) while the role silently never
      applied. Phase 25's live verification never caught this because Firestore rules aren't
      enforced against this project's dev-mode database (per `CLAUDE.md`), so the write succeeded
      in testing regardless of what the (unenforced) rules said.
      **Fix**: a new internal-only `invitationRoleGrants/{invitedUid}` collection
      (`lib/collections.ts`) mirrors `{role, expiresAt}` for the current pending invitation, kept
      in lockstep with every `invitations/{code}` mutation (`createInvitation` creates it,
      `cancelInvitation`/`declineInvitation` delete it, `resendInvitation` re-affirms it,
      `acceptInvitation` deletes it *after* the role-write so it can't be replayed). `users/{uid}`'s
      update rule gained one new narrow OR-branch: self-role-elevation is permitted only when a
      still-unexpired grant doc exists for that exact uid+role — unforgeable (only
      `createInvitation`/`resendInvitation`, both master-only, can write one), single-use (deleted
      on consumption), and scoped to exactly the invited role (can't self-grant a different one).
      Firestore rules can't query by field value (only exact-path `get`/`exists`), which is why
      this needed a uid-keyed mirror doc rather than checking the primary `invitations` collection
      (keyed by its random shareable `code`) directly.
      **Also fixed in the same pass**: `invitations/{id}`'s read rule required `isSignedIn()`,
      meaning a genuinely signed-out visitor opening their own invite link (`InvitePage.tsx`'s
      "pending + signed out, prompts sign-in" state) would have had their `getInvitation(code)`
      read rejected by real rule enforcement too — never caught for the same reason (Phase 25's
      live check of that exact state was done from an already-signed-in master-admin session,
      which bypassed the gap via `isMasterAdmin()`). Split `allow read` into `allow get: if true`
      (the code is an unguessable bearer token — a single-doc read by exact code isn't sensitive)
      and `allow list: if isMasterAdmin()` (prevents enumerating the whole collection).
      **Verified live** (logic-level; real rule *enforcement* still can't be tested against this
      dev-mode database, same caveat as every other rules change this session): ran the actual
      service functions against the real database end-to-end — create (confirmed grant doc
      appears with correct role/expiry) → accept (confirmed role actually changes, confirmed grant
      doc is deleted immediately after so it can't be replayed) → decline (confirmed grant
      deleted) → cancel (confirmed grant deleted) → resend after decline (confirmed grant
      re-created with fresh role/expiry). All test invitations, the grant doc, and test
      notifications cleaned up after; test user's role reverted to `VIEWER`.
    - **Real security gap found and fixed**: `storage.rules` gated every write on `request.auth !=
      null` alone — any signed-in account, including a freshly self-registered `VIEWER` with no
      content-management role at all, could `uploadBytes`/`deleteObject` on any path in the bucket,
      bypassing every `canManage()`/`canScore()` gate the equivalent Firestore rules already
      enforce for the same entities. Fixed with per-folder rules: `users/**` (own-avatar uploads,
      `UserSettingsPage.tsx`) stays open to any signed-in user — a plain viewer legitimately needs
      to set their own profile photo — but `players|teams|clubs|tournaments|matches/**` now require
      a content-management-capable role, checked via a `firestore.get()` cross-service lookup on
      the caller's `users/{uid}` profile (Storage Rules v2's documented, GA mechanism for this).
      **Deliberately doesn't replicate per-entity ownership scoping** (e.g. "only this specific
      match's assigned scorer") — that would need a second cross-reference to the entity's own
      `ownerId`/`scorerId`, meaningfully more complex for a marginal additional gain the client UI
      (which already passes `canManage`/`canScore` booleans into `MatchGallery` etc.) already
      covers; role-level gating alone already closes the actual severe gap (an account with zero
      content-management privileges touching media anywhere in the bucket). Not click-tested live
      (Storage rule *enforcement*, like Firestore's, isn't active against this dev-mode project) —
      reviewed the exact cross-service `firestore.get()` syntax against Firebase's documented
      pattern rather than guessing.
    - **Dead code removed** (each independently verified to have zero call sites anywhere in
      `src/`, including lazy imports in `App.tsx` and same-file callers — learning directly from
      `ROADMAP_V2.md` Phase 1's documented false-positive lesson on this exact kind of sweep):
      `RoleGate` (superseded by `ProtectedRoute`), `deleteMatch`, `getStandings`/`sortStandings`,
      `addTeamToTournament`/`removeTeamFromTournament`, `addPlayerToTeam`/`removePlayerFromTeam`,
      `cachePlayerStats`, `BRACKET_STAGES`, `inningsSummaryLine`, `timeAgo`, `pluralize`, plus their
      now-unused imports. **Deliberately kept, not deleted**: `useFeatureFlag`/`isFlagEnabledFor`
      (explicitly documented in `ROADMAP.md` Phase 21 as "prepared architecture for the next
      experimental feature to opt into" — an intentional decision, not accidental dead code);
      `ownsOrMaster`/`canManagePlayers` (small, correct, `CLAUDE.md`-documented ownership/role
      helpers — superseded in practice by list-level `ownerScope()` filtering, which is a
      documentation-staleness finding, not a reason to delete a harmless, potentially-reusable
      utility); `completeMatch`/`abandonMatch`/`setBatters`/`listRecoveryAttempts` (real,
      correctly-implemented admin capabilities — force-complete/abandon a match, correct
      striker/non-striker, review the recovery-attempt audit trail — that simply have no UI button
      yet; deleting working backend logic because its UI wasn't built would make adding that UI
      *harder* later, not easier — flagged as a recommendation instead, see below).
    - **Deduplicated** a byte-identical private `csvCell()` helper copy-pasted verbatim across
      `domain/matchExport.ts`/`playerExport.ts`/`tournamentExport.ts` into one shared export in
      `lib/download.ts`.
    - **Six list pages' delete/archive/import handlers had no try/catch** while their sibling save
      handlers in the same files did (`PlayersPage`, `TeamsPage`, `TournamentsPage`,
      `ClubsSeasonsPage` ×2, `MatchesPage` ×3) — a failed write (permission denied, network blip)
      silently looked identical to a successful one from the user's perspective. Added consistent
      `try/catch` + `toast.error(...)`, matching each file's own existing save-handler pattern.
    - **`notifications.service.ts` fetched a user's entire notification history unbounded** on
      every read (`where('userId','==',uid)` with no `limit()`), unlike every other client-sorted
      list in this codebase (`auditLogs`, `clientErrors`, `recoveryAttempts` all cap the query
      itself). Added a generous `limit(1000)` to bound the read cost. **Not a full fix**: this
      bounds worst-case cost but doesn't guarantee the *newest* N are what's returned when a user
      has more than the cap — a true fix needs `orderBy('createdAt')` alongside the `where()`,
      which needs a composite index this project doesn't ship (`firestore.indexes.json` ships
      empty by deliberate `ROADMAP_V2.md` Phase 1 decision). Flagged as a recommendation (below)
      rather than adding an index unprompted, since that's a real infrastructure/deployment change.
    - **Accessibility**: centralized `id`/`htmlFor` label association in the shared `Field`
      component (`components/ui/primitives.tsx`) via `useId()` + a defensive `cloneElement` onto
      the single child — fixes every form built on `Field` app-wide (Player/Team/Club/Tournament/
      Match-setup forms, login/signup, settings) in one place rather than touching each file.
      Verified live: `document.getElementById(label.getAttribute('for'))` resolves correctly on
      the real login page, and clicking a label genuinely moves focus to its input. Also fixed
      `MatchGallery.tsx`'s delete button being invisible to keyboard focus (`opacity-0` had a
      `group-hover` counterpart but no `focus-visible` one) and its lightbox missing dialog
      semantics + an Escape handler (every other overlay in the app has both, per `Modal.tsx`).
    - **Removed 5 unused dependencies** (`react-hook-form`, `@hookform/resolvers`,
      `@tanstack/react-query`, `zod`, `date-fns`) — confirmed zero imports anywhere in `src/` via
      grep; this app hand-rolls form state (`useState` per field) and data fetching (`useAsync`)
      throughout, so these were never actually adopted. Applied `npm audit fix` (non-`--force`,
      no breaking changes) for two transitive vulnerabilities (`postcss`, `protobufjs`); left
      `react-router`'s flagged advisory alone — it's specifically about RSC-mode CSRF, a mode this
      client-only SPA doesn't use, and the only available fix is a `--force` downgrade labelled
      breaking by `npm` itself, not something to apply blind.
    - **TypeScript strictness**: `tsconfig.app.json` already has `strict: true`; grepped for
      `: any`/`as any`/`Record<string, any>` across all of `src/` and found exactly one file
      (`versionHistory.service.ts`, already reviewed and accepted earlier this session — a
      snapshot/diff utility that's inherently polymorphic across five different entity shapes).
      Nothing further to do here.
    - **Recommendations for after real-world usage** (not implemented — each needs either a
      product decision, an infrastructure change, or real usage data this session doesn't have):
      add UI for the existing-but-unwired `completeMatch`/`abandonMatch`/`setBatters`/
      `listRecoveryAttempts` capabilities described above; add a composite index (`userId`,
      `createdAt`) for `notifications` once real per-user notification volume is known, to get a
      true newest-N guarantee instead of the current generously-capped-but-unordered read; author
      and deploy the CSP/security-headers recommendation from Phase 30 once ready for a real
      production deploy; consider surfacing `useAsync`'s already-tracked (but currently unread
      anywhere) `error` state in the highest-traffic pages if genuine Firestore-read failures turn
      out to be common in practice — currently a failed fetch silently renders as an empty list
      with no visible error, which is low-risk today (Firestore reads rarely fail under normal
      operation) but worth revisiting if it ever isn't.
    - `tsc`/`npm run build`/lint all clean throughout.

37. **`ROADMAP_V3.md` Phase 2 Slice 2.3 — Team roster invitations** — **Done**, no collision. New
    `TeamInvitation` type + `teamInvitations.service.ts`, deliberately a fully separate collection
    from the existing role-granting `Invitation` — this touches the same class of security-sensitive
    write paths (`players`/`teams` rules) the concurrent session's entry #35 just found and fixed a
    real bug in, so isolating the new feature avoids any risk to that now-verified role-grant flow.
    `TeamInviteModal.tsx` (username lookup via Slice 2.1's `getPublicProfile()`, reused rather than
    duplicated) wired into `TeamsPage.tsx` as a new per-team-card "Invite a player" button;
    `/team-invite/:code` (`TeamInvitePage.tsx`) mirrors `InvitePage.tsx`'s layout for the
    accept/decline UI.
    - **Design problem this slice had to solve**: `Player.teamIds` and `Team.playerIds` are two
      independently-maintained denormalized arrays in this codebase (confirmed by reading
      `PlayerFormModal.tsx`/`TeamFormModal.tsx` — neither form updates the other entity's array;
      `dataIntegrity.ts`'s `orphaned_roster_entry` check exists precisely because they can drift).
      `acceptTeamInvitation()` writes both: reuses the invitee's existing linked player (matched by
      `linkedUserId`) if they have one, appending the new team's id to its `teamIds`; otherwise
      creates a fresh `Player` (`linkedUserId` set to the invitee, `ownerId` set to the *team's*
      actual owner, not the invitee) and adds its id to the team's `playerIds`.
    - **The harder problem**: a VIEWER accepting their own invite has neither `canManage()` nor team
      ownership, so unmodified `firestore.rules` would block every write the accept flow needs.
      Solved with the same grant-doc pattern the concurrent session's entry #35 just added for role
      invitations (`invitationRoleGrants`) — a new `teamInvitationGrants/{invitedUid}` doc records
      `{teamId, expiresAt}` and is the only thing that authorizes the invitee's own narrow exception:
      `players` create is scoped to `linkedUserId == self`, the exact granted team, and —
      closing a hole the naive version would have had — `ownerId` must equal *the real team's
      actual owner* (checked via a nested `get()`), not a value the invitee could pick themselves to
      permanently "own" their own player doc outside the accept flow; `players` update may only
      touch `teamIds` (`affectedKeys().hasOnly(['teamIds','updatedAt'])`) and only add the one
      granted team id; `teams` update may only touch `playerIds` and only add exactly one id. Every
      exception closes the moment the grant doc is deleted (on accept/decline/cancel).
    - `tsc`/`npm run build` clean. **Not click-tested live, flagged as needing real verification
      before production**: exercising this needs two authenticated roles simultaneously (a team
      owner/manager to invite, a separate signed-in invitee to accept) and this session's browser
      has credentials for neither. The new `firestore.rules` blocks were manually re-read line by
      line for brace/logic consistency, but this environment has **no Firebase CLI installed**
      (`npx firebase --version` fails — confirmed, not assumed) so they could not be run through the
      rules linter or emulator. Given entry #35 just demonstrated that a rules bug can sit invisible
      in this project's non-rule-enforcing dev database indefinitely, **recommend validating these
      specific rules against a real emulator or staging deploy before relying on them in
      production** — the same "author locally, verify against a real deploy" caveat already applied
      to the CSP recommendation in `ROADMAP.md` Phase 30.
38. **`ROADMAP_V3.md` Phase 2 Slice 2.4 — Match comments** — **Done**, no collision. New
    `MatchComment` type + `comments.service.ts`, a `comments` collection scoped by `matchId`.
    Public read; signed-in create (500-char cap, enforced in both the service and
    `firestore.rules`); delete by the comment's own author or the master admin — no edit, kept
    simple on purpose. New `CommentSection.tsx` wired into the public `MatchPage.tsx` right after
    the photo gallery. `tsc`/`npm run build` clean. **Verified live against the real database** for
    the only path testable without credentials (signed-out read): loaded a real completed match
    page, confirmed the section renders its sign-in prompt and empty state correctly with no
    console errors. The signed-in post/delete path verified by code review + `tsc` only — same
    master-admin-auth-loss caveat as recent phases; lower risk than Slice 2.3's rules changes since
    this collection's rules are simple field/length checks with no cross-document `get()` lookups.
39. **`ROADMAP_V3.md` Phase 2 Slice 2.5 — Match reactions** — **Done**, no collision on the feature
    itself. Four fixed emoji reactions (🔥 👏 😮 💔) as a new `matches/{id}/reactions/{uid}`
    subcollection (matches the existing `deliveries`/`ballMeta` convention rather than a top-level
    composite-id collection); aggregate counts computed client-side from the per-match list, no
    separate counter docs. `firestore.rules` for it is simple — doc id and `userId` must both equal
    the writer's own uid, no cross-document `get()` needed (much lower risk than Slice 2.3's
    grant-doc design). **Hit the same class of silent concurrent-edit race documented in entry #24,
    this time on `MatchPage.tsx`**: the first attempt to wire in the import + `<MatchReactions>`
    usage was overwritten with no error on either side; caught only because the now-standing
    practice (grep the hot shared file for the new symbol immediately after editing, not just after
    `tsc`) came up empty right after a clean `tsc` pass. Re-applied against the then-current file,
    re-verified via grep immediately, and confirmed the prior slices' `ShareButton`/
    `CommentSection`/`MatchGallery` wiring survived the same overwrite untouched. `tsc`/`npm run
    build` clean after the fix. **Verified live against the real database**: loaded a real
    completed match page, confirmed all four reaction buttons render and are correctly disabled
    (with a sign-in tooltip) for a signed-out visitor, no console errors. The signed-in toggle path
    verified by code review + `tsc` only — same master-admin-auth-loss caveat as recent phases.
40. **`ROADMAP_V3.md` Phase 3 Slice 3.1 — QR codes** — **Done**, no collision. Added the `qrcode`
    npm dependency rather than hand-rolling an encoder — verified `npx firebase --version` isn't
    the relevant check here, but confirmed npm registry access works and installed cleanly (`npm
    install qrcode` + `@types/qrcode`); `npm audit` after install showed the same pre-existing
    `react-router` RSC-CSRF advisory the concurrent session already reviewed and left alone
    (entry #35/#36's audit) — nothing new introduced by this package. New `QRCodeButton.tsx`
    (icon button → modal with a client-generated PNG, no network call, plus a download link),
    added next to `ShareButton` on all seven public entity pages. `tsc`/`npm run build` clean; the
    dependency added ~25kB to the shared vendor chunk. **Verified live against the real database,
    the strongest verification level used this pass**: clicked the actual button on a real
    completed match page and confirmed a genuine `data:image/png;base64,...` URI came back with a
    valid PNG header — proof the encoding itself works end-to-end in a real browser, not just that
    a placeholder rendered. No console errors.

41. **Match Setup Wizard restructure + configurable Match Rules step** — user-requested (not a
    `ROADMAP_V3.md` item), explicit constraint: "Preserve backward compatibility with all existing
    matches and the verified scoring engine. Do not modify scoring logic beyond reading these
    configuration values." **Done**, no collision on the feature's own files, though its work
    ended up bundled into commit `20bd7f2` alongside the concurrent session's Match Reactions work
    — both were uncommitted in the shared working tree when a broad commit was made; confirmed via
    `git show 20bd7f2 -- <file>` that every file this slice touched matches this slice's intended
    content exactly, byte-for-byte, so nothing was lost or altered by the bundling.
    - `MatchSetupPage.tsx` is now a 6-step wizard (Details → Teams → Playing XI → Toss → **Match
      Rules** → Review), following the user's own suggested step order (which places Match Rules
      *after* Toss — the wizard's explicit list was trusted over a looser prose description
      earlier in the same request that could be read either way).
    - **"Number of wickets" and "Last Man Standing" made independently configurable without
      touching `scoring.ts`**: the engine already takes `battingSquadSize` as a passed-in number
      (`ApplyBallOpts.battingSquadSize`, with `allOut = wickets >= battingSquadSize - 1`) rather
      than deriving it internally from squad length. Added `effectiveSquadSize()` in
      `scoring.service.ts` — `maxWickets != null ? maxWickets + 1 : squadFor(...).length`, plus
      `+1` again when `lastManStanding` is set — and wired it into both `optsFor()` (feeds the
      live engine) and `computeResult()`'s "won by N wickets" margin calculation (previously used
      literal squad length directly; now consistent with the configured rule). Old matches with
      neither field set reproduce the exact literal-squad-length behaviour.
    - **Powerplay**: new pure `domain/matchRules.ts` (`computeAutoPowerplayOvers`,
      `defaultMaxWickets`) implements the user's exact stated convention (5→1, 6–10→2, 11–20→6,
      beyond 20 uses the tournament's configured default, else falls back to 10) for the wizard's
      Auto mode. This is deliberately separate from `domain/insights.ts`'s existing
      `powerplayOverCount()` (a per-*format* heuristic used only for post-match analytics display)
      — that function was extended, not replaced, to prefer the new explicit `Match.powerplayOvers`
      when set, falling back to its original heuristic for historical matches that predate this
      field. Verified the new pure functions with a standalone Node check against the user's exact
      example inputs (5/6/10/11/20/50 overs, with and without a tournament default) — all matched.
    - **Retired hurt**: `WicketType`'s `retired_hurt` was already engine-recognised and already
      excluded from `wicketCountsAsDismissal`/`isCountedWicket` — so "Retired Hurt enabled/disabled"
      is purely a scorer-facing UI toggle (`WicketModal` now takes `retiredHurtEnabled` and filters
      it out of the wicket-type dropdown when false); no engine change needed or made.
    - **Duckworth-Lewis, Follow-On, Super Over**: see §4 for the omission/scoping reasoning per the
      user's own conditional instructions.
    - `Tournament` gained optional `defaultTeamSize`/`defaultMaxWickets`/`defaultPowerplayOvers`,
      editable in a new "Match rule defaults" section of `TournamentFormModal`; selecting a
      tournament in the wizard pre-fills the Match Rules step from these once, at selection time
      (same one-shot-prefill pattern as `chooseTeam`'s squad prefill), remaining fully editable
      after. All new `Match`/`Tournament` fields are optional; `pruneUndefined()` already strips
      undefined values so no Firestore write path needed changes.
    - `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `npm run lint` all clean throughout.
    - **Verified live against the real database**: created real throwaway test players ("MSW Test
      P1"–"P4"), two teams ("MSW Test Team A"/"B"), and a tournament ("MSW Test Tournament") with
      `defaultTeamSize=8`/`defaultMaxWickets=7`/`defaultPowerplayOvers=3` configured — confirmed via
      the browser's DOM (`input.value`, not just the accessible-name placeholder text, which looks
      identical to a placeholder in the a11y tree) that all three defaults round-tripped through
      Firestore correctly on reopening the edit modal. **Did not reach the wizard's own Match Rules
      step live**: the authenticated browser session was lost when the dev server had to be
      restarted mid-verification, and per the standing safety rule (entry documented earlier: "self
      -registering a new account... to work around this was correctly not attempted"), no new
      throwaway login was created to re-establish it — the user was asked for test credentials but,
      per the assistant's own prohibited-actions list, entering a password into the login form is
      not something the assistant can do even when a user supplies and authorizes it, so that path
      was also correctly declined. The wizard's step logic (validation gating, the auto/manual
      powerplay toggle, tournament-selection prefill, the Review step's rule badges, and the
      `submit()` payload) was instead verified by a careful full re-read of the final file plus the
      Node check above — not a live click-through.
    - **Leftover test data not yet cleaned up** (blocked by the same lost-session issue): the four
      test players, two test teams, and one test tournament named above are still live in the
      database and should be deleted (by the user, or by a future session once a working
      authenticated preview is available).
42. **`ROADMAP_V3.md` Phase 3 Slice 3.2 — Embeddable widgets** — **Done**, no collision. Two new
    chrome-free routes mounted at the top level of `App.tsx` (sibling to `/login`, not nested under
    `PublicLayout`, so neither gets the header/nav/footer): `/embed/match/:id`
    (`EmbedMatchPage.tsx`, a small self-contained score summary — deliberately not reusing
    `MatchPage`'s private `LivePanel`, which assumes chrome this page doesn't have) and
    `/embed/scorecard/:id` (`EmbedScorecardPage.tsx`, reuses the real `ScorecardView` directly so
    it can't drift from what the full site shows). New `EmbedButton.tsx` on the match page only
    (embeds are match-specific, unlike sharing/QR which apply to every entity type). `tsc`/`npm run
    build` clean. **Verified live against the real database**: loaded both embed routes directly
    for a real completed match, confirmed genuinely chrome-free rendering (`<body>` as the content
    root, not `<main>` — proof `PublicLayout` didn't leak in) with correct content and no console
    errors on either; opened the real embed-code modal from the match page and confirmed both
    `<iframe>` snippets contain the actual match id and origin, not placeholder text.
43. **`ROADMAP_V3.md` Phase 4 Slice 4.1 — Sponsor showcase** — **Done**, no collision. New
    `Sponsor`/`SponsorTier` types, `Tournament.sponsors?: Sponsor[]` (optional — no migration
    needed, matches the additive-optional-fields convention already used for every schema change
    this session). Admin editor in `TournamentFormModal.tsx` (add/remove list, reuses the existing
    `ImageUploadField` for logos); public display is a tier-sorted logo strip on `TournamentPage.tsx`
    that renders nothing at all when there are no sponsors, not an empty section. `tsc`/`npm run
    build` clean. **Verified live against the real database** for the one thing testable without an
    admin credential: loaded a real tournament with no `sponsors` field at all (every tournament in
    this dev database predates the field) and confirmed no crash, no console errors — the actual
    "legacy doc" case, not a hypothetical. The admin editor and populated-display path verified by
    code review + `tsc` only — same master-admin-auth-loss caveat as recent phases.
44. **`ROADMAP_V3.md` Phase 4 Slice 4.2 — Tournament photo galleries** — **Done**, no collision.
    Extracted `MatchGallery.tsx` into a generic `EntityGallery.tsx` (folder/title/canManage/
    emptyLabel/`hideWhenEmpty` props); `MatchGallery` is now a thin wrapper, zero behavior change.
    Wired a second usage onto `TournamentPage.tsx` as a new "Gallery" tab, using the new
    `hideWhenEmpty={false}` option to show a normal "No photos yet." state (matching the existing
    Activity tab's convention) instead of vanishing, since a dedicated tab is a different context
    than a card sitting in a page's default scroll. **Corrected a wrong assumption in this file's
    own earlier text**: the original slice plan said this would "fix the tracked-folder gap in
    `MediaLibraryPage.tsx` (tournaments folder isn't listed there today)" — checking the actual
    file found `tournaments` already IS tracked there. The real gap is that `MediaLibraryPage`
    tracks flat one-image-per-entity-type folders and has no browsing support for the per-entity-id
    *nested* gallery folders (`matches/{id}/`, now also `tournaments/{id}/`) — a structurally
    different, N+1-read feature, not a one-line fix. Left as a documented scope boundary.
    **Auth recovered mid-slice**: this browser session's dev-server preview is now signed in as an
    admin/scorer — the master-admin-auth-loss caveat repeated across dozens of prior entries no
    longer applies going forward. Verified live with the real session: clicked the actual "Gallery"
    tab on a real tournament, confirmed the admin "Add photos" control and the correct
    loading→"No photos yet" transition, no console errors; regression-checked `MatchGallery`
    post-refactor on a real match page (unchanged). **Attempted a real file upload** via a
    synthetic canvas-generated PNG dispatched to the hidden file input, to prove the write path —
    the technique itself didn't register with React's file-input handling (confirmed via
    `read_network_requests`: zero Storage requests fired, meaning the synthetic event never reached
    React's `onChange`), a known limitation of simulating `<input type="file">` via raw DOM events,
    not an app bug. Not pursued further — the upload/delete logic is unchanged from `MatchGallery`,
    already verified end-to-end when it originally shipped (`ROADMAP.md` Phase 12).
45. **`ROADMAP_V3.md` Phase 4 Slice 4.3 — Announcements** — **Done**. New `Announcement` type,
    `announcements.service.ts` (`listAnnouncements`/`createAnnouncement`/`togglePin`/
    `deleteAnnouncement`), a new `announcements` collection scoped by `tournamentId`. Its
    `ownerId` is copied from the tournament's own `ownerId` at creation time, so `firestore.rules`
    reuses the exact same `isOwnerOrMaster(resource.data.ownerId)` shape every other owner-scoped
    entity already uses — no cross-document `get()` needed, a simpler design than Slice 2.3's
    grant-doc pattern since there's no invitee-side exception to carve out here. New
    `AnnouncementsPanel.tsx`, wired into `TournamentPage.tsx` as a new "Announcements" tab: admins
    get create/pin/delete, everyone gets a pinned-first read-only list. **Deliberately dropped
    "optionally notifying followers on post"** from the original plan text — `favStore` is
    localStorage-only (Slice 2.2's own decision), so there is no server-side follower list for any
    tournament to notify in the first place; this was an aspirational phrase written before that
    scope decision existed, not a real capability skipped. **Collision note**: the concurrent
    session found these files sitting uncommitted on disk mid-pass and wrote its own `ROADMAP_V3.md`
    entry describing them as "found already implemented" (the mirror image of how this session has
    itself described the other session's uncommitted work several times, e.g. entries #23/#25) —
    no actual duplication, confirmed via `git status` that only one copy of each file exists.
    `tsc`/`npm run build` clean. **Verified live with a real authenticated admin session, a full
    create→pin→delete round trip against the real database** — went further than the concurrent
    session's code-read-only verification of the same feature: posted a genuine test announcement
    through the actual form, confirmed the live "Announcement posted" toast; toggled the real Pin
    button (confirmed it flipped to Unpin); deleted it via the real Delete button and confirmed the
    page correctly settled back to "No announcements yet." No console errors at any step; test data
    fully cleaned up afterward.
46. **`ROADMAP_V3.md` Phase 4 Slice 4.4 — Downloads** — **Done**, no collision. `storage.service.ts`
    gained `uploadDocument`/`listFolderDocuments`/`deleteUploadedDocument` (PDF-only, 10MB cap) for
    a new `tournamentDocuments/{id}` folder, plus a genuinely separate `storage.rules` block
    (`isValidDocument()`) — a PDF uploaded under the existing `tournaments/{allPaths=**}` path
    would have been rejected by that rule's image-only `isValidImage()` check, so this needed its
    own top-level path, not just a new content-type branch on the existing one. New
    `DownloadsPanel.tsx` as a new "Downloads" tab on `TournamentPage.tsx`. Same documented scope
    boundary as Slice 4.2: this per-tournament-id nested folder isn't covered by
    `MediaLibraryPage.tsx`'s flat-folder model either. `tsc`/`npm run build` clean. **Verified live
    with a real authenticated admin session**: the Downloads tab renders the admin upload control
    and resolves correctly from "Loading…" to "No documents yet.", no console errors. **Attempted a
    real PDF upload** (minimal valid PDF bytes into the hidden file input) — hit the same known,
    already-documented limitation as entry #44's photo-upload attempt (synthetic `<input
    type="file">` selection doesn't register with React's controlled `onChange`; confirmed via
    `read_network_requests` that zero Storage requests fired). Not a new risk: the upload/list/
    delete logic mirrors the already-verified `EntityGallery` pattern for a different content type.
47. **`ROADMAP_V3.md` Phase 4 Slice 4.5 — Calendar + fixture/standings sharing** — **Done**, no
    collision. Per-match "Add to calendar" was already shipped by the concurrent session
    (`domain/calendarExport.ts`'s `matchToICS`, `AddToCalendarButton.tsx` on `MatchPage.tsx`) before
    this slice started — confirmed by reading both files rather than assumed, and not duplicated.
    Built the two remaining pieces: (1) new `FixturesCalendar.tsx`, a real month-grid with prev/
    next navigation (not a placeholder), added as a List/Calendar toggle on the tournament's
    "Fixtures & Results" tab, List staying the default so existing behavior is unchanged; (2) a
    tournament-wide "Download calendar" button using a new `matchesToICS()` added to
    `calendarExport.ts` (multi-`VEVENT` file, reuses the existing file's private helpers rather than
    duplicating them); (3) a "Copy standings" button generating a compact plain-text summary via
    `navigator.clipboard`, independent of the existing full CSV/JSON tournament export — for
    pasting into a chat/social post, not a data file. `tsc`/`npm run build` clean. **Verified live
    against the real database**: captured the actual clipboard payload from "Copy standings"
    (`navigator.clipboard.writeText` stubbed to intercept) and confirmed genuine, correctly
    formatted data (real team names, points, NRR to 3 decimals), not placeholder text; switched to
    Calendar view and confirmed the real `seedRSvTK1` match rendered on its correct real-world date
    (July 1, 2026); clicked "Download calendar" with no error; clicked month navigation and
    confirmed it correctly advanced July → August 2026. No console errors throughout. **This closes
    out `ROADMAP_V3.md` Phase 4 (Tournament Ecosystem) — all 5 slices done.**
48. **`ROADMAP_V3.md` Phase 5 — Final polish pass** — **Done**, no collision. **SEO**: new
    `hooks/useDocumentMeta.ts` sets a per-route `document.title`/meta description, wired into all
    seven public entity pages with real, specific descriptions (not generic placeholders) — honest
    about the real limitation that a non-JS-executing crawler won't see any of this (client-only
    Vite SPA, no SSR), same convention as this project's other environment-dependent features.
    Static `public/robots.txt`/`sitemap.xml` added, sitemap deliberately scoped to only the static
    routes since dynamic entity pages can't be enumerated without a build-time data fetch this app
    doesn't have — its placeholder domain needs replacing before a real deploy (sitemap URLs must
    be absolute; this project has no fixed production domain configured anywhere to pull one from).
    **Accessibility**: audited every new interactive component from this whole milestone
    (icon-button `onClick` vs. `aria-label` counts) and found two real, fixed gaps —
    `MatchReactions.tsx`'s emoji-tap buttons had no accessible name beyond the bare emoji character
    (added `aria-label` + `aria-pressed`), `EmbedButton.tsx`'s two embed-code textareas had no
    programmatic label (added `aria-label`s). **UI consistency**: confirmed `ShareButton`/
    `QRCodeButton`/`EmbedButton`/the concurrent session's `AddToCalendarButton` independently
    converged on the same `h-9 w-9` icon-button style — nothing to fix. **Docs**: `README.md`
    feature list + architecture comment updated; `CONTRIBUTING.md`'s roadmap-update convention note
    was stale (missing this file) — fixed. `tsc`/`npm run build` clean throughout. **Verified live
    against the real database**: confirmed real per-route titles/descriptions on Match and
    Tournament pages (not placeholder text — actual team names, actual result summary, actual
    tournament format), confirmed `robots.txt` serves correctly, confirmed the restructured
    Fixtures "List" view (touched during Slice 4.5's ternary edit) still renders real match data
    correctly with no console errors. **This closes out `ROADMAP_V3.md` in full — all 5 phases, 15
    slices done.**

49. **`ROADMAP_V4.md` Slice 2.1a — Last-man-stranded detection + guided innings closure** —
    **Done**, no collision (`ROADMAP_V3.md` confirmed complete/merged/verified before this started;
    `ScoringPage.tsx` was never in V3's scope in the first place). **A planning-time correction is
    worth restating here since it affects how "Last Man Standing" should be described going
    forward**: `Match.lastManStanding` (added earlier this session, entry #41) widens the all-out
    wicket threshold, but does **not**, and per the standing restriction on `src/domain/scoring.ts`
    **cannot**, enable actual solo batting — `applyBall` hard-throws
    (`'Striker, non-striker and bowler must be set before scoring.'`) if `nonStrikerId` is null,
    confirmed by direct re-read of the engine, not assumed. `ROADMAP_V4.md`'s own planning pass
    originally proposed a fix that would have hit this exact throw; caught and corrected before any
    code was written. This slice instead detects the genuine "no eligible replacement batter
    remains" state (`lastManStranded` in `ScoringPage.tsx`, computed from the already-existing
    `incomingOptions`) and replaces the previously-generic, dead-end "No eligible players"
    `PlayerPickModal` with a specific message plus a direct "End innings" action — reusing the
    existing, unmodified `endInnings()` service call, which has no striker/non-striker precondition.
    The normal score pad is also hidden in this state (added a matching exclusion) so there's no
    way to attempt further scoring once stranded. Zero lines of `scoring.ts` touched or needed.
    `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the
    real database**: created a real throwaway 2-a-side match (`maxWickets: 1`,
    `lastManStanding: true` — the smallest squad that reaches the true stranded state after exactly
    one wicket) via the actual Match Setup Wizard, started it, and recorded a real wicket through
    the actual `WicketModal`. Confirmed the generic empty-picker never appeared, the new guided
    message rendered with the score pad correctly hidden, and clicking through to "End innings"
    correctly invoked `endInnings()`, transitioned to `innings_break`, and the second innings
    started normally chasing the right target — completed the match end-to-end (won by 2 wickets,
    which also re-confirms the `effectiveSquadSize` LMS margin math from entry #41 is still correct)
    rather than stopping at the fix's own boundary. The regression case (LMS disabled, or a normal
    9th-wicket-down state with an eligible replacement) relies on the engine's unchanged
    `evaluateInningsEnd`/`needBatter` logic — confirmed by diff review that no non-LMS code path was
    touched, not re-verified with a second live match, to keep throwaway test data minimal. **Known
    gap**: the test match ("LMS Stranded Test") could not be deleted through this browser automation
    session — the delete action also depends on a native `confirm()` dialog that didn't reliably
    click through a second time — it remains in the database and needs manual deletion.

50. **`ROADMAP_V4.md` Slice 2.2 — Abandon match control + reopen safety net** — **Done**. No
    *content* collision, but the code landed in git differently than planned: before this session
    could commit it, a concurrent session swept both touched files (`ScoringPage.tsx`,
    `scoring.service.ts`) into its own unrelated commit `5d19dca` ("Update scoring page and
    service") — the same broad-`git add`-sweeps-uncommitted-work pattern already documented for
    the Match Settings slice earlier this session. Diffed `5d19dca` against this slice's intended
    changes and confirmed byte-for-byte identical — nothing lost, altered, or merged with anything
    else; only the commit message fails to describe this slice's actual content. Documenting this
    here rather than re-committing, since the code is already correctly in history.
    `abandonMatch()` had been fully implemented but genuinely unreachable from any UI
    (confirmed by grep, zero call sites, per entry #49's own audit methodology) — wired up as a
    red/danger-styled "Abandon match" button on `ScoringPage.tsx`'s live footer, confirmation-gated
    identically to the existing "End innings" button. **New `reopenMatch()`** in
    `scoring.service.ts` closes the "one-way door" risk this slice's own planning pass flagged:
    guards `if (match.status !== 'abandoned') throw` (defense in depth — the calling UI already
    only renders the button in that state), then writes exactly the same
    `{ status: 'live', result: null, completedAt: null }` shape `undoLastBall()` already writes for
    its own "reopen a closed state" case — no novel data shape, no schema change, no existing
    function's signature touched. `abandonMatch()` itself was not modified. Zero lines of
    `scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean.
    **Verified live against the real database, full cycle, not just the happy path**: created a
    real throwaway match ("Abandon Reopen Test"), scored a real ball to establish genuine
    in-progress state (4/0, specific striker/non-striker/bowler/partnership), then abandoned it
    (confirmed the resulting screen shows a "Reopen match" button), reopened it (confirmed the
    innings state — striker, non-striker, bowler, partnership, current-over ball token — was
    restored *exactly*, proving `abandonMatch`/`reopenMatch` never touch deliveries or innings),
    then abandoned it a second time from the reopened state (confirmed the full cycle repeats
    cleanly). **Also verified the negative case, which matters more than the happy path here**:
    navigated to a separate match that completed normally (from entry #49's own test data) and
    confirmed its completed screen shows **no** "Reopen match" button at all — a real scored result
    cannot be reversed through this control. Both throwaway matches from this slice and the
    previous one were successfully soft-deleted after verification — no leftover test-data cleanup
    gap this time.

51. **`ROADMAP_V4.md` Slice 2.3 — Player of the Match at end-of-match** — **Done**, no collision.
    Used the plan's preferred approach exactly: reused the existing `PlayerPickModal` component
    (already used by `ScoringPage.tsx` for the batter/bowler pickers) instead of building a new
    modal, mapping `[...match.squadA, ...match.squadB]` through the file's existing
    `playerOption()` helper and prepending a synthetic `{id: '', name: 'No award / clear'}` entry
    for un-picking. `setPlayerOfTheMatch()`'s parameter widened from `playerId: string` to
    `playerId: string | null` — this is a backward-compatible widening (any caller passing a
    `string`, including the existing `MatchPage.tsx` call site, remains valid unchanged); confirmed
    `MatchPage.tsx` needed zero edits. The button on `ScoringPage.tsx`'s completed screen is gated
    to `match.status === 'completed'` only, matching `MatchPage.tsx`'s own existing gate (never
    shown for an abandoned match). Zero lines of `scoring.ts` or `MatchPage.tsx` touched. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
    database, full cycle**: created a real throwaway match, force-completed both innings via "End
    innings" (fastest path to a genuine `completed` match), picked a real player as Player of the
    Match from `ScoringPage.tsx`, confirmed the button label updated and the same name appeared on
    the public `/match/:id` scorecard's "Player of the match" section, then cleared it via "No
    award / clear" and confirmed the button reverted to unset. Test match soft-deleted after
    verification — no leftover data.

52. **`ROADMAP_V4.md` Slice 3.1 — Innings-break scorecard link** — **Done**, no collision. Smallest
    slice in the plan: the `innings_break` lifecycle screen (`ScoringPage.tsx`) gained a
    `Button variant="outline"` "Scorecard" action alongside its existing "Start 2nd innings"
    primary button — matched to that screen's centered-card button-row layout (same pattern as the
    completed screen's "View scorecard"/"Update stats" row) rather than the live-scoring footer's
    pill-`Link` style, since this screen isn't the footer bar. No new component, no service change.
    `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the
    real database**: created a real throwaway match, force-ended the first innings via "End
    innings" to reach a genuine `innings_break` state, confirmed the new button renders, clicked
    it, and confirmed it lands on `/match/:id` showing the just-completed first innings correctly.
    Test match soft-deleted after verification.

53. **`ROADMAP_V4.md` Slice 4.2a — Mobile scorer experience audit** — **Done**, read-only, no code
    changed, so no `CHANGELOG.md` entry (nothing shipped to describe). `ROADMAP_V3` Slice 1.2's own
    375px audit explicitly scoped itself to spectator surfaces only; `ScoringPage.tsx`/
    `ScoringModals.tsx` — the screen a scorer actually uses pitchside on a phone — had never been
    checked. Audited live at a real 375×812 viewport against a real throwaway match (not a static
    JSX read): walked `PreMatch` → `OpenersPanel` → live scoring (real balls scored, a full over
    completed to reach the bowler-change prompt) → `WicketModal` in its `run_out` state (the
    widest configuration — adds a fielder select and a runs-completed row) → the bowler-selection
    `PlayerPickModal` → `ShortcutsHelpModal`, measuring via `document.body.scrollWidth` vs
    `window.innerWidth` and `getBoundingClientRect()`, the same technique Slice 1.2 used after
    finding screenshot tooling unreliable. **Result: zero page-level horizontal overflow anywhere**
    in the flow, including `WicketModal`'s `run_out` state with its "Confirm wicket" button
    staying visible without scrolling, and the "This over" ball-token strip's `overflow-x: auto`
    correctly scoping to itself rather than pushing the page wider (same pattern already proven on
    the tournament tab bar). Tap targets are comfortably sized almost everywhere (`ScorePad`'s run
    buttons 96×64, extras 71×44, Wicket/Undo 151×48, footer actions 87–124×54, `PlayerPickModal`
    options 335×54); `OpenersPanel`'s selects/button measured 37–40px, a shade under the 44px ideal
    but matching this app's existing baseline elsewhere, not a new regression. **One genuine
    finding**: the "Keyboard shortcuts" trigger button is 84×24 (under the 44px guideline) and,
    more fundamentally, opens a modal of keyboard shortcuts that are unusable on a touch-only
    device with no physical keyboard. Scoped into a fully-specified Slice 4.2b (hide the button on
    `pointer: coarse` devices via `matchMedia`, leave the actual `keydown` handling untouched for
    any device with an attached physical keyboard) — not fixed in this pass, per the read-only
    scope of 4.2a.

54. **`ROADMAP_V4.md` Slice 4.2b — Mobile scorer fixes (hide Shortcuts button on touch devices)** —
    **Done**, no collision. Fixed exactly the one finding 4.2a scoped: added a one-time
    `useState(() => matchMedia('(pointer: coarse)').matches)` check in `ScoringPage.tsx` (mirrors
    this codebase's existing synchronous, non-live-updating `matchMedia` usage in
    `src/store/prefsStore.ts`) and passed `ScorePad`'s `onShowShortcuts` prop as `undefined` when
    `touchPrimary` is true — `ScorePad` already only renders the button `{onShowShortcuts && (...)}`,
    so its own definition needed zero changes; only the call site became conditional.
    `ScoringShortcuts`'s `keydown` listener itself was not touched in any way. Zero lines of
    `scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean (same
    pre-existing, unrelated `ScoreHeader` lint warning, predating this session). **Testing note**:
    the Browser pane's 375×812 "mobile" viewport preset changes only viewport *dimensions* — it does
    not set `matchMedia('(pointer: coarse)').matches` to `true` (confirmed directly, not assumed).
    Verified correctly instead by overriding `window.matchMedia` for that query and re-entering
    `ScoringPage` via `history.pushState` + a dispatched `popstate` event (this project's own
    documented SPA-testing technique, per `CLAUDE.md` — not a hard reload, which would have reset
    the override) so the `useState` initializer re-ran with the override active. **Verified live
    against the real database**: confirmed the Shortcuts button renders by default (`pointer: coarse`
    false, matching 4.2a's own measurement); confirmed it is absent once `pointer: coarse` is forced
    true; and, proving the "don't touch the keydown handling" requirement specifically, dispatched a
    real `keydown` event for `'1'` while the button was hidden and confirmed the score updated (0/0
    → 1/0) exactly as it would with the button visible. Test match cleaned up after verification.

55. **`ROADMAP_V4.md` Slice 1.4 — Toss re-confirmation at match start** — **Done**, no collision.
    Added an "Edit" toggle to the toss line on `ScoringPage.tsx`'s pre-match (`PreMatch`) screen,
    duplicating (not extracting) the same two-row team/bat-or-bowl picker UI already used by
    `MatchSetupPage.tsx`'s Toss step, per the plan's stated preference for small independent copies
    over a shared component here. Saving calls a new `editToss()` handler that writes **both**
    `toss` and a freshly re-derived `battingFirstTeamId` via the existing `updateMatch()`
    (`matches.service.ts`) — re-reading `MatchSetupPage.tsx`'s creation-time logic confirmed
    `battingFirstTeamId` is always explicitly stored at creation (not left for `toss` to drive
    alone), so `battingFirstTeamId(match)`'s preference for the stored field over recomputing from
    `toss` meant both fields had to be written together for an edited toss to actually take effect,
    not just display differently. No existing function's signature changed; `PreMatch`'s `onStart`
    and every live-scoring code path untouched. Zero lines of `scoring.ts` touched. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing, unrelated
    `ScoreHeader` lint warning). **Verified live against the real database with a genuine flip, not
    just a round-trip**: a first throwaway match ("Toss Edit Test") whose edit produced the same
    batting-first team as the original proved the `toss` field write path but left open whether
    `battingFirstTeamId` had actually been recomputed or was just coincidentally already correct; a
    second throwaway match ("Toss Edit Test 2") closed that gap by editing from "Team A win, bowl →
    Team B bats first" to "Team A win, bat → Team A bats first" — a genuine flip — and confirmed
    both the `PreMatch` summary and, after starting the match, the live `ScoreHeader` itself showed
    Team A (not Team B) batting, conclusively proving the edited toss drove the real first innings.
    Both throwaway matches deleted via the Matches page after verification.

56. **`ROADMAP_V4.md` Slice 2.4 — Auto-recompute stats/standings on completion** — **Done**, no
    collision. Added a private `autoRecomputeStats(match)` helper to `scoring.service.ts`, importing
    `recomputeAllStats`/`recomputeTournamentStandings` from `stats.service.ts` (confirmed no
    circular-import risk by reading `stats.service.ts`'s own imports first — it does not import
    `scoring.service.ts`). Both calls are fire-and-forget with `.catch(e => console.error(...))`,
    mirroring the file's existing `notifyMatchDone` error-swallowing convention exactly, so a slow or
    failed recompute can never block or break the scorer's completion flow. Wired into **exactly**
    the two places `status` flips to `'completed'` today — `recordBall()`'s and `endInnings()`'s
    completion branches, confirmed by grep to be the only two live paths (`completeMatch()` remains
    confirmed dead code, zero call sites, untouched). `abandonMatch()` was not touched in any way, so
    it categorically cannot trigger a recompute — satisfies the "abandoning must not auto-recompute"
    requirement by construction, not by an added guard. Zero lines of `scoring.ts` touched. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing, unrelated
    `ScoreHeader` lint warning). **Verified live against the real database, both completion paths,
    with before/after Stats-page snapshots** (not just absence of console errors): baseline was 130
    runs scored platform-wide, J Bumrah at 2 innings/10 runs. A throwaway 1-over match ("Auto
    Recompute Test A") completed its second innings **naturally via a scored ball** chasing a 1-run
    target — hitting `recordBall()`'s completion branch specifically — and without any manual
    "Update stats" click, the Stats page immediately showed 131 runs and J Bumrah at 3 innings/11
    runs. A second throwaway match ("Auto Recompute Test B") was completed by tapping "End innings"
    on the second innings directly — hitting `endInnings()`'s completion branch specifically (a
    declared/tied finish, no balls scored) — and the Teams leaderboard picked up both new teams at
    "P: 2" each, again with no manual click. Both throwaway matches were trashed via the Matches
    page; since deleting a match doesn't itself trigger a recompute, ran the existing manual
    "Recompute leaderboards & standings" action (Platform Tools) once afterward and confirmed the
    Stats page returned to its clean 130-run baseline — a cleanup step specific to this slice's own
    test methodology (intentionally polluting the shared stats cache to prove the wiring, then
    un-polluting it), not a gap in the shipped feature itself.

57. **`ROADMAP_V4.md` Slices 4.1 and 4.3 — formally closed as intentionally deferred, no code
    change.** Both slices were designed from Pass 3 onward as conditional — build only once a
    concrete case exists, not speculatively. Re-evaluated both before continuing further into the
    roadmap: for 4.1 (fewer taps for common scoring actions), re-read `ScorePad`'s current run/extras
    flow specifically hunting for a slow sequence to fix — a plain run is already one tap, a plain
    extra is already two taps (select type, then tap `0`, per the UI's own "tap 0 for just the
    extra" helper text), and a run-plus-extra is two taps, the minimum possible given both are
    independent inputs; no dead-end or redundant-confirmation sequence exists anywhere in the pad.
    For 4.3 (remembered scorer preferences), the blocker was never technical — a
    `favStore`/`bgStore`-shaped localStorage store is straightforward — but "remembered preferences"
    has no defined scope without a real friction report to resolve which fields, per-scorer vs
    per-device, and silent-prefill vs confirm-first. Building either now would mean designing for a
    hypothetical need rather than a real, observed one — the exact anti-pattern this project's own
    stated conventions (and each slice's own original write-up, unchanged since Pass 3) already
    warned against. No `scoring.ts`/`Delivery`/offline-infrastructure question arises for either,
    since neither produced any code. Zero files touched, so no `tsc`/`npm run build`/live-verification
    step applies — this entry documents a re-evaluate-and-defer decision, not an implementation.

58. **`ROADMAP_V4.md` Slice 1.1 — Setup wizard validation feedback** — **Done**, no collision. First
    slice to touch `MatchSetupPage.tsx`; confirmed the file's `canAdvance()` was unchanged from the
    version audited in Pass 3 before adding anything. Added `advanceBlockedReason(): string |
    undefined` directly after `canAdvance()`, one branch per step mirroring its conditions exactly,
    with a cross-referencing comment on `canAdvance()` per the plan's own drift-mitigation note —
    purely additive; the boolean gate (`disabled={!canAdvance()}`) itself was not touched or
    restructured. Squad-size messages use the real team `shortName` (already-derived `teamA`/`teamB`
    locals), not a generic placeholder. Zero lines of `scoring.ts` touched; no Firestore write
    introduced by this slice at all (validation is pure client-side derivation). `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
    database by walking the wizard and deliberately leaving each gated step's condition unmet in
    turn** — no test match was created, since this slice has no data-write path: Details step showed
    "Enter a match title to continue." and cleared once typed; Teams step showed all three sub-case
    messages in sequence ("Select Team A to continue." → "Select Team B to continue." → "Team A and
    Team B must be different teams.") as the form state progressed; Playing XI step showed
    "Pick at least 2 players for MWA's Playing XI." then the MWB equivalent, using real team short
    names; Toss step showed "Select who won the toss to continue."; Match Rules step showed
    "Overs per innings must be between 1 and 120." at 0 overs, and the compound
    "Powerplay overs cannot exceed the total overs per innings." check specifically (15 powerplay
    overs against 10 total). Confirmed the "Next" button's disabled state matched the message's
    presence at every single one of these checks — the acceptance criterion that actually matters,
    since a mismatch there would mean the messaging drifted from the real gate.

59. **`ROADMAP_V4.md` Slice 1.3 — Team size/wickets bounds sanity** — **Done**, no collision. Added a
    conditional amber advisory paragraph below the Team size / Number of wickets fields in
    `MatchSetupPage.tsx`, shown only when `form.maxWickets >= form.teamSize`, deliberately using this
    codebase's existing non-blocking-hint amber styling rather than `Field`'s red `error` prop (which
    would visually read as a hard block it isn't). No new branch added to `canAdvance()` or Slice
    1.1's `advanceBlockedReason()` — an independent, parallel, purely advisory check per the plan.
    Zero lines of `scoring.ts` touched; no Firestore write involved. `tsc -p tsconfig.app.json
    --noEmit` and `npm run build` both clean. **Verified live against the real database** — no test
    match created, since this slice has no data-write path: confirmed no warning at wizard defaults
    (11-a-side, 10 wickets); set team size to 2 and confirmed the existing `onTeamSizeChange`
    auto-recompute (which drops wickets to 1 for a 2-a-side squad) does not produce a false-positive
    warning; set wickets to 2 (equal to team size) and confirmed the exact live-interpolated text
    ("Wickets (2) is at or above team size (2)..."); set wickets to 5 and confirmed the numbers in
    the message updated accordingly; confirmed "Next" stayed enabled at every one of these states,
    proving the check is genuinely advisory-only; reset wickets to 1 and confirmed the warning
    disappeared cleanly.

60. **`ROADMAP_V4.md` Slice 1.2 — Quick rematch / duplicate match** — **Done**, no collision, with
    one real bug found and fixed during verification. Added a "Duplicate" `Link` on
    `MatchesPage.tsx`'s row actions (gated by `canScore(profile)`, available regardless of match
    status) and a `duplicateId` load effect on `MatchSetupPage.tsx` mirroring the existing edit-mode
    effect's field mapping, explicitly excluding title/date/time/toss/stage per the plan. Since
    `editId` stays unset, `submit()`'s existing create branch runs unmodified — a genuinely new
    document, zero lines of `submit()` touched. Zero lines of `scoring.ts` touched.
    **Bug found live, not by code review**: the first version reset title/date/time/toss *by
    omission* (relying on the form's initial blank state) rather than explicitly — this only breaks
    if `MatchSetupPage` stays mounted across a mode switch, which the real product UI never triggers
    (the "Duplicate" link lives on `/matches`, a different route, always forcing a remount), but was
    exposed by testing an `?edit=` → `?duplicate=` SPA navigation on the same route (no remount) as
    part of verifying the stage-reset regression check. Fixed by explicitly setting all five fields
    instead of relying on implicit initial state; re-verified the same scenario shows a correctly
    blank title afterward. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean after
    the fix. **Verified live against the real database, full cycle**: created a throwaway source
    match on the knockout-capable "CricketHub Cup" tournament with distinctive values throughout
    (asymmetric 3-vs-2 squads, `CUSTOM` 15-over format, venue, LMS on, retired hurt off, Super Over
    on) — also caught and corrected a test-methodology mistake here: the first attempt to set the
    source's knockout stage to "Final" during creation silently didn't take (a tool-sequencing
    artifact, not an app bug), which was caught by checking the actual saved value rather than
    assuming success, then fixed via the match's own Edit flow so the regression check would be
    testing something real. With the source genuinely at `stage: 'final'`, duplicating it produced:
    title blank, toss unset, teams/asymmetric squad counts/format/overs/venue/team-size/wickets/
    powerplay/LMS/retired-hurt/Super-Over all carried over exactly, tournament carried over, and
    knockout stage correctly reset to group/league phase — not "Final". Completed the duplicate,
    confirmed its ID differs from the source's, and confirmed the source's own fields were
    unaffected by the duplication. Both throwaway matches soft-deleted after verification; neither
    had started scoring, so no stats-cache pollution occurred and no post-cleanup recompute was
    needed (unlike Slice 2.4's test).

61. **`ROADMAP_V4.md` Slice 3.2 — In-scoring-screen scorecard view** — **Done**, no collision.
    Changed the live footer's "Scorecard" `Link` (navigated to `/match/:id`) into a `<button>`
    opening the existing `Modal` component around `ScorecardView`, fed from `ScoringPage.tsx`'s
    already-subscribed `match`/`players.data`/`deliveries` — no new data-fetching, no new component,
    `ScorecardView.tsx` itself untouched. Removed the `Link` import from `react-router-dom` since
    this was its only remaining usage in the file. Zero lines of `scoring.ts` touched. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean (same pre-existing, unrelated
    `ScoreHeader` lint warning). **Verified live against the real database with two in-progress-state
    checks stronger than the plan's own named example**: created a throwaway match, scored a
    boundary to trigger the optional shot-detail prompt, and opened the scorecard modal while that
    prompt was still open — confirmed the modal's figures (4/0, 0.1 ov, batter figures, strike rate)
    matched the live `ScoreHeader` exactly, and confirmed closing the modal left the shot-detail
    prompt untouched. Separately selected "Wide" as an active extra (the plan's own example) and
    confirmed the "Wide selected..." banner survived a full open/close cycle. Also directly verified
    the innings-switching claim rather than trusting the plan's architecture note alone: ended the
    first innings, started the second, and confirmed the modal showed real "MWA innings"/
    "MWB innings" tabs from `ScorecardView`'s own internal `Tabs` with zero additional code written
    to support it. Test match soft-deleted after verification. **This was the last P0–P2 slice in
    the roadmap — only Slice 3.3 (hard-blocked, P2) remains of the entire plan.**

62. **`ROADMAP_V4.md` Slice 3.3 — Scorecard page in-page navigation** — **Done**, no collision, and
    the final slice of the entire roadmap. Re-read the fully-merged `MatchPage.tsx` fresh (647
    lines) before writing any code, per the plan's own hard-block requirement — confirmed V3's
    calendar/`FixturesCalendar` work landed on `TournamentPage.tsx`, not here, so this file's section
    order was never actually disturbed by V3. Chose the plan's "sticky in-page sub-nav" option over
    restructuring into `Tabs.tsx` panels, since `Tabs` implies switching which content is *shown* —
    a materially bigger, riskier change than the actual gap (no way to jump to a section). Added a
    small `SectionJumpLink` component (`scrollIntoView({behavior: 'smooth', block: 'start'})`,
    `print:hidden`) and a row of them right after the header card, linking to Insights, Scorecard,
    Photos, and Comments — each only rendered when its target section will actually render for the
    specific match (`deliveries.length > 0` for Insights, `hasScorecard` for Scorecard, matching
    those sections' own existing conditions exactly; Photos/Comments always render). Added `id`/
    `scroll-mt-4` to each target section's wrapper `div`. Nothing else on the page was restructured,
    gated, or removed, so every section stays reachable by plain scrolling exactly as before —
    satisfies the "no section requires more clicks than today" acceptance criterion by construction.
    Zero lines of `scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both
    clean. **Verified live against a real, already-populated seeded match** (`Royal Strikers vs
    Thunder Kings`, a completed match with head-to-head history, graphs/insights, a full two-innings
    scorecard, and existing photos/comments sections) rather than throwaway data, so nothing needed
    cleanup afterward. Confirmed all four jump links render, then clicked each one (in separate tool
    calls to avoid racing the smooth-scroll animation, a lesson carried over from Slices 1.4/1.2's
    testing) and confirmed via `getBoundingClientRect()` that Insights and Scorecard landed within
    16px of the viewport top (matching the `scroll-mt-4` offset exactly), Photos landed within
    ~100px, and Comments — the last section on the page — correctly clamped to the bottom of the
    scrollable document (the browser cannot scroll past the page end), still comfortably visible.
    **This closes out `ROADMAP_V4` in its entirety — every slice is done or formally deferred.**

63. **Removed dead `completeMatch()` from `scoring.service.ts`** — post-roadmap cleanup, not a
    `ROADMAP_V4` slice. Flagged during Slice 2.4's implementation as exported with zero call sites
    anywhere in the app (superseded by `recordBall`/`endInnings` handling completion inline);
    user asked for it to be removed after the roadmap closed out. Re-confirmed zero call sites via
    a fresh grep across `src/` immediately before deleting the function, so nothing was silently
    depending on it. `MatchResult` (its parameter type) stayed imported — confirmed still used
    elsewhere in the file (`notifyMatchDone`, `abandonMatch`, `computeResult`'s return type), so no
    unused-import cleanup was needed either. Zero lines of `scoring.ts` touched. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean. No live-verification step applies —
    dead code has no UI flow to exercise, before or after removal.

64. **`ROADMAP_V5_PLATFORM.md` Slice A1 — Batter vs Bowler analytics** — **Done**, no collision.
    New pure `src/domain/batterVsBowler.ts` (`batterVsBowlerBreakdown`/`batterVsOneBowler`), one row
    per bowler actually faced (no zero-filled enum, unlike the wagon-wheel/pitch-map grids — there's
    no fixed "every possible bowler" list to pad out), sorted by balls faced. "Balls faced" excludes
    wides, matching `scoring.ts`'s own `striker.balls += 1 unless extra === 'wide'` convention
    exactly (read, not modified) so this stays consistent with every other balls-faced figure in the
    app. New "vs Bowler" tab on `PlayerPage.tsx`, lazy-loaded — the underlying fetch (every delivery
    across every match the player batted in, via `getDeliveries()` per match, mirroring
    `admin.service.ts`'s existing `gatherPlatformBackup()` concurrent-fetch pattern) only fires once
    the tab is actually opened, not on every page load. Tab itself only rendered for players with at
    least one batting performance. Zero lines of `scoring.ts` touched — reads `Delivery` fields
    already recorded, no schema change. **Concurrent-session note**: this session's own
    `ROADMAP_V5.md` was clobbered mid-write by a concurrent scoring-engine session using the same
    filename for its own (differently-scoped) V5 roadmap; left their file untouched and moved this
    session's roadmap to `ROADMAP_V5_PLATFORM.md` instead. Confirmed via `git status` that this
    slice's own touched files (`PlayerPage.tsx`, new `batterVsBowler.ts`) don't overlap the
    concurrent session's in-flight changes (`firestore.rules`, `MatchesPage.tsx`) before implementing
    or staging. `tsc -p tsconfig.app.json --noEmit`, `npm run build`, and `oxlint` on the touched
    files all clean. **Verified live against the real database, hand-checked ball-by-ball, not just
    "looks plausible"**: opened Shreyas Iyer's real seeded match history, confirmed the "vs Bowler"
    tab shows three rows (R Jadeja, Y Chahal, M Shami); pulled the actual full ball-by-ball
    commentary for that match and manually tallied every delivery Iyer faced from each bowler by
    hand — all three rows matched exactly (Jadeja: 6 balls/13 runs/1 dismissal/2 sixes; Chahal: 5
    balls/8 runs/1 four; Shami: 4 balls/9 runs/2 fours), sorted correctly by balls faced descending.
    Confirmed the bowler-name link resolves to the correct player id (Jadeja → `ptk3`, matching the
    id independently seen on the Stats leaderboard). Confirmed the regression case: a pure bowler
    with zero batting innings (Yuzvendra Chahal) shows no "vs Bowler" tab at all.

65. **`ROADMAP_V5_PLATFORM.md` Slice A2 — Partnership analytics** — **Done**, no collision, scope
    corrected before writing any code. The original plan assumed a cross-match "partnership records"
    module could mirror `records.ts`'s cheap pattern; re-reading `records.ts` closely showed that's
    wrong — it's cheap specifically because it reads only the denormalised `Match.innings[]`
    batting/bowling cards already on each match doc, and partnerships are never denormalised
    anywhere (they only ever exist as a computation over raw `Delivery[]`). A cross-match leaderboard
    would need either a platform-wide delivery fetch on every Stats-page load (too expensive to do
    live, unlike A1's single-player scope) or denormalising partnership data onto `InningsState` at
    scoring time (touches `scoring.ts`, off-limits). **Descoped before implementation**, not
    discovered mid-build: shipped only the full per-innings breakdown, the cheap and actually-asked-
    for half of the original problem statement; the cross-match leaderboard is documented as a
    deferred idea (would need a cached/recomputed doc like `playerStats`/`standings`, not a live
    scan) rather than built speculatively or half-right. Widened `InningsInsights` with a
    `partnerships: Partnership[]` field (the full array `insights.ts` already computed internally
    and previously discarded down to just `bestPartnership`) — purely additive; confirmed via grep
    that `MatchInsights.tsx` is the only consumer of this type anywhere in `src/`, so no other call
    site needed updating. Added a "Partnerships" list section to `MatchInsights.tsx`. Zero lines of
    `scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit` and `npm run build` both clean.
    **Verified live against the real database, cross-validated against independently-rendered data
    on the same page rather than assumed correct**: reused the same seeded "Royal Strikers vs
    Thunder Kings" match from entry #64. All five Royal Strikers partnerships (12, 16, 10, 14, 6
    runs) summed and matched exactly against that same page's own, independently-computed "Fall of
    wickets" list (12-1, 28-2, 38-3, 52-4, 58-5) — two separately-rendered parts of the page agreeing
    is real evidence of correctness, not just "it rendered without an error." Confirmed the existing
    "Best partnership" tile (16 (10), S Iyer & R Sharma) matches the corresponding row in the new
    full list exactly. Confirmed the Thunder Kings innings' final, still-unbroken partnership
    correctly reads "unbroken" rather than a bogus wicket number — the one label a copy-paste error
    could easily have gotten wrong.

66. **`ROADMAP_V5_PLATFORM.md` Slice A3 — Expected Score** — **Done**, no collision. Audited first:
    confirmed via grep that `projectedScore()` (`lib/format.ts`) had exactly one consumer
    (`MatchPage.tsx`'s `LivePanel`) and ignored wickets entirely, and that `LivePanel` already
    computes a `wicketsRemaining` value for the sibling `chaseWinProbability` call but never passed
    it into the score projection. New `src/domain/expectedScore.ts`'s `projectFirstInningsScore()`
    extrapolates the current run rate across overs remaining, scaled by a wickets-in-hand factor
    (`0.5 + 0.5 * min(1, wicketsRemaining/10)`) that mirrors `chaseWinProbability`'s own `/10`
    normalization exactly, rather than a second, differently-scaled convention for the same input in
    the same component. Explicitly documented as a heuristic, not Duckworth-Lewis or a fitted model
    — the same honesty `winProbability.ts` already commits to, for the identical reason (no
    historical ball-by-ball dataset in this app to calibrate either against). Every input (runs,
    balls bowled, wickets lost) is real recorded match data — nothing fabricated or estimated where
    real data doesn't exist. Reused `LivePanel`'s already-computed `wicketsRemaining` rather than
    recomputing it; updated the on-page label from "Projected X on this run rate" to "Expected
    score: X" since the number is no longer pure-rate-based. **Confirmed zero other consumers of
    `projectedScore()` after the swap and removed it** from `lib/format.ts` outright — dead code,
    not left behind speculatively. Zero lines of `scoring.ts` touched. `tsc -p tsconfig.app.json
    --noEmit`, `npm run build`, and `oxlint` all clean (one pre-existing, unrelated
    `react-hooks/exhaustive-deps` warning on a different `useMemo` in the same file, not introduced
    by this change — confirmed by reading the flagged code, which this slice never touched).
    **Verified live against the real database with the formula hand-computed twice, not eyeballed
    for plausibility**: created a throwaway 3-a-side match, scored 24 runs off 6 balls with 0
    wickets down, and confirmed the displayed "Expected score: 298" matched an independent hand
    calculation of the exact same formula to the integer. Took a wicket (wickets remaining 2→1,
    squad of 3) and confirmed the number dropped to exactly 237 — also independently hand-verified —
    proving the wicket-sensitivity genuinely works, not just that a number renders. Confirmed no new
    console errors beyond pre-existing, unrelated Firebase Storage CORS noise from the photo gallery.
    Test match deleted after verification; it never reached `completed` status, so no stats-cache
    pollution occurred and no post-cleanup recompute was needed (unlike Slice 2.4's test in
    `ROADMAP_V4.md`).

67. **`ROADMAP_V5.md` Slice 7.1 — Wicket modal allows illegal dismissal types on Wide/No ball** —
    **Done**, no collision. Added `LEGAL_TYPES_BY_EXTRA` (`ScoringModals.tsx`) mapping `wide` to
    `[run_out, stumped, retired_out, retired_hurt, other]` and `no_ball` to `[run_out, retired_out,
    retired_hurt, other]` — the actual laws of cricket for what can happen on those deliveries — and
    an `activeExtra` prop on `WicketModal` (default `null`, so the change is inert unless a caller
    opts in; there is exactly one caller, `ScoringPage.tsx`). Combined with the existing
    `retiredHurtEnabled` filter rather than replacing it. Default selected type now starts at the
    first legal option (`run_out` when restricted) instead of unconditionally `bowled`, so the modal
    never opens pre-selected on an invalid choice. Zero lines of `scoring.ts` touched — the engine
    still accepts any `WicketType` it's given; this only narrows what the picker *offers*. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
    database**: with no extra active, confirmed all 9 types still show (regression check); activated
    Wide and confirmed the modal showed exactly Run out/Stumped/Retired out/Retired hurt/Other;
    switched to No ball and confirmed exactly Run out/Retired out/Retired hurt/Other (Stumped
    correctly absent here, present for Wide — the one detail most likely to be gotten wrong, checked
    explicitly rather than assumed symmetric). Test match deleted after verification.

68. **`ROADMAP_V5.md` Slice 2.1 — Super Over scoring (linked match)** — **Done**, no collision. Added
    `linkedMatchId?: string | null` to `Match` and `CreateMatchInput`/`createMatch()`. New
    `startSuperOver(match, callerId)` in `scoring.service.ts` derives the correct first-batting team
    (the team that batted second in the original match, per standard playing conditions), creates a
    new `Match` through the existing, unmodified `createMatch()` (1 over, `maxWickets: min(parent,
    2)`, same teams/squads, a synthetic toss the scorer can still edit via `ROADMAP_V4` Slice 1.4's
    toss editor), and writes `linkedMatchId` back onto the parent. **Correctness detail caught during
    implementation, not after**: `ownerId`/`createdBy` on the new match are explicitly set to
    `callerId` (whoever clicks "Start Super Over"), not inherited from the parent — required because
    `firestore.rules`'s `create` rule checks the write against the actual caller's uid, which only
    equals the parent's `ownerId` if the same person is scoring both matches; using the parent's
    `ownerId` unconditionally would have broken Super Over creation for anyone else (including a
    delegated scorer, once Slice 6.1 is deployed). `ScoringPage.tsx`'s completed-tie screen replaced
    the old static "to be scored as a separate match" note with a real "Start Super Over" / "View
    linked Super Over" action (one conditional block covers both directions plus the not-yet-started
    state); `MatchPage.tsx` shows the same link publicly. Zero lines of `scoring.ts` touched — a
    Super Over is scored through the exact same `applyBall`/`newInnings` as any other match. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against the real
    database, full cycle, with a genuine tie, not a shortcut**: created a throwaway 1-over-per-side
    match with Super Over enabled, scored six real dot balls in each innings (not a force-end) to
    reach an actual 0-0 tie via `computeResult`'s own logic, confirmed a real "Start Super Over"
    button appeared, clicked it, and confirmed every derived value on the new match: `CUSTOM · 1
    overs`, toss correctly awarded to the team that batted second originally, `Wickets: 2`,
    `Powerplay: 0 overs`, squads inherited. Confirmed the parent's own completed screen and its
    public `MatchPage.tsx` both show a working link to the new match. All three throwaway matches
    (including one unrelated to this slice) soft-deleted after verification.

69. **`ROADMAP_V5.md` Slice 6.1 — Scorer delegation is silently non-functional** — **Code done,
    deployment/live-verification pending — flagged explicitly, not claimed done.** Confirmed by
    reading `firestore.rules` and `authStore.ts`/`MatchesPage.tsx` directly: `scorerId` (settable to
    a different user than `ownerId` via the setup wizard's "Assign scorer" picker) was checked
    *nowhere* — not in the `matches/{id}` update rule (`isOwnerOrMaster(resource.data.ownerId)`
    only), not in `ownerScope()`'s client-side list filtering (`ownerId` only, applied to every
    non-master role including SCORER). Net effect confirmed by tracing the code, not assumed: an
    assigned scorer who isn't the owner can't see the match in their list, and even reaching
    `/scoring/:id` directly would fail every write. Added `isDelegatedScorer()` to
    `firestore.rules`: matches on `resource.data.scorerId == request.auth.uid` (the value already
    stored, not the incoming one — so a non-owner can't self-grant by writing their own uid into
    `scorerId`, since only the existing owner can set that field) plus a
    `diff(resource.data).affectedKeys().hasOnly([...])` allowlist built by grepping every real
    match-doc write across `scoring.service.ts` and `ScoringPage.tsx`'s own `editToss()` call:
    `status, innings, currentInnings, startedAt, completedAt, result, playerOfTheMatchId, toss,
    battingFirstTeamId, updatedAt, linkedMatchId` (the last field added mid-implementation once
    Slice 2.1's `startSuperOver()` turned out to need it too, caught and folded in before either
    slice was committed). `delete` stays owner/master-only, not widened. `MatchesPage.tsx`'s list
    filter now shows a match if `ownerId === scope || scorerId === scope`. Re-confirmed the wizard's
    scorer picker already restricts candidates to SCORER/ADMIN roles, so the rule doesn't need its
    own separate role check. Zero lines of `scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit`
    and `npm run build` both clean.
    **Explicitly not verified, and why, rather than silently skipped**: this sandbox has neither the
    Firebase CLI (needed to deploy `firestore.rules` — without deployment the rule has zero live
    effect) nor Java (needed for the Firestore rules emulator, the only offline way to test rule
    enforcement without deploying). Both were checked directly (`firebase --version` and `java
    -version` both fail — not installed) rather than assumed unavailable. The unchanged owner/master
    path is low regression risk, but the actual fix — a non-owner `scorerId`-delegate gaining access,
    everyone else still denied — has not been exercised against real Firestore. Committed anyway
    (rather than left indefinitely uncommitted) since the code is correct by direct, field-by-field
    trace against the real write paths, and leaving a confirmed, traceable security/functionality gap
    unfixed in the repository is worse than shipping a well-reasoned fix pending deployment. **Needs
    from the user**: run `firebase deploy --only firestore:rules`, then ideally spot-check with a
    genuine second, non-owner `scorerId`-assigned account.

70. **`ROADMAP_V5_PLATFORM.md` Slice A4 — Career-level Wagon Wheel + Bowling Heat Map** — **Done**,
    no collision. Audited first, re-diffing `wagonWheel.ts`/`pitchMap.ts`/`ballMeta.service.ts`
    against 4 commits back to confirm zero changes since the original audit — both domain functions
    already accept an optional player-id filter and are pure, `listBallMeta(matchId)` is scoped to
    one match, and the `WagonWheel`/`PitchMap` chart components take only `{zones}`/`{cells}`, no
    data-fetching of their own. Reused A1's already-fetched `perfs.data` for the player's match-id
    list — this also means the fetch inherits `playerPerformances()`'s existing `isFinished(m)` gate,
    so an in-progress live match's provisional tags can never leak into "career" analytics; this
    exact behavior was verified live, not assumed. For each match, fetches `getDeliveries()` and
    `listBallMeta()` in parallel, concatenates across matches, then calls `wagonWheelData`/
    `pitchMapData` once each on the combined set — both already filter internally by player id, so
    one combined cross-match fetch feeds both charts with zero new domain logic. Lazy-loaded behind
    its own `analysisOpened` flag, separate from A1's `vsBowlerOpened`, since this fetch is heavier
    (deliveries *and* ballMeta per match). New "Shot & Line Analysis" tab; inner content shows each
    chart only when that specific player's filtered data has a non-zero cell, with an explicit empty
    state when neither does — never a fabricated or misleadingly-blank chart. Zero lines of
    `scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit`, `npm run build`, and `oxlint` all
    clean. **Verified live against the real database with deliberately-tagged, known ground truth —
    confirmed first that the existing seeded "Royal Strikers vs Thunder Kings" match has zero tagged
    deliveries, so it could not have been used for this check**: created a throwaway match, had one
    player bat *and* bowl to himself (deliberately, so his own player page would exercise both charts
    at once), and tagged two real deliveries through the actual `ShotDetailPrompt` UI — Mid-wicket/
    Stumps/Good for a 4, Long-on/Off/Full for a 6 — never seeded directly into Firestore.
    **Explicitly regression-checked the finished-matches-only behavior**: confirmed the tab showed
    the empty state while the match was still live, then confirmed both charts appeared with the
    exact tagged values only after force-completing the match via "End innings" on both innings.
    Confirmed the wagon wheel showed 4 runs/1 ball and 6 runs/1 ball in the correct two zones (six
    others correctly zero-filled) and the heat map showed 4 at Good×Stumps and 6 at Full×Outside-off
    — an exact match to what was deliberately tagged. Test match deleted after verification; since it
    had reached `completed` status, ran "Recompute leaderboards & standings" afterward and confirmed
    the player's stats and the Analysis tab both reverted to their clean pre-test baseline (empty
    state again) — same cleanup discipline as `ROADMAP_V4.md` Slice 2.4. **This completes Phase A of
    `ROADMAP_V5_PLATFORM.md` in full** (A1–A4 all done); Phase B (Tournament Admin signup/permissions,
    account audit, phone verification) has not been started.

71. **`ROADMAP_V5.md` Slice 4.1 — Extend delivery metadata with a review/DRS tag and note** —
    **Done**, no collision. Added `note?: string`/`reviewed?: boolean` to `BallMeta` and widened
    `recordBallMeta`'s `Partial<Pick<...>>` accordingly — no logic change to `ballMeta.service.ts`
    itself. UI landed in the existing `ShotDetailPrompt` (already shown after every scored ball via
    `pendingMeta`, including after a wicket) rather than a new component: a "Flag for review" toggle
    (disables itself once flagged) and a note input + Save, both routed through the same
    `saveShotMeta()` merge-write already used for zone/line/length — no new write path introduced.
    `pendingMeta` gained a local `reviewed` boolean so the button reflects the current delivery's
    state without a re-fetch. Zero lines of `scoring.ts` touched. `tsc -p tsconfig.app.json --noEmit`
    and `npm run build` both clean. **Verified live against the real database with a direct document
    read, not just trusting the UI**: created a throwaway match, scored a boundary to trigger the
    prompt, saved a note and flagged for review, confirmed the button switched to "Flagged for
    review" and disabled. Rather than stopping there, dynamically imported `ballMeta.service.ts` via
    Vite's dev-server module serving directly in the browser
    (`await import('/src/services/ballMeta.service.ts')`) and called `listBallMeta()` for the match,
    confirming the actual stored Firestore document: `{note: "Given out, review requested", reviewed:
    true}`. Test match abandoned and deleted after verification.

72. **`ROADMAP_V5.md` Slice 3.1 — Wicket-decision correction via `rebuildInnings()`** — **Resolved
    via existing functionality, re-scoped after catching a real correctness bug in the original
    plan before writing any code.** The original plan assumed `rebuildInnings()` (`domain/scoring.ts`
    lines 437-480) recomputes each delivery's striker/non-striker fresh from accumulated engine
    state during replay. Re-reading it directly disproved this: lines 446-448 (`s.strikerId =
    d.strikerId` etc.) show every delivery's striker/non-striker/bowler are taken from that
    delivery's own **stored** fields, and the incoming-batter inference (lines 461-469) works by
    diffing the *next* delivery's stored fields — correct for `undoLastBall()`'s actual use (dropping
    the tail, where every kept delivery's stored fields are still accurate) but **silently wrong**
    for patching a wicket in the *middle* of the delivery list while keeping everything after it:
    every later delivery still has its old stored striker/non-striker reflecting the historical
    replacement batter, so replaying them unmodified would put the wrong batter at the crease for the
    rest of the innings with no error, just quietly incorrect data. Not a hypothetical — traced
    directly from the code. **Resolution**: correcting the *most recent* delivery's wicket has no
    such problem (no later deliveries to go stale) and already reduces to two already-verified
    primitives — `undoLastBall()` (already wired to the existing "Undo" button) followed by
    re-scoring through the normal flow — so no new code was needed at all. Correcting an *older*
    wicket is moved to permanently out of scope alongside the Phase 5 engine-change items, since
    doing it correctly would require either modifying `rebuildInnings()` itself (an engine change,
    off-limits) or reimplementing strike-rotation/incoming-batter logic independently in
    `scoring.service.ts` — maintaining a second, parallel copy of exactly the logic the "verified,
    don't reimplement" restriction exists to prevent duplicating. **Verified live with two scenarios,
    not just reasoned about**: undoing a wicket that was the innings' literal first ball correctly
    reset all the way to the pristine pre-openers state (nothing to restore to). Then, to actually
    exercise mid-innings restoration, scored one normal ball (2 runs, even — no rotation, so the
    pre-wicket baseline had a known striker), scored a wicket (new batter came in), then undid it —
    confirmed the state reverted to exactly `2/0` with the **originally-dismissed batter** back at
    striker showing his exact prior figures (2 runs, 1 ball), not the replacement, and completed the
    correction by re-scoring the ball as a single instead — final state (`3/0`, strike correctly
    rotated) matched exactly what directly scoring the corrected sequence would have produced. Test
    match cleaned up after verification. No files changed for this slice — nothing to commit besides
    documentation.

73. **`ROADMAP_V5_PLATFORM.md` Slice B1 — Tournament Admin signup grants the wrong role** — **Done**,
    no collision (pre-flight check: `git diff -- firestore.rules` was empty, `git diff -- src/types/
    index.ts` showed only the concurrent scoring session's additive `BallMeta.note`/`reviewed`
    fields, unrelated to roles — safe to proceed). `requests.service.ts`'s `approveRequest()`
    hardcoded `setUserRole(req.uid, 'ADMIN')` despite the request form explicitly asking "Tournament
    you want to run" — confirmed by reading `AccountPage.tsx`'s form copy directly, not assumed. Now
    grants `TOURNAMENT_MANAGER`. Updated the approval `notify()` text and `RequestsPage.tsx`'s
    approve toast from "admin" to "tournament manager" so the user-visible claim matches the actual
    role — both are literal, checkable claims (the role shows on Users & Roles as "Tournament
    Manager," not "Admin") that would otherwise be wrong post-fix. Did not rename the `AdminRequest`
    type/`adminRequests` collection/"Admin requests" page title — `TOURNAMENT_MANAGER` is still a
    tier of admin-ish access via `canManage()`, so that generic framing isn't false, just less
    specific; renaming the whole feature would be unnecessary churn. `tsc -p tsconfig.app.json
    --noEmit`, `npm run build`, `oxlint` all clean. **Live verification done in two halves; the
    second was intentionally stopped short by the user's own explicit instruction mid-verification,
    not skipped silently**: signed in as an existing seeded `viewer` test account (`Test12` /
    `@testaccount1`) and submitted a real request ("B1 Verification Test Cup") through the actual
    `AccountPage.tsx` form — confirmed by the page flipping to a real "Request pending" state, which
    only renders after a successful Firestore write (first attempt silently no-opped because the
    input ref had gone stale mid-navigation and the typed text landed nowhere; caught by reading the
    live DOM input `.value` directly via `javascript_tool` before resubmitting, not assumed from the
    UI alone). The natural next step — switch back to the master-admin session, click Approve, and
    confirm `users/{uid}.role` reads `TOURNAMENT_MANAGER` — was not completed live because the user
    said "stop when you can" before that second sign-in happened. That half is verified by direct
    code/rules reading instead (the corrected `setUserRole()` call, `ROLE_LABELS` mapping, and
    `firestore.rules`' `isMasterAdmin()`-gated `adminRequests` update path) — documented here as
    partial live verification, not overclaimed as a full click-through. **Leftover state**: a real
    `adminRequests` doc for `testaccount1` ("B1 Verification Test Cup") is still `pending` in the
    live database — needs either a real approve/reject (which would also close out the verification
    above) or a manual cleanup, so it isn't mistaken for a genuine request later. **Significant
    finding surfaced while auditing this slice, deferred to B2 rather than fixed here to keep this
    diff scoped to the one bug it set out for**: `firestore.rules`' `canScore()` (and `authStore.ts`'s
    client-side mirror) is `['MASTER_ADMIN', 'ADMIN', 'SCORER']` — `TOURNAMENT_MANAGER` is excluded —
    and `/matches/new` (`App.tsx`) is guarded by the same list, confirmed by reading both the route
    guard and `MatchesPage.tsx`'s button gating directly. Net effect: a user granted
    `TOURNAMENT_MANAGER` by this exact flow can create their tournament and its teams/players
    (`canManage()` covers that) but cannot create or score a single match in it — undercutting the
    feature's own stated purpose. This is now B2's concrete starting finding, not a from-scratch
    audit.

74. **`ROADMAP_V5.md` Slice 8.1 — "Did not bat" list on the scorecard** — **Done**, no collision
    (pre-flight check: `git status --short` showed the working tree also carrying a concurrent
    session's own uncommitted changes to `firestore.rules`/`App.tsx`/`authStore.ts` — the "B2" work
    entry #73 flagged, adding `TOURNAMENT_MANAGER` to `canScore()` and the scoring route guards —
    left all three untouched and staged only this slice's own file). The unused-squad-member list
    (`squadFor(match, battingTeamId).filter(pid => !battingCard.some(b => b.playerId === pid))`) was
    already computed correctly in `ScorecardView.tsx`'s `InningsCard`; only the label was wrong —
    always "Yet to bat" regardless of whether the innings had actually finished. Changed the label to
    `inn.isComplete ? 'Did not bat' : 'Yet to bat'`, reusing `InningsState.isComplete` already present
    on the same object — no new computation, no new prop. Zero lines of `scoring.ts` touched. `tsc -p
    tsconfig.app.json --noEmit` and `npm run build` both clean. **Verified live against real (not
    throwaway) match data**: the completed "Royal Strikers vs Thunder Kings" match — Thunder Kings won
    by 3 wickets, so two of their squad (M Shami, Y Chahal) never batted — now reads "Did not bat: M
    Shami, Y Chahal" on its public scorecard, confirmed by reading the live rendered DOM text via
    `javascript_tool`, not just visual inspection. Did not chase down a live regression case (every
    currently-live match in this dev database is a minimal throwaway squad already fully exhausted
    by the time any ball is scored, so none exercises the "innings still in progress" branch) — the
    change is a single-line ternary whose false branch is byte-identical to the pre-existing string,
    so the regression risk is zero by construction, not just argued to be low.

75. **`ROADMAP_V5.md` Slice 6.2 — `ballMeta` write rule has no owner scoping** — **Code written,
    not yet deployed/verified** (same environment blocker as entry #69/Slice 6.1). This slice was
    explicitly left as an open product question rather than defaulted either way in the original
    audit (entry #67 pass); asked directly and the user chose "tighten to owner-scoped," matching
    the match doc's own access. Added `isOwnerMasterOrDelegatedScorer(matchId)` to `firestore.rules`
    — a *new* function, not a reuse of the existing `isDelegatedScorer()`, because that function
    reads `resource.data.scorerId` which only resolves to the match doc when evaluated from within
    `/matches/{id}`'s own rule; inside the nested `ballMeta` match, `resource` is the ballMeta doc
    itself (no `scorerId` field), so calling it there would silently check the wrong document — the
    new function instead fetches the parent match via `get(...matches/$(matchId))` using the outer
    match's own `id` binding. Changed `ballMeta/{ballId}`'s `allow write` from bare `canScore()` to
    `isOwnerMasterOrDelegatedScorer(id)`. Deliberately left `deliveries` unchanged — it's always
    written inside the same atomic batch as a match-doc update, so the match doc's own owner check
    is already the real gate; only the standalone `ballMeta` write needed its own. Zero lines of
    `scoring.ts` touched; rules-only change, no TS files affected. **Not live-verified**, identical
    reason to Slice 6.1: no Firebase CLI and no Java in this sandbox, so neither offline path to test
    rule enforcement is available, and the rules file has zero effect until deployed. **Needs the
    user to**: deploy (can go out in the same `firebase deploy --only firestore:rules` as Slice 6.1's
    change, since both are in the one file) and ideally spot-check that a non-owner/non-master/
    non-assigned-scorer can no longer tag shot metadata on someone else's match.

76. **`ROADMAP_V5_PLATFORM.md` Slice B2 — Tournament Admin permissions audit** — **Done**, code
    complete and committed, live verification blocked by session/environment constraints (not
    skipped — see below). B1's audit had already found `canScore()` excluded `TOURNAMENT_MANAGER`
    while `canManage()` included it, confirmed by reading the `/matches/new`/`/scoring/:id` route
    guards and `MatchesPage.tsx`'s button gating directly — a tournament manager could create their
    tournament/teams/players but not a single match in it. Added `TOURNAMENT_MANAGER` to `canScore()`
    in both `firestore.rules` and `authStore.ts`, and to both route guards — actual per-match writes
    stay gated by `isOwnerOrMaster(resource.data.ownerId)`, so this doesn't grant access beyond the
    tournament manager's own matches, same shape `ADMIN` already has. Also widened
    `MatchSetupPage.tsx`'s "Assign scorer" candidate filter (`SCORER`/`ADMIN`) to include
    `TOURNAMENT_MANAGER` for UI consistency with the new `canScore()` standing.
    **Unclaimed related fix, independently verified before accepting**: `auditLogs`' `create` rule
    was `isAdmin()`-only (`MASTER_ADMIN`/`ADMIN`), but grepping every real `logAudit()` call site
    found `auth.service.ts` logs *every* login regardless of role and `trash.service.ts` (reachable
    by `TEAM_MANAGER`/`TOURNAMENT_MANAGER` via the Trash page) logs soft-delete/restore/permanent-
    delete — `logAudit()` swallows its own errors, so both were failing silently pre-existing this
    slice. Loosened to `isSignedIn()` + self-attribution (`actorId == request.auth.uid`), matching
    `notifications`/`activity`'s existing create-rule shape.
    **Provenance, disclosed rather than silently absorbed**: the `canScore()`/route-guard/`auditLogs`
    changes were found already sitting uncommitted in the shared working tree — another Claude Code
    chat is running its own dev server in this same folder and had independently arrived at the same
    fix (plus the `auditLogs` half I hadn't found yet). Every hunk was reviewed with the same rigor as
    original work (route guards and button gating traced directly, every `logAudit()` call site
    grepped) before being accepted, not trusted blindly. The same file also had that session's own
    Slice 6.2 (entry #75 above, unrelated to `TOURNAMENT_MANAGER`) mixed in — surgically reverted
    just that hunk, committed B2's actual diff, then restored Slice 6.2 exactly as it was (verified
    byte-identical via a second diff) so it stays that session's own commit to make.
    `tsc -p tsconfig.app.json --noEmit`, `npm run build`, `oxlint` on all four touched `.ts`/`.tsx`
    files clean. **Live verification not completed, environment-blocked**: a fresh `preview_start`
    landed this session's dev server on a different port than the one already open in the Browser
    pane (`5173` was occupied by the other chat's server), producing a new browser origin with no
    carried-over sign-in. The user asked not to be prompted for further logins before stepping away,
    so the planned click-through — approve the still-pending "B1 Verification Test Cup" request,
    then confirm the resulting `TOURNAMENT_MANAGER` account can see and use "New match" — could not
    be completed. That request is still sitting `pending` in the live database; approving it will
    complete both B1's and B2's outstanding live-verification in one step whenever a session is
    available.

76. **`ROADMAP_V5.md` Slice 5.1 — Optional-field fallback audit** — **Done, no gaps found, no code
    changed.** Grepped every read site of every optional `Match`/`Delivery`/`BallMeta` field across
    `src/` and confirmed each degrades correctly against its own documented intent: `maxWickets`
    (`effectiveSquadSize()`, `ScoringPage.tsx`'s display, `startSuperOver()` all correct, including
    confirming the two differently-shaped fallbacks — squad size vs. squad size minus one — are both
    intentional, not inconsistent), `teamSize`/`powerplayMode`/`powerplayOvers`/`retiredHurtEnabled`/
    `lastManStanding`/`superOverEnabled` (all `??`/`!==false` matching their own doc comments),
    `linkedMatchId` (every read is a plain truthy check, correct for a field absent on non-Super-Over
    matches), `Match.scorerId`/`Delivery.scorerId` (already under extra scrutiny from Slices 6.1/6.2's
    own new dependencies on it — `notifyMatchDone`'s `.filter(id => !!id)`, `MatchesPage.tsx`'s list
    filter, `platformAnalytics.ts`'s aggregation, `MatchSetupPage.tsx`'s form hydration all correct),
    and `BallMeta.zone`/`line`/`length`/`note`/`reviewed` (`wagonWheel.ts`/`pitchMap.ts`'s `!= null`
    filters plus their own `hasWagonWheelData`/`hasPitchMapData` gates, `MatchPage.tsx`/`PlayerPage.tsx`
    gating on `(ballMeta.data?.length ?? 0) > 0` for the whole-subcollection-missing case). Confirmed
    `InningsState` has zero optional fields — the engine always writes it in full — so there was
    nothing to check there. Did not re-audit fields already exercised by a prior roadmap's own
    verification pass (`tournamentId`/`venue`/`stage`/`archived`/`deletedAt`, all pre-V5). No fix
    slice generated; this closes out the last planned V5 scoring-engine slice.

(Appended to as further slices are picked up.)
