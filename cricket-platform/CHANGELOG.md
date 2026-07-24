# Changelog

All notable changes to CricketHub. Newest first.

## [Unreleased] — Commercial expansion pass

### Fixed — Overlay motion consistency (ROADMAP_V2 Phase 4)
- Full-screen overlay backdrops (the shared `Modal`, the mobile nav drawer, the "Clear all
  leaderboards" danger dialog) now fade in instead of appearing instantly, matching the panel
  transitions they already had. The mobile nav drawer itself now slides in rather than snapping
  open. Respects the existing reduced-motion preference automatically.

### Added — Developer docs (ROADMAP_V2 Phase 7)
- New `CONTRIBUTING.md` for human contributors (dev loop, verification convention, off-limits
  list). Refreshed `README.md`'s stale role list (missing `MASTER_ADMIN`) and bootstrap description.

### Fixed — Form validation audit (ROADMAP_V2 Phase 6)
- Match setup and Tournament forms could previously accept `0` or negative overs-per-innings (and,
  for tournaments, an invalid teams-advancing-per-group count) all the way through to a real save —
  the numeric inputs' `min`/`max` attributes weren't actually enforced anywhere. Both now reject
  out-of-range values with a real error message before saving.

### Performance — Bundle chunking (ROADMAP_V2 Phase 5)
- `vite.config.ts` now splits vendor code into `vendor-firebase`/`vendor-react`/`vendor` chunks,
  separate from the app's own code. The Firebase SDK (by far the largest dependency) can now be
  cached long-term across deploys instead of being re-bundled into whichever chunk happened to
  import it; the app's own entry chunk dropped from ~305kB to ~72kB.

### Added — Optional edit reason on regular edits (Phase 37)
- All five edit forms (Player, Team, Club, Tournament, Match setup) now have an optional "Reason
  for this change" field, threaded into the version-history entry `snapshotVersion()` already
  supported since Phase 18 but no caller had populated until now.
- Found and fixed the same bug at all five call sites: `Field` doesn't accept a `className` prop
  (a type error, not a no-op) — wrapped each new field in a plain `<div>` instead.

### Added — Match photo galleries (ROADMAP_V2 Phase 3)
- New `MatchGallery` component on the public match page: view photos from the match (uploaded to
  a `matches/{id}` Storage folder, same convention as player/team/tournament media). The match's
  scorer/owner (or master admin) gets an upload control and per-photo delete; everyone else sees a
  read-only grid with a lightbox. No service-layer or Storage-rules changes needed — built entirely
  on the existing `storage.service.ts` API.

### Added — Audit log: login events + search (Phase 36)
- Successful sign-ins are now audit-logged (`auth.service.ts`'s `login()`, fire-and-forget so a
  rejected write for a non-admin login never blocks sign-in). Platform Tools' audit card gained a
  search box over action/details/actor and a raised 200-entry fetch cap.

### Added — Notification history page (ROADMAP_V2 Phase 2)
- New `/notifications` page reusing the already-existing `listNotifications()`: every notification
  you've ever received (not just the bell dropdown's 50-item cap), with read/unread and
  per-category filters, pagination, and "Mark all read." The bell dropdown gained a "View all
  notifications" footer link.

### Added — Tournament vs Tournament comparison (Phase 35)
- New `/compare/tournaments` page, mirroring the existing Club/Season comparison layout: teams
  involved, matches, completed matches, runs scored, wickets taken, side by side. Extends the
  compare cross-link loop (players → teams → clubs → seasons → tournaments → back to players).

### Added — Activity feeds on entity detail pages (Phase 34)
- Club, Team, Player, and Tournament pages now embed a scoped `<ActivityFeed refId={id} />` (Team as
  its own card, Player/Tournament as a new "Activity" tab, Club as a new section) — previously this
  component's `refId` scoping was only ever used by the Dashboard's platform-wide feed.
- Documented a real limitation rather than overselling the feature: activity events only tag the
  *creation* event's own entity id, so a scoped feed today shows mainly its own "X was created"
  entry, not related match activity — see `ROADMAP.md` Phase 34 and `RESTRICTIONS.md` §4 for the
  follow-up this opens up.

### Added — Global search: Clubs (Phase 33)
- Clubs are now searchable from both the Command Palette and the public search page — previously
  the only first-class entity missing from `globalSearch()`.

### Added — Dashboard widget customization (Phase 32)
- New `store/dashboardLayoutStore.ts` (localStorage-only): the Dashboard's 6 widgets are now
  ordered/hidden via saved state instead of hardcoded; a "Customize" toggle reveals per-widget
  move-up/move-down/hide controls plus "Reset layout." Reordering stays within each of the two
  existing columns (match-related left, leaderboard-related right) rather than across, so the
  layout can't end up incoherent.

### Added — Error monitoring dashboard (Phase 31)
- Platform Tools' "Client errors" card now shows a 14-day trend chart, a 7-day total, and the
  most frequent error messages/routes — aggregated from the same `clientErrors` collection every
  client already writes to, no new instrumentation.

### Security review (Phase 30)
- Documentation pass, no code changes: confirmed no XSS escape hatches
  (`dangerouslySetInnerHTML`/`eval`/`innerHTML =`) and no reverse-tabnabbing risk
  (`target="_blank"`) exist anywhere in `src/`; confirmed CSRF doesn't apply to this app's
  bearer-token auth model; confirmed `.env.local` is properly gitignored.
- Found one real gap: no CSP/security response headers configured in `firebase.json`. Recorded as
  a deferred, recommended follow-up rather than implemented blind — this app's heavy use of inline
  `style={{}}` needs careful `style-src` scoping, and headers can only be verified against a real
  Firebase Hosting deploy, not local dev.

### Added — In-app release notes (Phase 29)
- New "What's new" button in the header opens a small panel of curated highlights, with a dot
  badge that clears once viewed. Bumped `package.json` off the placeholder `0.0.0` to `1.0.0`.

### Added — Audit log detail (Phase 28)
- Audit entries can now carry a `before`/`after` value and the acting client's `userAgent`. Wired
  into user role changes, suspend/reinstate, and feature-flag emergency-disable. Platform Tools'
  audit card shows the diff and a compact "Browser on OS" device summary.
- IP address deliberately not captured — no backend to observe a real request IP from, and a
  third-party geo/IP lookup isn't proportionate for this.

### Added — Media library (Phase 27)
- New `/admin/media` page: browse every image uploaded to Storage across players/teams/clubs/
  tournaments/users, with a running total (count + size) and delete. Flags images no longer
  referenced by any live entity as **Unused**, so cleanup targets are obvious at a glance.
- Fixed a real bug found while building this: Firebase Storage's `listAll()` hangs indefinitely on
  a folder that's never had an upload (every folder in this dev database, currently) — a raw REST
  call to the same prefix returns instantly, but the SDK call just never settles. Fixed with a
  client-side timeout that resolves to an empty list instead.

### Added — Activity feed milestones + filter (Phase 26)
- Completed matches now detect centuries, half-centuries, and five-wicket hauls
  (`domain/milestones.ts`, pure) and log them to the activity feed, notifying the player directly
  if their player record has a linked user account.
- Fixed a real staleness bug found during wiring: match-completion notifications were reading a
  stale `match.innings` at two of four call sites, which could have silently missed a milestone
  reached on the innings-ending ball.
- `ActivityFeed` gained an optional per-type filter chip row, enabled on the Dashboard.

### Added — Invitation system (Phase 25)
- New `/admin/invitations` (master-admin): offer an existing user a role (`ADMIN`, `SCORER`,
  `TEAM_MANAGER`, `TOURNAMENT_MANAGER`) via a shareable link (`/invite/{code}`, public route),
  with an optional note and configurable expiry. Replaces having to notice a self-serve admin
  request — the master admin can proactively grant a role and the target user just accepts.
- Accept grants the role immediately and notifies the inviter; decline/cancel/resend all
  supported. Expiry is resolved lazily (`effectiveStatus()`), matching the Trash retention
  pattern — no backend cron in this client-only app.
- New `invitations` Firestore collection + rules (invitee can respond to their own pending
  invite; only the master admin can create/cancel/read-all).

### Added — Legal & compliance pages (Phase 24)
- New `/privacy` and `/terms` pages with project-specific content (not boilerplate) describing what
  CricketHub actually stores/shows, each carrying an explicit "template, needs real legal review"
  disclaimer. Linked from the public-site footer and a new consent notice on `/signup`.

