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
| Command palette (Ctrl/Cmd+K), saved filters, dashboard widget customization | Deferred (not yet scheduled) | Real, bounded, non-conflicting features — legitimate candidates for a future slice, just not picked up in this pass. Not blocked by any restriction. |
| Exhaustive accessibility audit | Already `🚫` in ROADMAP.md (Phase 9) | Open-ended by nature; unchanged. |

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
   Officials, which are deferred per §4).
2. **Persisted notification center** (Firestore-backed, read/unread, categories, preferences),
   wired into concrete existing trigger points rather than a generic event bus (§4).
3. **Media uploads via Firebase Storage** for player photos / team logos / club logos / tournament
   banners — the `storage` singleton (`lib/firebase.ts`) already exists and is unused.

(Appended to as further slices are picked up.)