### Added — Scoring keyboard shortcuts (Phase 23)
- Live Scoring page: `0`/`1`/`2`/`3`/`4`/`6` for runs, `W` Wicket, `Q`/`N`/`B`/`L` for Wide/No
  ball/Bye/Leg bye, `U` Undo, `E` End innings, `Esc` cancels a selected extra. Ignored while
  Ctrl/Cmd/Alt is held or a text field is focused; disabled mid-write.
- Every score-pad button now shows its key as a corner badge; a new "Shortcuts" button opens a
  full reference modal. Scoped to the Scoring page specifically (where the productivity win is
  real), not retrofitted onto every page speculatively.

### Added — Platform analytics (Phase 22)
- New `/admin/analytics` page (`domain/platformAnalytics.ts`, pure) + `components/charts/
  GrowthChart.tsx`: headline totals, 30-day growth counts, active-clubs/active-scorers (both
  derived from real match data, not logins), and daily signup/match bar charts.
- True DAU/MAU isn't tracked (no session log in this client-only app) — the page says so directly
  rather than implying something it doesn't measure.
- Fixed a real crash found during verification: `bucketByDay()` threw on a malformed `createdAt`
  in existing data; now skips non-finite timestamps instead of crashing.

### Added — Feature flags framework (Phase 21)
- New `FeatureFlag` type + `services/featureFlags.service.ts` + `domain/featureFlags.ts`
  `isFlagEnabledFor()` (pure): global on/off (`enabled` — the emergency-disable path), a
  deterministic percentage rollout (`rolloutPercent`, hashed per user so it's stable across
  reloads, not random each time), and beta-only gating (`betaOnly`, tied to a new "Beta features"
  toggle in `Prefs`/Settings).
- New `hooks/useFeatureFlag(key)` + admin page `/admin/feature-flags` (master-admin, nav entry):
  create/edit/delete flags, one-click enable/disable per row. Audit-logged.
- Club-specific flags deferred (see `RESTRICTIONS.md`); no flags gate an actual feature yet — this
  is prepared architecture for the next experimental feature to opt into.

### Added — Maintenance mode (Phase 20)
- New `AppSettings.maintenance` (`enabled`/`message`/`estimatedEndAt`) + "Maintenance mode" card
  on Platform Settings. When enabled, every visitor except the master admin sees a full-screen
  `MaintenanceScreen` (custom message, optional ETA) instead of the app — checked once at the
  `App.tsx` root, gated on `isMasterAdmin()` so the admin can always get back in to disable it.

### Added — Compare clubs & seasons (Phase 19)
- New `/compare/clubs` and `/compare/seasons` pages complete the compare-mode set (player/team
  comparisons already existed). `domain/clubCompare.ts` rolls up a club's teams' `TeamStats`;
  `domain/seasonCompare.ts` rolls up every match inside any tournament under that season.
- The four compare pages now cross-link in a loop: players → teams → clubs → seasons → players.
- Venue vs Venue not built — Venue isn't a first-class entity in this app (see `RESTRICTIONS.md`).

### Added — Version history for edits (Phase 18)
- New `services/versionHistory.service.ts` (`snapshotVersion()`/`listVersions()`/
  `restoreVersion()`) + `EntityVersion` type + `entityVersions` collection: Players, Teams, Clubs,
  Tournaments and Matches now snapshot their pre-edit state (with a diffed `changedFields`
  summary) before every save; restoring a version snapshots the current state first too, so
  restores are themselves undoable.
- New reusable `components/ui/VersionHistoryModal.tsx` — a "History" button next to Edit on the
  Players/Teams/Tournaments/Clubs list pages shows every past edit (editor, timestamp, what
  changed, optional reason) with a per-entry Restore action.
- `firestore.rules`: public read, `canManage()`-gated create, immutable once written.

### Added — Data integrity tools (Phase 17)
- New `domain/dataIntegrity.ts` (pure) + `services/dataIntegrity.service.ts`: detects broken team
  rosters/captain refs, orphaned tournament team lists, broken club/season links, and orphaned
  `playerStats`/`teamStats` cache docs — checked against full (trashed-inclusive) id sets, so a
  reference to a merely-trashed doc is never flagged, only ids that never existed or were
  hard-deleted.
- Every repairable issue is metadata/cache-only (safe to fix with one click); dangling match-squad
  references are reported as informational only, with no repair button — historical scorecards are
  never auto-rewritten.
- New "Data integrity" card on Platform Tools with a "Fix" button per repairable issue, audit-logged.

### Added — Saved filter presets on Stats (Phase 16)
- New `store/savedFiltersStore.ts` (localStorage, mirrors `favStore`'s local-only pattern) +
  `components/ui/SavedFiltersBar.tsx`: name and restore the current competition/venue/team/club/
  season/year filter combination on the Stats page in one click. "Save current filter" only shows
  once at least one filter is non-default; restoring bypasses the normal scope-change reset so the
  saved combination applies atomically.

### Added — Error recovery & client diagnostics (Phase 15)
- `components/ErrorBoundary.tsx`: every caught error now gets a short reference id, a "Reload
  page" button (full reload, distinct from the existing in-place "Try again" reset) and a "Copy
  diagnostics" button (reference id/URL/timestamp/message/stack to clipboard). Picked up the
  `dark:` variants it had missed from the Phase 4 theme pass.
- New `services/errorLog.service.ts` + `clientErrors` collection: `ErrorBoundary` best-effort logs
  every catch (never throws, never blocks the recovery UI) with the same reference id, message,
  stack, route and actor uid if signed in.
- New "Client errors" card on Platform Tools — last 50 logged errors for the master admin.
  `firestore.rules`: publicly writable (errors can happen pre-login), master-admin-only read.

### Added — Activity feeds (Phase 14)
- New `services/activity.service.ts` (`logActivity()`/`listActivity()`) wires up the previously
  unused `ActivityLog` type/`activity` collection — writers on player/team/club/tournament/match
  creation and match start/completion, a new `club_created` type.
- New reusable `components/activity/ActivityFeed.tsx` (platform-wide, or scoped to one entity via
  `refId`), embedded on the Dashboard as "Recent activity".
- `firestore.rules`: public read, signed-in create, immutable once written.

### Added — Command palette (Phase 13)
- Global `Ctrl+K`/`Cmd+K` overlay (`components/layout/CommandPalette.tsx`), mounted once in
  `AppShell` so it's available from any signed-in page. Reuses `services/search.service.ts`'s
  `globalSearch()` for live player/team/tournament/match results, plus a role-filtered list of
  every nav destination as a jump-to "command" (same set `AppShell`'s sidebar already shows).
  Arrow keys/Enter/Escape navigate; a "Search ⌘K" button in the header opens it for anyone who
  doesn't know the shortcut.

### Added — Media uploads for player photos / team & club logos (Phase 12)
- New `services/storage.service.ts`: validates type (JPEG/PNG/WebP/GIF) and size (5MB max),
  downscales/re-encodes to a max-800px JPEG client-side before upload (GIFs pass through
  unresized), uploads to Firebase Storage, returns the download URL.
- New reusable `components/ui/ImageUploadField.tsx` — URL text input (existing manual-entry
  behaviour preserved) plus an "Upload" button; wired into `PlayerFormModal`, `TeamFormModal`
  (which previously had no logo field in its UI at all), and `ClubFormModal`.

### Added — Notification center (Phase 11)
- New `services/notifications.service.ts` + `AppNotification`/`NotificationCategory` types: a
  per-user `notifications` collection with `notify()`/`listNotifications()`/
  `subscribeNotifications()`/`markRead()`/`markAllRead()`.
- New header **bell** (`components/layout/NotificationBell.tsx`) with a live unread badge
  (`onSnapshot`) and dropdown panel; clicking a notification marks it read and follows its link.
- Wired into concrete existing actions rather than a generic event bus: admin request
  approved/declined, role changed, account suspended/reinstated, player profile merged, match
  completed/abandoned (every completion path — auto-complete, declare, explicit complete, and
  abandon).
- New **Notifications** card on Settings — per-category mute toggles (`Prefs.notifyMuted`, synced
  cross-device); muting hides a category from the bell without deleting the underlying records.
- `firestore.rules`: any signed-in user may create a notification (always for someone else, as the
  side effect of an action they're already permitted to take); only the recipient or master admin
  can read/update/delete it.
- Queries filter by `userId` only and sort/cap client-side rather than adding `orderBy` — avoids
  needing a composite Firestore index this project doesn't ship (matches `listAllMatches`'s
  existing "sorted client-side" approach).

### Added — Data lifecycle management: Trash, restore, permanent delete (Phase 10)
- Players, Teams, Clubs, Seasons, Tournaments and Matches gained optional `deletedAt`/`deletedBy`
  fields. The "Delete" buttons on their list pages now soft-delete via the new
  `services/trash.service.ts` instead of hard-deleting — the doc disappears from every list/browse
  surface immediately but nothing referencing it is rewritten, so restoring is exact.
- New **Trash** page (`/admin/trash`, nav entry for the same roles as `canManage`): every
  soft-deleted doc across all six entity types, per-type filter chips, per-row and bulk
  Restore/Permanently-delete, and a "Purge expired now" action once items pass the retention
  window.
- New `AppSettings.trashRetentionDays` (default 30), editable on Platform Settings — drives the
  "expired" banner/badge on the Trash page and `purgeExpired()`. No backend cron exists in this
  client-only app, so cleanup is an explicit manual trigger, matching `forceResync()`'s existing
  honest-best-effort pattern rather than a fabricated schedule.
- `purgeMatch()` (`scoring.service.ts`) now also cleans up the `ballMeta` subcollection alongside
  `deliveries` when a match is permanently deleted — it previously only cleaned `deliveries`,
  predating `ballMeta`'s introduction in Phase 2.
- Every trash/restore/permanent-delete action is audit-logged.

### Fixed — Custom background now darkens in dark mode (Phase 4)
- `BackgroundLayer.tsx` previously painted the user's chosen background gradient/solid/preset
  (`bgStore`) at full brightness regardless of theme, so dark mode looked like a dark frame around
  a still-light backdrop. Added a `mix-blend-mode: multiply` overlay whose opacity is derived from
  `configLuminance()` (new helper in `store/bgStore.ts`, averages the relative luminance of the
  config's colour stops): near-zero for an already-dark pick like the "Midnight" preset, up to 0.85
  for light pastel ones (the default background, "Pitch", "Sunset", "Ocean"). A flat "always darken
  by X in dark mode" would have either barely touched light presets or crushed Midnight to black;
  this scales per-config instead. Verified in the browser: toggled the theme switch and confirmed
  the overlay's opacity flips live between `0` and `0.85` with no reload.

### Added — Wagon wheel & bowling line/length map (Phase 2)
- **`BallMeta`** (`types/index.ts`): an optional per-delivery shot-zone (1-8) / bowling line /
  bowling length tag, stored as a sibling doc (`matches/{id}/ballMeta/{deliveryId}`,
  `services/ballMeta.service.ts`) rather than a field on `Delivery` — the scoring engine
  (`domain/scoring.ts`) builds `Delivery` as one explicit object literal with no field-pass-through
  and is off-limits to modification, so this is written separately, after `recordBall()` already
  returned, and the engine never touches or depends on it.
- **`ShotDetailPrompt`** on the Scoring page: a dismissible, fully optional add-on shown after each
  ball — 8-zone shot placement plus bowling line/length quick-select chips. Tapping a chip saves
  immediately (merge-write, so zone/line/length can be tagged independently); "Skip" or recording
  the next ball closes it. Never blocks or slows the primary scoring flow.
- **`domain/wagonWheel.ts`** / **`domain/pitchMap.ts`**: pure aggregation of deliveries + `BallMeta`
  into per-zone run/ball counts and per-line×length ball/run/wicket counts.
- **`WagonWheel`** (8-sector SVG, sector size scales with runs) and **`PitchMap`** (line×length
  heatmap table) chart components, shown on the match page only once real tagged data exists for
  that match — no fabricated placeholder when nothing's been tagged.
- Verified live in the browser: scored a real ball in an in-progress match, tagged it "Long-on",
  confirmed the wagon wheel rendered on the public match page with the 4 runs in that sector.

### Added — Password recovery verification quiz, rate limiting, audit (Phase 3)
- **Verification quiz** on `/recover` (`domain/recoveryQuiz.ts` `buildRecoveryQuestions()`, wired
  into `RecoverPage.tsx`): once a matching account is found, its linked player's real role and
  current team become multiple-choice questions with decoys drawn from other real roles/teams, so
  they can't be guessed from the options' structure. Only after every question is answered
  correctly does the page reveal the username — previously the fuzzy name match revealed it
  immediately, a real account-enumeration gap for anyone else's real name.
- **Client-side rate limiting**: 5 failed quiz attempts locks recovery on that browser for 15
  minutes (`localStorage`-tracked). Explicitly scoped as a best-effort browser-level cooldown, not
  a real rate limiter — there's no backend in this project to enforce one server-side (per-IP or
  per-account), so a determined attacker rotating browsers/storage isn't stopped. It stops the
  casual case.
- **Recovery audit trail**: every attempt — quiz passed, quiz failed, rate-limited, or no quiz
  available to build (accounts without a linked player) — is written to the new `recoveryAttempts`
  Firestore collection (`services/recovery.service.ts`). `firestore.rules` allows public `create`
  (the flow runs before login, so there's no authenticated actor to gate on) but restricts `read`
  to the master admin, same shape as `adminRequests`.

### Added — Duplicate-player detection on the merge tool (Phase 9)
- **"Suggested duplicates" panel** on `/admin/merge-players` (`domain/duplicateDetection.ts`
  `findDuplicateCandidates()`): pairwise Levenshtein-distance similarity over active players'
  full/display names (normalised the same forgiving way as `/recover` — lowercase, punctuation
  stripped, whitespace collapsed), flags pairs at ≥75% similarity, and notes when they already
  share a team as a stronger signal. One click on "Review" pre-fills the existing keep/merge
  pickers — nothing is merged automatically, this only surfaces candidates an admin would
  otherwise have to already suspect by name. Deliberately scoped to detection over *existing*
  data, not "import" — that half of the roadmap item needs a source format nothing in this
  project defines. Verified live: created two near-duplicate test players ("Test Duplicate
  Player" / "...Playre"), confirmed the panel surfaced them at 90% similarity with a working
  "Review" button, then deleted the test data.

### Added — Dark mode extended to the shared UI kit and most pages (Phase 4)
- **Shared primitives now theme-aware**: `Card`, `CardHeader`, `Modal`, `Badge` (all six tones),
  `Button` (all variants), `Input`/`Select`/`Textarea`/`Field`/`Label`, `Tabs`, `EmptyState`,
  `StatCard`, plus the toast, `Pagination`, and `FollowButton` components all gained `dark:`
  variants. Previously the theme toggle only recoloured app-shell chrome (sidebar/header/footer);
  the actual card/table/form content on every page stayed hardcoded light, so dark mode looked
  like a dark frame around white boxes. This is the fix.
- **39 feature/chart page files** swept for `text-ink-*`/`border-ink-*`/`bg-white`/`bg-ink-*`
  utilities and given matching `dark:` counterparts (538 substitutions total), covering the
  Dashboard, Players/Teams/Tournaments/Clubs & Seasons/Matches admin pages, auth pages, all four
  chart components, and most public pages (Home, Browse, Search, Compare, Club, Season, plus the
  Stats page). Verified in the browser: sampled 158 real text elements on the Stats page in dark
  mode, checked each against its resolved ancestor background — 157/158 passed a computed-style
  contrast check (the one flagged was a false positive from an `oklab()` colour the check script
  couldn't parse, not an actual contrast bug).
- **`MatchPage`, `PlayerPage`, `TournamentPage` and the Settings page intentionally held back**
  this pass — they had concurrent, unrelated work landing in them at the same time (win
  probability, PDF export, privacy & sessions, qualification/timeline), and editing a file mid-flight
  under another change risks clobbering it. **Follow-up, once that work settled**: same treatment,
  219 more substitutions across those 4 files (43 total now, up from 39). Verified in the browser:
  0 low-contrast text elements found across 465 sampled elements on the Match/Player/Tournament/
  Settings pages (vs. the Stats-page-only sample from the first pass) — including confirming the
  tournament page's `<h1>` title, which had gone black-on-black when `Card`'s background flipped
  dark under it without a matching text colour, is now readable.

### Added — Match win probability, PDF export, privacy & sessions (Phases 2, 4, 9)
- **Win-probability bar** on the live match page (`domain/winProbability.ts` `chaseWinProbability()`):
  while a side is chasing, a labelled progress bar shows a heuristic win-probability estimate built
  from the required run rate vs. an achievable-rate curve that scales with wickets in hand — deliberately
  labelled "heuristic estimate", not a trained model, since there's no historical ball-by-ball dataset
  in this app to fit one on.
- **PDF export**: "Print / Save as PDF" buttons on the Match, Tournament, and Player pages, reusing
  the app's existing print stylesheet via `window.print()` — the standard client-only route to a real
  PDF (the browser's own print dialog) rather than shipping a PDF-rendering library to reproduce what
  the browser already does.
- **Privacy & sessions** card on the Settings page: states plainly what's public (nothing
  account-related — only display name where credited as a scorer) vs. visible to other admins
  (bio/email, needed to manage roles) and why; shows the current session's sign-in time and a
  "Sign out this device" action. Cross-device session listing/remote revocation needs a
  server-side Admin SDK this project doesn't run, so that limitation is documented rather than faked.

### Added — Tournament qualification tracker & timeline (Phase 5)
- **Qualification tab** on group_knockout tournaments (`domain/qualification.ts`
  `groupQualification()`): per group, marks each team `qualified`, `eliminated`, or `contention`.
  Deliberately conservative and mathematically sound in both directions — `eliminated` only when
  enough other teams have *already* banked more points than this team could ever reach; `qualified`
  only when fewer than the advancing-team count could ever catch or tie this team's current points.
  A tie sitting exactly on the cutoff (which real standings resolve via NRR) is left as
  `contention` rather than guessed. New optional `Tournament.qualifiersPerGroup` field (default 2),
  set alongside group assignment on the tournament form.
- **Timeline tab** (`domain/tournamentTimeline.ts` `tournamentTimeline()`): every match in the
  tournament ordered by played/scheduled date — a chronological read distinct from the unordered
  Fixtures & Results list.

### Added — Merge duplicate player profiles (Phase 3)
- **Master-admin merge tool** at `/admin/merge-players` (`PlayerMergePage`, nav entry "Merge
  Players"): pick a profile to keep and a duplicate to fold into it. `mergePlayers()`
  (`services/playerMerge.service.ts`) batch-rewrites every stored reference to the duplicate's id —
  `Team.playerIds`/`captainId`/`viceCaptainId`, `Match.squadA`/`squadB`/`playerOfTheMatchId`, every
  innings' `battingCard`/`bowlingCard`/`fallOfWickets`/striker-non-striker-bowler ids, and every
  ball in the match's `deliveries` subcollection — onto the kept player, merges `teamIds`, then
  calls `recomputeAllStats()` so cached leaderboards reflect the merge, and finally deletes the
  duplicate's `playerStats` doc and player doc. A confirmation modal spells out the irreversible
  effect before committing; the merge is audit-logged (`player.merge`).

### Added — Player account lifecycle (Phase 3)
- **Auto-create linked login on player create**: `PlayerFormModal` gained a "Create a linked login
  account" checkbox (on by default for new players). On save, `createLinkedAccount()`
  (`services/auth.service.ts`) generates a unique `user######` username and a random 12-char temp
  password, creates the Firebase Auth user, writes its `users/{uid}` profile as
  `pending_registration`, and stores `Player.linkedUserId`. The admin sees the credentials exactly
  once in a copy-to-clipboard dialog they must acknowledge before closing (Firebase never exposes
  a plaintext password again once set).
  - **The session-hijack problem**: the Firebase client SDK signs in as whichever user
    `createUserWithEmailAndPassword` just created — calling it on the primary `auth` instance while
    creating an account *for someone else* would silently switch the signed-in admin to the new
    (empty, pending) account. Fixed with the standard client-side workaround: a throwaway secondary
    `initializeApp` instance handles the creation and is torn down immediately after, leaving the
    admin's own session on the primary instance untouched.
- **First-login activation** (`/activate`, `ActivatePage.tsx`): `ProtectedRoute` redirects any
  `pending_registration` account here before any other route. The account picks a real password
  and display name and becomes `active` (`activateAccount()`).
  - **Scoped down from "choose username" to "keep the assigned username, change password"**: the
    original plan let the user pick a new username at activation too, but usernames map to a
    synthetic email, and changing it means calling Firebase Auth's `updateEmail` — which, on
    projects with email enumeration protection (the default for new Firebase projects), requires
    verifying the new address before it applies. There's no real mailbox behind the synthetic
    domain, so that verification could never complete. This was discovered by actually hitting the
    error in the browser (`auth/operation-not-allowed`), not anticipated in advance — fixed by
    dropping the username-change path entirely rather than working around Firebase's own security
    feature. `ActivatePage` now shows the assigned username read-only for reference.
- **Firestore rules**: `users/{uid}` create now also allows an admin to create a `VIEWER` +
  `pending_registration` doc for a different uid (previously self-only); `update` now allows the
  one `pending_registration -> active` self-transition (previously status was fully self-immutable).
  Both are narrowly scoped — an admin still can't grant themselves or anyone else an elevated role
  or a status other than the pending-signup one through this path.
  Verified fully end-to-end in the browser: created a real player with a linked account, captured
  the generated username/password from the actual dialog, logged in with those temp credentials
  and confirmed `status: "pending_registration"` plus the redirect-to-`/activate` guard (tried
  navigating to `/dashboard` directly — still landed on `/activate`), completed activation with a
  new password, confirmed the Firestore profile flipped to `status: "active"`, confirmed the *old*
  temp password no longer matters and the *new* password logs in successfully, confirmed navigating
  to a normal protected route no longer redirects, then fully cleaned up (deleted the Firebase Auth
  user, the `users` doc, the `usernameLookup` doc, and the test player).

### Added — Scoped ARIA accessibility pass (Phase 9)
- **`Modal`** (used by every form dialog in the app): `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby` pointing at the title (via `useId()`, so it's collision-safe even if two
  modals were ever open at once), and `aria-label="Close"` on the X button.
- **Danger-zone confirm dialog** (Platform Tools' "Clear all leaderboards"): same `role="dialog"`/
  `aria-modal`/`aria-labelledby` treatment (it's a hand-rolled dialog, not the shared `Modal`).
- **Toast notifications**: the container gained `role="status" aria-live="polite"` so screen
  readers announce new toasts; the dismiss button gained `aria-label="Dismiss notification"`.
- **Icon-only edit/delete buttons**: grepped for every bare `<Pencil>`/`<Trash2>` button in the
  app and added a row-specific `aria-label` (e.g. `"Delete Riverside CC"`, not just `"Delete"`) —
  found genuinely unlabelled ones on Teams, Tournaments, Clubs & Seasons (both clubs and seasons)
  and Matches; Players' buttons already had `title` but gained `aria-label` too for reliability.
  - **Scope decision**: this isn't a claim of full WCAG compliance — a truly exhaustive audit
    (every interactive element, contrast ratios, keyboard-trap testing, live-region tuning across
    every page) is unbounded and can't be meaningfully completed or verified in one slice. This
    targeted the shared dialog/toast primitives (fixing them once fixes every usage) plus the
    concrete icon-button gaps a grep surfaced, the same bounded-but-real approach used for dark
    mode and the colour-blind palette.
  - Verified in the browser: opened a real form modal and confirmed (via the actual DOM, not
    source reading) `role="dialog"`/`aria-modal="true"`/`aria-labelledby` resolved to the visible
    title text, and the close button's `aria-label`; triggered a real save action and confirmed
    the toast region had `role="status"`/`aria-live="polite"` with the dismiss button labelled;
    confirmed the Teams page's Edit/Delete buttons carry `aria-label="Edit x"`/`"Delete x"`. No
    console errors.

### Added — Offline force-resync (Phase 1 & 7)
- **`forceResync()`** (`services/diagnostics.service.ts`): drops and re-establishes the Firestore
  network connection (forcing every active listener to re-subscribe), then waits for any writes
  queued while offline to be acknowledged by the backend — raced against an 8s timeout so it
  reports "still pending" instead of hanging forever if genuinely offline (`waitForPendingWrites`
  never resolves with no connection).
- **"Force resync" button** on Platform Tools, next to the online/offline badge.
  - **Scope decision, documented in ROADMAP**: a literal "queue-inspection page" listing
    individual pending writes isn't implementable — the Firestore client SDK's offline mutation
    queue is internal, with no public API to enumerate what's queued. This ships the part that's
    real and honestly exposable (force a resync, know whether it flushed and how long it took)
    rather than fabricating a fake queue list.
  - Verified: called the service function directly (online, resolved `flushed: true` in single-
    digit ms), then clicked the actual button and confirmed the toast read "Resynced in 78ms" with
    no console errors.

### Added — Client-side pagination (Phase 9)
- **`usePaginated<T>()`** hook (`hooks/usePaginated.ts`): slices an already-fetched array into
  pages, clamping automatically when the underlying list shrinks (e.g. a filter narrows the
  results) so callers never need to manually reset page state.
- **`Pagination`** component (`components/ui/Pagination.tsx`): "Showing X–Y of Z" + prev/next,
  renders nothing when there's only one page.
- Wired into the four admin list pages: **Players** (table, 20/page), **Teams** and
  **Tournaments** (grids, 12/page), **Matches** (list, 15/page).
  Verified in the browser: confirmed pagination stays hidden with the current real record counts
  (all under their page size — no regression), then created 10 throwaway players to push the
  total past 20, confirmed "Showing 1–20 of 22 · Page 1 of 2" rendered with exactly 20 rows,
  clicked Next and confirmed page 2 showed exactly the remaining 2 rows with Next correctly
  disabled, then deleted the throwaway players. Smoke-tested Teams/Tournaments/Matches for no
  console errors.

### Added — Colour-blind friendly palette (Phase 9)
- **`colorBlind` preference** (`prefsStore`), synced cross-device like the other appearance prefs.
  Toggles a `.colorblind` class on `<html>` that remaps the `pitch-*` (green) CSS variable scale to
  teal — teal stays clearly distinct from red for red-green colour blindness (the most common
  form), unlike green vs red.
  - **Scope decision**: `pitch` is the app's one consistent "positive/win" accent token (23 files),
    so remapping it is a single coherent change with full coverage of every Tailwind-class usage —
    the same reasoning the dark-mode work used (a targeted token swap beats hundreds of individual
    fixes). Two spots used inline hex instead of the token (`TeamPage`'s form-result chip,
    `TeamForm` chart's win-bar colour) and were switched to reference the CSS variable/Tailwind
    class so they pick up the override too. Decorative single-hue icon accents (e.g. record-card
    icons, batting-form intensity gradients) were deliberately left alone: they don't encode
    information via a colour-only red/green contrast, so they're not a colour-blind accessibility
    gap, and touching them would be exactly the kind of broad, hard-to-verify change avoided
    elsewhere in this pass.
  - Verified: toggled via the actual Settings switch (not just the store) and confirmed
    `document.documentElement` gained/lost the `colorblind` class; checked real computed colour
    (`getComputedStyle`) on both a CSS-variable consumer (`--color-pitch-600` itself, `#16a34a` ->
    `#0d9488`) and a class consumer (`text-pitch-700` on the Stats page Teams tab win column,
    `#15803d` -> `#0f766e`), then toggled back and confirmed it reverted. No console errors.

### Added — Club profile pages, season archive & hall of fame (Phase 8)
- **`ClubPage`** (`/club/:id`): club header (logo/initials, short name, home venue, description),
  and three linked lists — teams, seasons, tournaments — each filtered by `clubId` from the
  already-fetched collections (no new queries).
- **`SeasonPage`** (`/season/:id`): season header (status badge, dates, link back to its club),
  its tournaments, and a "Hall of fame" — top 5 run-scorers and wicket-takers aggregated across
  every completed match in every tournament that belongs to the season. Reuses
  `aggregatePlayerStats`/`topRunScorers`/`topWicketTakers` from `domain/stats.ts` unchanged (a
  season's hall of fame is just player stats scoped to a wider match set than a single
  tournament).
- **Wiring**: routes added to `App.tsx`; the admin Clubs & Seasons page's "View" links (removed
  earlier since the routes didn't exist yet) now point here; the club/season names already shown
  on the public Team/Tournament pages are now links instead of plain text.
  Verified end-to-end in the browser: created a real club + season, linked them to a real team and
  a real tournament with completed-match data, confirmed both new pages rendered the linked
  entities correctly (including a hall of fame with real top scorers/wicket-takers), confirmed
  every cross-link (Team -> Club, Tournament -> Club/Season, admin "View" -> public page) resolved
  to the right URL, then reverted the team/tournament and deleted the throwaway club/season.

### Added — Light/dark/system theme (Phase 4)
- **Theme preference** (`light`/`dark`/`system`) in `prefsStore`, synced cross-device the same way
  as the other appearance prefs (text scale, density, etc.), plus a live `matchMedia` listener so
  "System" tracks OS theme changes without a reload. Toggled via a Light/Dark/System pill row on
  the Settings Appearance card, next to the existing text-size/density controls.
  - **Scope decision**: dark mode is applied to the app-shell chrome only — `body` background,
    `AppShell`/`PublicLayout` header/footer/nav, and `PageHeader` (the title used at the top of
    nearly every page). Individual pages' own card content keeps its current light styling.
    Traced through why a blanket approach would break things first: (1) redefining the `ink-*`
    colour-scale CSS variables under `.dark` would auto-flip every `bg-ink-900`/`text-ink-900`
    utility in the app, including ones that are *intentionally* always-dark regardless of theme
    (the sidebar, modal backdrop, toasts — 9 files rely on this); (2) adding `dark:` variants to
    every page's own raw `text-ink-900`/`bg-white` JSX (outside the shared primitives) is hundreds
    of instances across 40+ files, too large to complete and visually verify in one slice; (3) a
    first attempt without touching `PageHeader` left every page's `<h1>` dark-on-dark against the
    new dark page background, confirmed via `preview_inspect` computed styles before shipping —
    fixed by giving `PageHeader` (used everywhere) explicit `dark:` text classes. The result: every
    page gets a coherent dark frame (nav, background, title) without the contrast risk; full
    per-page content theming is called out as follow-up work in ROADMAP and in a hint under the
    Settings toggle.
  - Verified via the actual Settings toggle (not just the domain function): clicking Dark/Light/
    System updates the `<html class="dark">`, persists to `localStorage`, and correctly flips
    computed `background-color`/`color` on the AppShell header (`#0f172a`), sidebar (unchanged,
    already dark), `PublicLayout` header/footer, and `PageHeader` title/subtitle — checked with
    `preview_inspect` on real computed styles, not screenshots. No console errors.

### Added — Club/season/year filters on the Stats page
- **`StatsPage`**: three more composable filters alongside the existing Competition/Venue/Team —
  Club, Season and Year. Club/Season options come from resolving each scoped match's tournament to
  its club/season (same lookup-map approach as the new player season splits); Year comes from each
  match's completion/scheduled/created date. All three follow the existing non-cross-narrowing
  pattern (options derived from the competition-scoped match set, not from each other) and stay
  hidden until there's real data to filter by — so the page is unchanged until clubs/seasons are
  actually configured. Selecting a competition resets all five downstream filters, matching the
  existing venue/team reset behaviour.
  Verified in the browser: confirmed Club/Season selects were absent with no linked data, then
  temporarily linked a real tournament (with a real completed match) to a throwaway club+season,
  reloaded, confirmed all six filters rendered with the right option lists, exercised each new
  select without errors or a broken total, then reverted the tournament and deleted the throwaway
  club/season.

### Added — Season splits on the player page
- **`playerSeasonSplits()`** (`domain/playerSplits.ts`, next to the existing
  `playerTournamentSplits`): buckets a player's completed matches by season, via a caller-supplied
  tournamentId -> seasonId lookup (matches only carry a tournamentId) plus a seasonId -> name
  lookup. Reuses `aggregatePlayerStats` so a season row means exactly what the career figures mean.
- **`PlayerPage`**: a "By season" tab appears once the player has at least one completed match
  under a tournament that belongs to a season (i.e. only when there's real season data — a
  brand-new feature with no seasons configured yet stays invisible rather than showing an
  all-"No season" table). Verified the domain function against a synthetic 2-match/2-tournament
  dataset, then end-to-end: temporarily linked a real tournament with real match/player data to a
  throwaway season, confirmed the tab appeared and the row's runs/matches exactly matched the
  player's Overview stats, then reverted the tournament and deleted the throwaway season.

### Added — Group tables for group_knockout tournaments
- **`domain/groups.ts`**: `groupStandings()` buckets a tournament's `teamIds` by an optional
  `Tournament.teamGroups` map (team id -> group label) and reuses `computeStandings` per group —
  pure derivation, no new stats logic. Teams left ungrouped are simply omitted.
- **`TournamentFormModal`**: when format is "Group + Knockout", a group-assignment row (team name
  + short label input, e.g. "A"/"B") appears per selected team.
- **`TournamentPage`**: a "Groups" tab appears once at least one team has a group assigned,
  rendering one standings table per group (extracted the existing standings table into a shared
  `StandingsTable` component so the main Standings tab and each group render identically).
  Verified end-to-end in the browser: created a group_knockout tournament, assigned the two
  existing teams to groups A/B, confirmed the saved `teamGroups` map and that each group's table
  showed only its own team with no cross-group leakage; also unit-verified the domain function
  against a synthetic 4-team/2-group dataset with a real result (points/NRR isolated per group).

### Added — Club & Season wired into Team/Tournament (Phase 8, slice 2/2)
- **Team and Tournament form pickers**: `TeamFormModal` gained an optional Club select;
  `TournamentFormModal` gained optional Club and Season selects. `TeamsPage`/`TournamentsPage`
  fetch and owner-scope the club/season lists and pass them down, matching the existing
  team-picker pattern.
- **Public display**: `TeamPage` and `TournamentPage` show the club (and season) name next to
  the existing team/tournament summary line when set, resolved the same way team/tournament names
  already are (looked up from the fetched collection, silently omitted when unset).

### Added — Club & Season entities (Phase 8, slice 1/2)
- **`Club` and `Season` domain types** (`types/index.ts`): a club is a top-level organisation
  (name, short name, logo, home venue); a season is a time-boxed period (name, status,
  start/end dates) optionally scoped to a club. Both are additive — `Team.clubId` and
  `Tournament.clubId`/`seasonId` are optional fields, so every existing team/tournament doc
  keeps working unchanged (no migration needed).
- **`services/clubs.service.ts` / `services/seasons.service.ts`**: CRUD mirroring the existing
  teams/tournaments service pattern (list/get/create/update/delete, `pruneUndefined` on writes).
- **"Clubs & Seasons" admin page** (`/clubs`, master admin + admins, owner-scoped like Teams):
  tabbed Clubs/Seasons management, season form's club picker lists the signed-in admin's own
  clubs. Firestore rules added for both collections (public read, owner-or-master write).
  Verified end-to-end through the actual UI: created a club, created a season linked to it
  (dropdown correctly listed the new club), confirmed both counters and rows updated with no
  console errors, then deleted both to leave the database clean.

### Added — Self-service account data export
- **"Export my data" button** on the Settings page's Account card: downloads the signed-in user's
  own profile fields and appearance/accessibility preferences as JSON. Client-side, no extra
  service calls (both are already in memory). Verified the export payload shape and download path
  directly (route is sign-in gated, so not click-through-able in this preview).

### Added — Momentum indicator
- **Momentum tile** in Match Insights (`domain/insights.ts`): the last (up to) 3 overs' run rate
  vs the innings' overall rate so far, labelled accelerating/slowing/steady — computed in the same
  per-over pass as the other insights, no extra delivery reads. Verified by independently
  hand-computing the same window from raw deliveries and matching the function's output exactly
  (8.57 rpo last-3 vs 9.16 rpo overall → "slowing").

### Added — Team filter on Stats
- **Team filter on the Stats page**, alongside competition and venue: narrows every board to
  matches involving a single team, composing with the other two. Team names resolve from
  denormalised match data. Verified the filter logic directly (0 matches for a non-existent team
  ID vs 1 match/12 players for a real one) since the seed data has only one match to exercise
  through the UI itself — filtering to one team correctly still shows the opponent in the Teams
  tab, since both played that shared match.

### Added — Per-tournament rank
- **Rank column** on the player "By tournament" tab: where the player stands by runs within that
  specific tournament (as opposed to the existing platform-wide rankings strip on Overview),
  computed by re-aggregating that tournament's own matches. Verified against the seeded data
  (#1 in CricketHub Cup, consistent with the platform-wide #1 Runs rank).

### Added — Player radar profile
- **Six-axis radar/spider chart** on the player Overview (`domain/radar.ts` +
  `components/charts/PlayerRadar`): Runs, Average, Strike rate, Wickets, Economy and Fielding,
  each normalised 0-100 against fixed benchmarks (not other players) — a shape, not a ranking,
  with the raw stat shown in a legend below. New SVG chart type (polar, not bar/line); verified
  the polygon geometry against hand-calculated trigonometry and the normalisation math against a
  hand-calculated synthetic stat line, then confirmed against the real seeded player's stats.

### Performance
- **Batched the backup export's delivery reads** — `gatherPlatformBackup()` now fetches every
  match's deliveries concurrently (`Promise.all`) instead of one round-trip at a time; read-only,
  so there's no ordering concern. Verified identical output (66 deliveries across 2 matches,
  matching the pre-change result).

### Added — Live projected score & chase-rate comparison
- **Projected score** on the live match panel for a first innings: the standard "on this run
  rate" extrapolation from current run rate over the balls remaining (`projectedScore` in
  `lib/format.ts`). For a chase, the panel now also shows the **required run rate** and an
  **"Ahead"/"Behind" by X runs/ov** comparison against the current rate. Pure, read-only maths
  over already-live innings state — no scoring-engine changes. Verified against hand-calculated
  values (e.g. 60 off 60 balls with 60 remaining → projected 120; need 41 off 30 balls → RRR 8.20),
  since a live in-progress match is needed to see it on-page and the seed match is completed.

### Added — Boundary & wicket timeline
- **Boundary & wicket timeline strip** in Match Insights (`domain/insights.ts`): every four, six
  and wicket of an innings in ball order as compact colour-coded badges (4 green, 6 purple, W
  red), each showing the over.ball and player on hover — a quick-scan view of how an innings
  swung, complementing the Worm/Manhattan run graphs which don't show event types. Computed in
  the same pass as the other insights, no extra delivery reads.

### Added — System diagnostics
- **System diagnostics card** on Platform Tools (`services/diagnostics.service.ts`): Firestore
  document counts (players, teams, tournaments, matches, deliveries, users, audit entries, admin
  requests) via server-side `getCountFromServer`/`collectionGroup` aggregate queries — cheap even
  as the platform grows, since it never downloads the underlying documents — plus a live
  online/offline badge and a manual refresh. Cross-checked the deliveries count against summed
  per-match delivery reads (66 = 66) to confirm the collection-group aggregate is correct.

### Added — Venue filter on Stats
- **Venue filter on the Stats page**, alongside the existing competition filter: narrows every
  board (leaderboards, MVP, consistency, records, team standings, totals) to matches played at a
  single ground, composing with the competition filter (both apply together). Only lists venues
  with completed matches in the current competition scope; switching competition resets the venue
  filter back to "All venues" to avoid an empty, confusing combination.

### Added — Best bowling spell
- **"Best spell" tile** in Match Insights (`domain/insights.ts`): the tightest 2–4 over stretch by
  a single bowler (lowest economy, ties broken by more wickets), evaluated over that bowler's own
  overs in bowling order. Requires at least 2 overs from the bowler so it reads as a genuine spell
  rather than duplicating "biggest over" or the innings' best-bowling-figures stat; hidden when no
  bowler qualifies.

### Added — Platform backup export
- **"Export platform backup (JSON)"** on the master-admin Platform Tools page
  (`domain/platformExport.ts` + `admin.service.gatherPlatformBackup`): a read-only snapshot of
  players, teams, tournaments, matches (with ball-by-ball deliveries for scored matches), and user
  profiles, downloaded as a single timestamped JSON file. Logged to the audit trail. Verified via
  an actual button click (blob intercepted, parsed, counts checked) rather than just calling the
  builder directly.

### Fixed
- **`listUsers()` didn't fall back to the Firestore doc key for `id`** — a legacy user doc missing
  the `id`/`displayName`/`status` fields entirely meant `Users & Roles` silently failed to change
  that user's role or suspend them (`setUserRole`/`setUserStatus` received `id: undefined`).
  `listUsers()` now merges `{ id: d.id, ...d.data() }`, the same defensive pattern already used by
  players/teams/tournaments/matches services. Found while verifying the backup export above.

### Added — Search type filters
- **Type filter chips on the search page**: a result count plus All / Players / Teams /
  Tournaments / Matches chips (each showing its hit count; only types with results appear) that
  narrow the results to one category. Resets to "All" on each new query.

### Added — Browse match filter
- **Status filter on the Browse › Matches tab**: All / Live / Upcoming / Completed chips, with
  results sorted live-first then by most recent activity. A distinct empty state distinguishes
  "no matches yet" from "none match this filter".

### Added — Home page leading players
- **"Leading players" strip** on the public home page: the platform's top run-scorer, top
  wicket-taker and top MVP (impact) as mini cards with avatars, each linking to the player, plus
  an "All stats" link. Derived from `usePlatformStats` + `buildImpactBoard`; hidden until there's
  data.

### Added — Star performers
- **Star performers highlight** on the match page (`domain/matchPerformers.ts`): the top batter
  (highest score) and top bowler (best figures) of the match as mini cards linking to the player,
  computed from the innings cards. Shown once a match has a scorecard.

### Added — Head-to-head
- **Head-to-head card** on the match page (`domain/headToHead.ts`): the completed-match record
  between the two teams (wins each, plus ties / no-results), computed from all matches' result
  fields. Shown whenever the two teams have met before; robust to deleted team docs since it reads
  the denormalised result.

### Added — Offline indicator
- **Global offline banner** (`components/ui/OfflineBanner` + `hooks/useOnlineStatus`): a fixed
  amber bar appears whenever the browser goes offline, reassuring the user that changes are saved
  on-device and will sync on reconnect (Firestore's IndexedDB cache already queues writes). Uses
  `useSyncExternalStore` on the browser online/offline events; hidden while online and when printing.

### Added — Consistency rating
- **"Most consistent batters" leaderboard** on the Stats page (`domain/consistency.ts`): ranks
  players by coefficient of variation of runs per innings (stddev ÷ average — lower means scores
  cluster around the average rather than swinging between big and low scores). Requires at least 3
  qualifying innings; respects the competition filter; hidden until any player qualifies. Math
  verified against hand-calculated synthetic data (a steady 30/32/28 scorer ranks far above a
  streaky 5/80/10 one; a 2-innings player is correctly excluded).

### Added — Leaderboard competition filter & records
- **Competition scope filter** on the Stats page: switch leaderboards (and the runs/wickets/
  sixes/ranked-player totals) between **all competitions** and any single tournament that has
  completed matches. Per-tournament boards are recomputed on the fly with `aggregatePlayerStats`
  + `buildLeaderboards` from that tournament's matches; the selector only lists tournaments with
  data and resolves names from the live tournament docs.
- **Records tab** on the Stats page: all-time (or per-competition) records — highest team total,
  highest individual score, best bowling figures, most sixes in an innings, biggest win by
  runs/wickets — reusing `computeTournamentRecords` over the scoped match set, each card linking
  to the match. Respects the competition filter.
- **MVP / impact leaderboard** (`impactRating` + `buildImpactBoard`): a transparent all-round
  rating (batting runs + boundary/milestone bonuses, 20/wicket + maidens & five-fors, 8–12 per
  fielding dismissal) surfaced as a "Most valuable players" board at the top of the Stats page,
  with a plain-English scoring note. Respects the competition filter.
- **Teams tab** on the Stats page: a team ranking table (played, won, lost, win %, runs) from
  `aggregateTeamStats`, respecting the competition filter. Team names resolve from denormalised
  match data, so standings stay correct even if a team doc has been deleted.

### Added — Tournament export
- **Export toolbar** on the tournament page (`domain/tournamentExport.ts`): **CSV** and **JSON**
  of the tournament's standings plus most-runs / most-wickets leaders, with names resolved from
  the live docs (and denormalised match data as a fallback). Client-side Blob download via a
  shared `lib/download` helper; shown once the tournament has data.

### Added — Match export & print
- **Export toolbar** on the match page (`domain/matchExport.ts`): **CSV** (a readable per-innings
  batting & bowling scorecard), **JSON** (the full match doc plus ball-by-ball deliveries) and
  **Print**. Downloads are built client-side via Blob with a filesystem-safe filename
  (`<teamA>-v-<teamB>-<id>`). Available to everyone once a match has innings.
- **Printable scorecard** — a `@media print` stylesheet drops the header/footer/toolbar and card
  shadows so the browser's Print/Save-as-PDF produces a clean scorecard.

### Added — Player & team comparison
- **Compare players page** (`/compare`): pick any two players and see their career batting,
  bowling and fielding stats side by side, with the better value in each row highlighted
  (economy compared low-is-better). Selection is URL-driven (`?a=&b=`); reachable from a "Compare
  players" action on the Stats page and a "Compare" link on each player profile.
- **Compare teams page** (`/compare/teams`): two teams side by side — played, won, lost, tied,
  win %, runs scored, wickets taken — plus their head-to-head record. The team list is sourced
  from denormalised match data, so teams whose docs were deleted are still comparable. Cross-linked
  with the player comparison page.

### Added — Player export
- **Export toolbar (CSV/JSON)** on player profiles (`domain/playerExport.ts`): career summary,
  per-tournament splits and the full match log, resolving the same live tournament name used by
  the "By tournament" tab (not the raw match-denormalised fallback). Client-side Blob download via
  the shared `lib/download` helper — completes exports across match, tournament and player pages.

### Added — Player career timeline
- **Timeline tab** on player profiles (`domain/playerTimeline.ts`): a chronological milestone
  feed — debut, fifties, hundreds, five-wicket hauls and career-best score/bowling — each entry
  linking to its match. Derived purely from the performance log; the tab appears once the player
  has a completed appearance.

### Added — Player global rankings
- **Rankings strip** on the player Overview: where the player sits among all ranked players for
  runs, wickets and sixes (e.g. "#1 Runs of 10"), computed from every completed match. Only ranks
  the player actually places in are shown; each pill links to the Stats page.

### Added — Player form charts
- **Recent-form mini charts** on the player Overview (`components/charts/PlayerForm`): batting
  (runs per innings) and bowling (wickets per innings) as SVG bar charts built from the
  match-by-match performance log — no external chart deps. Newest innings on the right, bars
  colour-coded by milestone (50+ gold, 30+ green; 3-wkt hauls purple), not-outs marked with `*`,
  plus a "last 5" summary. Hidden for players with no completed innings.

### Accessibility
- **Skip-to-content link** (keyboard-only, visible on focus) and an `id="main"` landmark on both
  the public and app-shell layouts, so keyboard/screen-reader users can bypass the nav. Added an
  `aria-label` + `aria-expanded` to the app-shell mobile menu toggle; sidebar nav already exposes
  `aria-current` via `NavLink`.

### Performance
- **Memoised MatchPage and TournamentPage analytics** — `MatchPage` re-renders on every scored
  ball (live `onSnapshot` subscription), so head-to-head and star-performers are now `useMemo`'d
  instead of recomputing every ball; `TournamentPage`'s export data (top-20 leader lists) is
  memoised so tab switches don't rebuild it. Verified behaviour-identical (head-to-head, star
  performers, and the export toolbar across tab switches).
- **Memoised analytics on TeamPage and PlayerPage** — the heavier pure aggregations (team
  honours/records/opponents/venues/form-series, player tournament splits/timeline/global rankings)
  now run in `useMemo` keyed on the underlying match data instead of recomputing on every render.
  Behaviour-identical; verified render-for-render against the seeded match.
- **Lazy-loaded route pages** — every route component is now `React.lazy` + `Suspense`, so each
  page ships in its own chunk fetched on navigation. The initial entry bundle drops from one large
  file to ~268 kB, with small per-page chunks (e.g. MatchPage ~35 kB, PlayerPage ~18 kB); the
  Firebase SDK is isolated in its own cached vendor chunk.

### Fixed
- **Tournament standings showed a generic "Team"** when a team's doc had been deleted from the
  Teams collection. Standings now resolve the team name from denormalised match data (falling back
  to the standings engine's value), matching the Records tab and the Stats "Teams" tab.

### Added — Team form chart
- **Runs-scored form chart** on team pages (`components/charts/TeamForm`): recent matches as SVG
  bars coloured by result (win green / loss red / tie amber), labelled by opponent. Complements
  the W/L/T form chips with the actual totals; hidden until the team has completed matches.

### Added — Team splits (opponents & venues)
- **Record vs opponents table** on team pages (`domain/teamOpponents.ts`): the team's
  completed-match record broken down by opponent (played, won, lost, tied/NR and win %), each
  opponent linking to its team page. Shown once the team has completed matches.
- **Record by venue table** on team pages (`domain/teamVenues.ts`): the same completed-match
  record grouped by ground (played/won/lost and win %), shown once the team has matches with a
  recorded venue.

### Added — Team honours & records
- **Honours** section on team pages (`domain/teamRecords.ts`): knockout **titles** (finals the
  team won) as trophy rows — "&lt;Tournament&gt; — Champions, beat &lt;opp&gt; in the final" —
  linking to the final, with the tournament name resolved from the live doc (falling back to the
  match snapshot).
- **Team records** grid: the team's own bests — highest total, highest successful chase, biggest
  win by runs / by wickets, highest individual score and best bowling — each linking to the match
  it happened in. Computed purely from the cached innings cards; win/chase-only records are hidden
  for a team that hasn't won that way, and record-holder names resolve across all players (not just
  the current squad, so a departed player is still credited).

### Added — Player tournament splits
- **"By tournament" tab** on player profiles (`domain/playerSplits.ts`): the player's completed
  matches bucketed by tournament, each row showing matches, runs, high score, batting average &
  strike rate, wickets, best bowling and catches — reusing `aggregatePlayerStats` so a split row
  means exactly what the career figures mean. Non-tournament games collapse into an "Other
  matches" row (sorted last); the tab only appears once the player has completed matches. The
  tournament name is resolved from the live Tournament doc, falling back to the name denormalised
  on the match (so legacy/seed matches still display correctly), and links through to the
  tournament.

### Added — Tournament awards
- **Awards tab** on the tournament page (`domain/awards.ts` + an `AwardCard` grid): a curated
  honours cabinet distinct from the raw Leaders lists. Picks a single honouree per award —
  **Player of the Tournament** (a weighted MVP score blending runs, wickets, catches/stumpings/
  run-outs, boundaries and Player-of-the-Match awards, shown as a featured full-width card),
  **Best Batter**, **Best Bowler**, **Best All-Rounder** (only for players with ≥20 runs & ≥2
  wickets), **Most Sixes**, **Best Economy** (min 12 balls) and **Most POTM awards** (only when a
  player has more than one). Each card links to the player. Computed purely from the cached player
  stats already on the page plus POTM tallies read off the match docs — no extra reads, and each
  card renders only once a qualifying player exists.

### Robustness
- **Standings** now fall back to the team name/short-name **denormalised onto each match** when a
  Team doc has since been deleted, so the table shows the real name instead of a generic "Team"
  placeholder (mirrors how the Records tab already reads names off the match snapshot).

### Added — Knockout bracket
- **Bracket tab** on knockout / group-knockout tournaments (`domain/bracket.ts` + `BracketMatch`):
  matches are grouped into ordered rounds (Round of 16 → Quarter-finals → Eliminator/Qualifier →
  Semi-finals → Third-place → Final) and shown as left-to-right columns of match cards. Each card
  shows both teams with the **winner bolded + a trophy**, the loser greyed, and the result/date
  line, linking to the match. Reads only denormalised match fields (stage, `teamA`/`teamB`,
  result), so it's robust even if a team doc is later deleted. The tab only appears for tournaments
  whose format has a knockout phase.
- **Match stage** — the match setup wizard now has a **"Knockout stage"** selector (Details step),
  shown only when the chosen tournament is knockout / group-knockout. Stored as `match.stage`
  (null for group/league-phase matches). Fully backwards-compatible — existing matches read as
  stage-less and simply don't appear on a bracket.

### Added — Tournament records
- **Records tab** on the tournament page (`domain/records.ts` + a `RecordCard` grid):
  highest & lowest team total, highest individual score, best bowling figures, most sixes/most
  fours in a single innings, and biggest win by runs / by wickets — each card links to the match
  it happened in. Computed purely from the cached innings cards already on each match doc (no
  extra delivery reads), so it stays cheap even for a tournament with many matches. Cards render
  only once that record actually exists (e.g. no "biggest win by runs" card until a team wins by
  runs).

### Data / polish
- **Seeded a coherent demo match** — a full engine-scored T20, **Royal Strikers 58 all-out vs
  Thunder Kings 59/2 ("Thunder Kings won by 3 wickets")**, with real 6-player squads (Rohit
  Sharma, Kohli, Bumrah, Jadeja, …), 65 ball-by-ball deliveries and Player-of-the-Match. Scored
  with the real scoring engine so every surface (scorecard, worm/Manhattan, match insights,
  leaderboards, team form & top performers, player profiles) shows real names and numbers. The
  earlier incoherent match (which referenced deleted players and showed "—") was removed and
  stats recomputed.
- **Fixed** singular/plural on team "top performer" lines ("1 wkt", "1 run" instead of
  "1 wkts"/"1 runs").

### Added — Admin-request loop, top-level entry points
- **"Request admin" button in the public top bar** (viewers only) — a prominent amber
  header button linking straight to the request form, instead of the flow being buried in
  the account page. Verified end-to-end (shown for VIEWER, hidden for admins/master, submits
  a real `adminRequests` doc).
- **Pending-count badge** on the master admin's "Admin requests" sidebar item — a red pill
  showing how many requests await a decision (refreshes on navigation; hidden at zero).

### Added — Cross-device preference sync
- Appearance & accessibility preferences (text size, density, reduced motion, high contrast)
  now **follow the signed-in user across devices** via a `userPrefs/{uid}` Firestore doc
  (`userPrefs.service` + `prefsStore.syncUser`): on sign-in the account's saved prefs are pulled
  and applied (remote wins), seeding the doc on first sign-in; changes are pushed with a 600ms
  debounce; sign-out stops syncing and local prefs remain. Settings copy updated to
  "Synced to your account across devices."

### Added — Team profile depth
- **Recent-form guide** on team pages (`domain/teamForm.ts`): last results as coloured
  **W/L/T/N chips** (each links to its match), plus a **win-rate + W-L-T record** summary —
  computed from completed matches for that team.
- **Top performers** cards: top run-scorer and top wicket-taker among the current squad,
  aggregated live from the team's completed matches (hidden when no squad member has stats).

### Added — Match insights
- **Match insights** panel on the match page (`domain/insights.ts` + `MatchInsights`),
  computed purely from ball-by-ball delivery data — per innings: **biggest over** (runs +
  bowler), **best partnership** (runs/balls + the two batters), **boundaries** (4s/6s and the
  share of runs scored in boundaries), **dot-ball %**, and **powerplay** runs (window sized by
  format: T20 6 ov, ODI 10, T10 3, The Hundred 5, custom ≈30%). Reads the scoring engine,
  never modifies it.

### Added — Global undo system
- **Undo toasts** on create/edit across **Players**, **Teams** and **Tournaments**: after a
  save the success toast shows an **Undo** button (with `Undo2` icon, extended 7s timeout).
  Undoing a *create* deletes the new record; undoing an *edit* restores the pre-edit snapshot
  and reports "Change reverted". Backed by a new `toast.undo(message, onUndo)` helper and a
  `ToastAction` API on the toast provider.

### Stabilization
- **Added** app-wide `ErrorBoundary` (top level + per-route in both layouts) so a single
  component error shows a recoverable message instead of white-screening the whole app.
- **Fixed** `Cannot read properties of undefined (reading 'length')` on **Users & Roles**
  (and any avatar) — `colorFromString`/`initials` now guard null/undefined names.
- **Fixed** "Invalid Date" for legacy docs — `formatDate`/`formatDateTime` handle numbers,
  ISO strings and Firestore-timestamp objects, returning "—" when unparseable.
- **Fixed** Firestore `Unsupported field value: undefined` on create/edit — `pruneUndefined`
  applied to all player/team/tournament/match writes.
- **Fixed** master admin locked out of `New match` / `Scoring` — `hasRole` now treats
  `MASTER_ADMIN` as a super-admin that satisfies every guard.
- **Hardened** Users & Roles against legacy/foreign user docs (missing `displayName`/`status`).

### Added — Master Admin platform tools
- **Audit log** (`auditLogs` collection + `audit.service`): records privileged actions
  (leaderboard clears/rebuilds, role changes) with actor, action, details, timestamp.
- **Platform Tools** page (`/admin/tools`, master-admin only): rebuild stats & standings,
  and a guarded **Clear leaderboards** flow — full-screen warning, "I understand" checkbox,
  type-to-confirm `CLEAR LEADERBOARDS`, final button — every action written to the audit log.
- **Audit log viewer** on the same page.

### Added — Achievements & awards
- **Achievements engine** (`domain/achievements.ts`): 15 auto-unlocking achievements across
  bronze/silver/gold/platinum tiers (Debutant, Centurion, Five-Wicket Haul, Six Machine,
  Economy King, Mr Consistent, Ironman, Millennium Club, Century of Wickets, …) with progress
  bars toward milestones — all derived from cached career stats.
- **Awards cabinet** on player profiles: Player-of-the-Match count (from completed matches) +
  achievement completion. New **"Achievements"** tab on every player page.

### Added — Universal Settings & appearance
- **Settings page** (`/settings`) available to **every** signed-in role (nav item in the app
  shell + a gear button in the public header for viewers).
- Profile editing: display name, bio, email, photo URL (persisted to the user doc).
- **Change password** with re-authentication (`auth.service.changePassword`).
- **Appearance & accessibility** (persisted per device via `prefsStore`, applied to `<html>`):
  text size (S/M/L/XL), density (comfortable/compact), reduced motion, high contrast,
  plus the background-theme control. Stronger always-visible keyboard focus ring.
- Old master platform-defaults page moved to `/admin/settings` ("Platform Settings", master only).

### Added — Match Centre analytics
- **Worm**, **Manhattan** and **run-rate** graphs on the match page, rendered as SVG from the
  ball-by-ball delivery data (no external chart deps).

### Docs
- Added `ROADMAP.md` (phased plan) and this `CHANGELOG.md`.

---
_Earlier history: initial platform build (auth, roles, players/teams/tournaments/matches,
GullyScore-style scoring, scorecards, public viewer, stats/leaderboards, background
customization, follow/favourites, admin requests, offline persistence)._
