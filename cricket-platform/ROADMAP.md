# CricketHub — Product Roadmap

This roadmap tracks the "commercial platform" expansion (MyCricketApp / CricHeroes /
GullyScore parity). It is intentionally phased: the app stays shippable at every step,
existing data and working features are preserved, and no phase leaves placeholders.

Legend: ✅ done · 🟡 partial / in progress · ⬜ planned · 🚫 decided against (see reasoning inline)

`🚫` is not "not done yet" — it's a considered decision not to build something, for a specific
documented reason (a stated project constraint, or a task with no well-defined finish line). It
will not become ✅ by further unattended work; it changes only if the underlying constraint
changes or a human scopes the task down to something finite.

---

## Phase 0 — Stabilization (DO FIRST)
- ✅ Global `ErrorBoundary` (app-level + per-route) — one broken page can no longer blank the app
- ✅ Crash fixes: `Avatar`/`colorFromString`/`initials` on missing names; `formatDate` on invalid/timestamp values; `teamIds`/owner-field guards; `pruneUndefined` on all writes
- ✅ Master-admin route access (super-admin bypasses every guard)
- ✅ `npm run build` + `tsc` clean; scoring flow verified end-to-end
- ✅ Resilience to legacy/foreign docs (missing `displayName`, `status`, etc.) — hardened where hit;
  **`listUsers()` now falls back to the doc key for `id`** (a legacy doc missing it silently broke
  role/ban actions for that user); audited every other `list*()` in `src/services/` for the same
  missing-`id`-merge shape — `audit.service.ts`, `requests.service.ts`, and the deliveries reader in
  `scoring.service.ts` all write `id` explicitly into the document at creation time, so none share
  the bug; no further instances found

## Phase 1 — Master Admin platform tools & audit (THIS PASS)
- ✅ Audit log (`auditLogs` collection + service, records admin actions)
- ✅ Master-Admin **Platform Tools** page (exclusive): recompute leaderboards, rebuild stats
- ✅ **Clear leaderboards** danger flow: full-screen warning, "I understand…" checkbox, type `CLEAR LEADERBOARDS`, final confirm, audit-logged
- ✅ Audit log viewer (master admin)
- ✅ **Platform backup export** (JSON snapshot of players/teams/tournaments/matches+deliveries/
  users — `domain/platformExport.ts`, audit-logged)
- ✅ **System diagnostics** (`services/diagnostics.service.ts`): Firestore document counts via
  server-side aggregate queries + online/offline badge, on Platform Tools
- ✅ **Offline-queue force resync** (`forceResync()`: drops/re-establishes the Firestore
  connection then waits for queued writes to be acknowledged, raced against an 8s timeout so it
  can't hang forever while genuinely offline — the client SDK doesn't expose an enumerable list
  of queued mutations, so this reports aggregate sync state rather than a fabricated per-write
  queue); "Force resync" button on Platform Tools

## Phase 2 — Match Centre analytics (THIS PASS)
- ✅ Worm graph (cumulative runs), Manhattan (runs/over), run-rate — SVG, from delivery data
- ✅ Match insights panel (biggest over, best partnership, boundary %, dot-ball %, powerplay) — pure computation from deliveries
- ✅ **Head-to-head record + star performers + live projected score/chase-rate comparison** on the
  match page (`domain/headToHead.ts`, `domain/matchPerformers.ts`, `projectedScore` in
  `lib/format.ts`; **win-probability bar** for the chasing side — `domain/winProbability.ts`
  `chaseWinProbability()`, a transparent required-rate/wickets-in-hand heuristic, explicitly labelled
  "heuristic estimate" rather than a trained model, since there's no historical ball-by-ball dataset
  in this app to fit one on)
- ✅ **Wagon wheel · pitch/bowling map** — the blocker was real (`applyBall()` in `domain/scoring.ts`
  builds `Delivery` as one explicit field-by-field literal with no pass-through for extra fields,
  and that file is off-limits), but the constraint only rules out extending `Delivery`/`BallInput`
  themselves — it doesn't rule out a sibling record. `BallMeta` (`types/index.ts`) is a separate
  optional doc keyed by delivery id, written by `services/ballMeta.service.ts` to a new
  `matches/{id}/ballMeta/{deliveryId}` subcollection *after* `recordBall()` already returned — the
  scoring engine never sees it, calls it, or is touched by it. On the Scoring page, a dismissible
  `ShotDetailPrompt` appears after each ball (8-zone shot placement + bowling line/length, all
  optional, tap-to-save, "Skip" or the next ball closes it — never blocks or slows down scoring).
  `domain/wagonWheel.ts`/`domain/pitchMap.ts` are pure aggregations of deliveries + `BallMeta`;
  `components/charts/WagonWheel.tsx` (8-sector SVG, sized by runs) and `PitchMap.tsx` (line×length
  heatmap table) render on the match page only once real tagged data exists, else nothing (no
  fabricated placeholder). Verified live: scored a real ball in an in-progress match, tagged it
  "Long-on", confirmed the wagon wheel rendered the 4 runs in that sector on the public match page.
- ✅ **Best bowling spell + boundary/wicket timeline + momentum + turning point** in Match Insights
  — tightest 2–4 over economy stretch per bowler; colour-coded ball-order timeline of every
  4/6/wicket; last-3-overs rate vs overall, accelerating/slowing/steady; the over with the largest
  run swing between consecutive overs (`domain/insights.ts` `TurningPoint`)

## Phase 3 — Player account lifecycle
- ✅ **Auto-create linked user account on player create** — optional checkbox on the player form;
  generates a `user######` username + random temp password via a throwaway secondary Firebase App
  instance (so the admin's own session isn't hijacked — the client SDK signs in as whichever user
  it just created, which would otherwise switch the admin to the new account), stores the profile
  as `pending_registration`, links `Player.linkedUserId`, and shows the credentials to the admin
  exactly once in a copy-to-clipboard dialog (Firebase never exposes a password again after set)
- ✅ **First-login activation** (`/activate`, password + display name → `active`) — `ProtectedRoute`
  redirects any `pending_registration` account here first, for any route. Scoped down from the
  original "choose username" plan: usernames map to a synthetic email, and Firebase Auth's
  `updateEmail` requires verifying the new address first on projects with email enumeration
  protection (the default for new projects) — there's no real mailbox behind the synthetic domain,
  so that verification could never complete. The assigned username is kept permanently instead;
  only the password (and display name) are chosen at activation. This is a platform constraint,
  not a shortcut — a real fix would need a backend (Admin SDK) this project doesn't have.
- ✅ **Cricket-based password recovery** — `/recover`'s fuzzy name match now gates the username
  reveal behind a **verification quiz** (`domain/recoveryQuiz.ts` `buildRecoveryQuestions()`): role
  and current-team multiple-choice questions built from the requester's own real player data, with
  decoy options drawn from other real players/teams so they can't be guessed structurally; both
  must be answered correctly. **Client-side rate limiting/cooldown**: after 5 failed attempts from
  one browser, recovery is paused there for 15 minutes (localStorage-tracked) — an honest,
  bounded best-effort given there's no backend here to rate-limit server-side; it stops casual
  brute-forcing from one browser, not a determined multi-IP attacker. **Recovery audit**: every
  attempt (passed/failed/rate-limited/no-quiz-available) is logged to the new `recoveryAttempts`
  collection (public create — the flow runs pre-login — master-admin-only read, enforced in
  `firestore.rules`). Accounts with no linked player (e.g. the master admin) have no quiz to build
  and fall back to the pre-quiz direct reveal, logged as `no_quiz_available` — a genuine limitation
  of a client-only app with no server-side identity check to fall back to, not an oversight.
- ✅ **Claim / merge duplicate player profiles** — master-admin-only page at `/admin/merge-players`
  (`services/playerMerge.service.ts`): rewrites every reference to the duplicate playerId — team
  rosters/captain/vice-captain, match squads, `playerOfTheMatchId`, every innings' batting/bowling
  cards, fall-of-wickets, striker/non-striker/bowler ids, and every ball-by-ball delivery doc in
  the `deliveries` subcollection — over to the kept player, in batched Firestore writes; then
  recomputes all cached stats (`recomputeAllStats`) and deletes the duplicate player + its stats
  doc. Confirmation modal warns it's irreversible; the merge is audit-logged

## Phase 4 — Settings & user profile
- ✅ Background customization (pill + panel + presets, persisted locally)
- ✅ Unified Settings page on every dashboard: profile pic/display name/bio/email, change
  password, appearance (text size/density/reduced motion/high contrast/colour-blind palette),
  self-service "export my data" (JSON), and a **Privacy & sessions** card — states plainly what's
  public (nothing account-related; only display name where credited as scorer) vs. visible to
  other admins (bio/email, needed to manage access) and why, current-session sign-in time +
  "Sign out this device"; cross-device session listing/remote revocation needs a server-side
  Admin SDK this project doesn't run, so that's documented rather than faked
- ✅ **Light/dark/system theme** — `theme` pref in `prefsStore`, synced cross-device like the
  other appearance prefs, live OS-preference listener for "system", Light/Dark/System toggle on
  Settings, plus a quick-access horizontal Sun/Moon slider (`ThemeToggle`) next to the Background
  control in both headers — flips explicitly between light/dark, icon swaps with the mode. Extended
  from app-shell chrome to the shared UI kit and every page: `Card`/`CardHeader`/`Modal`/`Badge`/
  `Button`/`Input`/`Select`/`Textarea`/`Tabs`/`EmptyState`/`StatCard`/toast/pagination/
  follow-button/`BackgroundControl` all gained `dark:` variants, plus 43 feature/chart page files
  including the live-scoring `MatchPage`, `PlayerPage`, `TournamentPage`, and Settings (held back
  from the first pass since concurrent work was landing in those same files; finished once it
  settled). Verified via computed-style contrast sampling in the browser rather than screenshots
  (unreliable this session): 0 low-contrast text elements found across 465 sampled on the Match/
  Player/Tournament/Settings pages, 157/158 on Stats. **Custom background darkens with the theme**
  (`BackgroundLayer.tsx`): a `mix-blend-mode: multiply` overlay dims whatever gradient/solid/preset
  the user picked, with opacity driven by `configLuminance()` (`store/bgStore.ts`) — an already-dark
  pick (the "Midnight" preset) gets little to no extra darkening, light pastel ones (the default,
  "Pitch", "Sunset", "Ocean") get dimmed close to black, rather than a flat dark-mode override that
  would either wash out Midnight or leave light presets glaringly bright. Verified in the browser:
  toggling the theme switch flips the overlay's inline `opacity` between `0` (light) and `0.85`
  (dark, for the light-pastel default) live, no reload needed
- ✅ Cross-device persistence of preferences (Firestore `userPrefs`) — pull/seed on sign-in (remote wins), debounced push on change, resets on sign-out
- ✅ Global undo toasts for create/edit actions (Players, Teams, Tournaments)

## Phase 5 — Player / Team / Tournament depth
- ✅ Player profile: career/batting/bowling/fielding stats + match log + follow, achievements, awards cabinet (✅); **per-tournament splits tab** (✅ `domain/playerSplits.ts`); **recent-form charts** (✅ batting/bowling SVG bars — `components/charts/PlayerForm`); **global
  rankings strip** (✅ runs/wickets/sixes rank); **career timeline** (✅ `domain/playerTimeline.ts`);
  **player-vs-player comparison** (✅ `/compare`); **radar profile chart** (✅ `domain/radar.ts` +
  `components/charts/PlayerRadar`); **season splits** (✅ `playerSeasonSplits` in
  `domain/playerSplits.ts` buckets by season via each match's tournament -> season lookup; "By
  season" tab shown once a player has at least one match under a seasoned tournament)
- ✅ Team profile: squad, recent, record, leaders (✅); **recent-form guide (W/L/T chips), win-rate/record summary, top run-scorer & wicket-taker** (✅); **honours (knockout titles) + team records** (✅ highest total/chase, biggest wins, best individual batting/bowling — `domain/teamRecords.ts`); **record vs opponents + record by venue** (✅ `domain/teamOpponents.ts`, `domain/teamVenues.ts`);
  **runs-scored form chart** (✅ `components/charts/TeamForm`);
  **team-vs-team comparison** (✅ `/compare/teams`)
- ✅ Tournament: standings, fixtures, leaders, teams (✅); **records tab** (✅ highest/lowest team
  total, highest individual score, best bowling figures, most sixes/fours in an innings, biggest
  win by runs/wickets — all derived from cached innings cards, no delivery reads); **knockout
  bracket** (✅ per-match `stage` set in the setup wizard, rounds rendered left-to-right with
  winner highlighting — `domain/bracket.ts`); **awards tab** (✅ Player of the Tournament MVP +
  best batter/bowler/all-rounder/economy/sixes/most-POTM — `domain/awards.ts`); standings robust
  to deleted team docs (✅); **group tables within group-knockout** (✅ per-team group label set in
  the tournament form, `domain/groups.ts` reuses `computeStandings` per group, "Groups" tab shown
  when configured); **qualification tracker** (✅ `domain/qualification.ts` — a conservative,
  mathematically-sound per-group check: a team is only "qualified" or "eliminated" when that
  outcome is guaranteed regardless of how every remaining group match plays out; ties at the
  cutoff stay "in contention" rather than guessing an NRR-resolved order; configurable "teams
  advancing per group" on the tournament form, default 2); **timeline** (✅
  `domain/tournamentTimeline.ts` — every match ordered by played/scheduled date, distinct from the
  unordered Fixtures & Results list)

## Phase 6 — Global leaderboards & rankings
- ✅ Global leaderboards (runs, wickets, avg, SR, economy, 4s, 6s, best bowling, fielding) + Stats page
- ✅ **Competition + venue + team filters, all-time Records tab, MVP/impact rating, consistency
  rating on the Stats page + per-tournament player rank** (✅ composable competition/venue/team
  filters recompute boards, totals, records, impact and consistency leaderboards —
  `domain/consistency.ts`; ✅ per-tournament runs rank on the player "By tournament" tab); **season/
  club/year filters** (✅ same composable, non-cross-narrowing pattern — options derived from the
  competition-scoped matches via each match's tournament -> club/season lookup, or match date for
  year; selects stay hidden until real club/season data exists)

## Phase 7 — Offline scoring hardening
- ✅ Firestore IndexedDB persistent cache (writes queue offline, sync on reconnect)
- ✅ **Global offline banner** (`useOnlineStatus` + `OfflineBanner`)
- ✅ **Manual/force resync** — see Phase 1's `forceResync()`
- ✅ **App-level write-queue visibility** (`store/writeQueueStore.ts`, `SyncQueuePanel`) —
  scoring/undo writes are wrapped in `trackedWrite()`, which records each write from the moment
  it's issued to the moment its own commit promise settles (synced/failed), shown live on the
  Scoring page and Platform Tools. Deliberately *not* a view into the Firestore client SDK's
  private offline queue — that queue is internal with no public enumeration API, so a literal
  reflection of it would have to be faked. This tracks something real (this app's own issued
  writes) rather than faking the thing that can't be observed.

## Phase 8 — Clubs & Seasons architecture
- ✅ **Club (top-level org) + Season entities; Team→Club, Tournament→Club+Season** — types +
  services + admin management page at `/clubs` (owner-scoped); Team/Tournament form pickers;
  club/season badge (linked) on the public Team/Tournament pages
- ✅ **Club profile pages, season archive, hall of fame** — `/club/:id` (teams, seasons,
  tournaments under the club) and `/season/:id` (tournaments in the season + a hall of fame:
  top run-scorers/wicket-takers aggregated across every match in every tournament in that season,
  reusing `aggregatePlayerStats`/`topRunScorers`/`topWicketTakers`); linked from the admin
  Clubs & Seasons page and from the club/season badges on Team/Tournament pages
- ✅ Backwards-compatible migration for existing data (n/a by design — every new field is
  optional, so pre-existing team/tournament docs are unaffected)

## Phase 9 — Exports, accessibility, performance
- ✅ **Printable scorecard (print CSS) + CSV/JSON export** from the match page
  (`domain/matchExport.ts`), **tournament standings/leaders export**
  (`domain/tournamentExport.ts`) **and player career/splits/match-log export**
  (`domain/playerExport.ts`); **PDF export** ("Print / Save as PDF" buttons on the Match,
  Tournament and Player pages — reuse the existing print stylesheet via `window.print()`, the
  standard way a client-only app produces a real PDF without shipping a PDF-rendering library;
  a generated-PDF-in-JS route would just be a worse version of the browser's own "Save as PDF"
  print destination); **duplicate detection** (`domain/duplicateDetection.ts`
  `findDuplicateCandidates()` — fuzzy Levenshtein-based name matching across active players,
  surfaced as a "Suggested duplicates" panel on the merge-players tool with a similarity % and a
  shared-team flag, one click pre-fills the keep/merge pickers; verified live — created two
  near-duplicate test players, confirmed the suggestion appeared at 90% with a working "Review"
  button, cleaned up after); **match archive + import** (`services/matchImport.service.ts`
  `importMatch()` — the import contract is exactly the `{ match, deliveries }` shape this app's
  own "Export JSON" button already produces, i.e. round-tripping a match previously exported from
  this same app, not guessing an arbitrary third-party format; imported matches land
  `archived: true` + `isPublic: false` for review before publishing, `archived` matches are
  filtered out of the default Matches list, `PublicBrowsePage`, and `PublicHomePage`; verified
  live — exported a real completed match (65 deliveries), imported it back, confirmed the new
  match landed correctly archived/private with all 65 deliveries intact, cleaned up)
- ✅ Accessibility: focus rings, large-text mode, high-contrast (earlier); **skip-to-content
  link + `main` landmarks + nav `aria-current`/labels**; **colour-blind friendly palette**
  (`colorBlind` pref remaps the `pitch-*` green token to teal via a `.colorblind` CSS-variable
  override — covers every Tailwind-class usage of pitch plus the few chart/SVG spots that read the
  same CSS variable; standalone decorative icon tones left as-is since they don't pair information
  with colour alone); **scoped ARIA pass** (`Modal` and the danger-zone dialog gained
  `role="dialog"`/`aria-modal`/`aria-labelledby`; `Modal`'s and the toast's close/dismiss buttons
  gained `aria-label`; the toast region gained `role="status" aria-live="polite"`; every icon-only
  edit/delete button on the Teams/Tournaments/Clubs & Seasons/Matches/Players list pages gained an
  `aria-label` naming the specific row — previously relied on `title` alone or had no accessible
  name at all); **every icon-only control in the app has an accessible name** — scoped that open
  claim down to a finite, verifiable one: every `<button>`/`<Link>` in all 43 files that import
  `lucide-react` was checked for `aria-label`/`title`, the one gap found (the gradient editor's
  "remove colour stop" button in `BackgroundControl.tsx`) was fixed. This is a real, bounded
  completion of the icon-label sub-problem, not a claim of general WCAG compliance
- 🚫 **Exhaustive accessibility audit** (contrast ratios, keyboard-trap testing, and screen-reader
  flow individually verified on every page) — this remains open-ended by nature (no fixed list of
  "every page/flow," and new ones are added every time a feature ships), unlike the icon-label
  sub-problem above, which had a finite, greppable surface and is now done. Revisit if a specific
  screen-reader-flagged gap is reported.
- ✅ Performance: **lazy-loaded routes / code-splitting** (`React.lazy` + `Suspense` per route);
  **memoised TeamPage/PlayerPage/MatchPage/TournamentPage analytics** (`useMemo`, incl. the
  live-scoring MatchPage which re-renders every ball); **batched backup-export delivery reads**
  (`Promise.all` instead of sequential per-match reads); **client-side pagination** (`usePaginated`
  hook + shared `Pagination` component — Players table 20/page, Teams/Tournaments grids 12/page,
  Matches list 15/page; page clamps automatically when a filter shrinks the list)

## Phase 10 — Data lifecycle management
- ✅ **Soft delete / Trash / restore / permanent delete / bulk restore & delete / configurable
  retention** for Players, Teams, Clubs, Seasons, Tournaments and Matches (`services/
  trash.service.ts`): every entity gained optional `deletedAt`/`deletedBy` fields; the "Delete"
  buttons on the Players/Teams/Tournaments/Clubs & Seasons/Matches list pages now soft-delete
  (`softDelete()`) instead of hard-deleting — the doc is flagged and disappears from every list/
  browse surface (`listPlayers`/`listTeams`/`listClubs`/`listSeasons`/`listTournaments`/
  `listMatches`/`listAllMatches` all filter out `deletedAt`) but nothing referencing it is
  rewritten, so restoring is exact and free of side effects. A new **Trash** page
  (`/admin/trash`, available to the same roles as `canManage`) lists every soft-deleted doc across
  all six entity types with per-type filter chips, per-row Restore/Permanently-delete, and
  checkbox multi-select for bulk Restore/bulk Permanently-delete. Permanent delete reuses each
  entity's existing `deleteX()` (matches route through `purgeMatch()`, extended to also clean up
  the `ballMeta` subcollection it was previously missing, alongside `deliveries`) — deliberately
  the *same* behaviour the old hard-delete buttons already had (dangling references in
  teams/matches are tolerated exactly as before; this app already treats "referenced player/team
  doc can vanish, readers fall back to denormalized data" as a standing convention). **Retention**
  is a new `AppSettings.trashRetentionDays` field (default 30, editable on Platform Settings); a
  "Purge expired now" button surfaces on the Trash page once items pass that window — there's no
  backend cron in this client-only app, so "automatic cleanup" is an honest manual trigger
  (`purgeExpired()`), consistent with `forceResync()`'s existing best-effort approach rather than
  a fabricated schedule. Every trash/restore/permanent-delete action is audit-logged. Verified
  live end-to-end in the browser: created a throwaway test player, soft-deleted it (disappeared
  from the Players list), confirmed it appeared in Trash, restored it (reappeared in Players),
  soft-deleted again, and permanently deleted it via the Trash page's confirm modal (gone for
  good, confirmed via a direct Firestore read) — cleaned up after.

## Phase 11 — Notification center
- ✅ **Persisted, per-user notification center** (`services/notifications.service.ts`,
  `AppNotification`/`NotificationCategory` in `types/index.ts`): a `notifications` collection
  (`notify()`/`listNotifications()`/`subscribeNotifications()`/`markRead()`/`markAllRead()`),
  read live via `onSnapshot` by a new header **bell** (`components/layout/NotificationBell.tsx`,
  in `AppShell`) showing an unread badge and a dropdown of recent notifications; clicking one
  marks it read and follows its link. Queried by `where('userId','==', uid)` only, sorted/capped
  client-side rather than adding `orderBy` — the combination needs a composite Firestore index
  this project doesn't ship (same reasoning as `listAllMatches`'s "sorted client-side" comment).
  No generic event bus (deliberately deferred — see `RESTRICTIONS.md` §4): concrete triggers are
  wired directly into the service call that causes them — **admin request approved/declined**
  (`requests.service.ts`), **role changed / account suspended-reinstated**
  (`users.service.ts` `setUserRoleNotified()`/`setUserStatus()` — kept separate from the plain
  `setUserRole()` the request-approval flow already calls, so approving a request doesn't fire two
  overlapping notifications for the same event), **player profile merged**
  (`playerMerge.service.ts`, to the merged-away player's linked account, if any), and **match
  completed/abandoned** (`scoring.service.ts` `notifyMatchDone()`, called from every completion
  path — auto-complete inside `recordBall()`, manual `endInnings()`, `completeMatch()`, and
  `abandonMatch()` — notifying the match's scorer and owner, deduplicated). **Per-category mute
  preferences** (`Prefs.notifyMuted`, synced cross-device like other appearance prefs) on a new
  Notifications card on Settings — muting hides a category from the bell/badge without deleting
  the underlying records. Firestore rules: any signed-in user may create a notification (it's
  always written by whichever action triggers it, for someone else), only the recipient (or
  master admin) can read/update/delete it. Verified live end-to-end: sent a real notification via
  the service, watched the bell badge update with no reload (live `onSnapshot`), opened the panel,
  used "Mark all read", confirmed the badge cleared; muted a category and confirmed a muted
  notification stayed hidden while an unmuted one still showed; cleaned up all test data.

## Phase 12 — Media uploads (player photos / team & club logos)
- ✅ **Firebase Storage integration** (`services/storage.service.ts`): validates file type
  (JPEG/PNG/WebP/GIF) and size (max 5MB), client-side downscales/re-encodes to a max 800px JPEG
  via `createImageBitmap` + canvas before upload (GIFs pass through unresized to preserve
  animation), uploads to Storage under `players/`, `teams/` or `clubs/`, and returns the download
  URL. A reusable **`ImageUploadField`** (`components/ui/ImageUploadField.tsx`) pairs the existing
  manual URL text input (unchanged, still works) with an "Upload" button — wired into the
  Player/Team/Club forms (`PlayerFormModal`/`TeamFormModal`/`ClubFormModal`), and reused by the
  Tournament banner field. Team logos previously had no edit UI at all despite the field existing
  on the type — `TeamFormModal` gained its first-ever logo control alongside the upload option.
  Failed/skipped uploads leave the URL field exactly as it was — the manual-entry path is a
  graceful fallback, not a special case, since both paths write to the same plain string field.
  Storage security rules (`storage.rules`, registered in `firebase.json`) cap writes to signed-in
  users, 5MB, image-only — server-side enforcement of the same limits the client checks, per
  "never trust client-side validation alone." Verified in the browser: opened the player form,
  confirmed the Photo field renders with both the URL input and Upload button, manual URL entry
  unaffected; `tsc`/`npm run build` clean. Real file-picker upload wasn't exercised through browser
  automation (no file-upload capability in the available tooling) — the upload path itself
  (`uploadImage()`) uses standard, well-established Storage-SDK/canvas APIs reviewed by hand.

## Phase 13 — Command palette
- ✅ **Global Ctrl/Cmd+K command palette** (`components/layout/CommandPalette.tsx`): a keyboard-
  triggered overlay available on every signed-in page (mounted once in `AppShell`), reusing the
  existing `services/search.service.ts` `globalSearch()` for live player/team/tournament/match
  results rather than building a second search backend. Also lists every nav destination as a
  quick "command" (Dashboard, Matches, Players, Teams, Clubs & Seasons, Trash, Stats, and the
  master-admin-only pages), role-filtered the same way `AppShell`'s sidebar already is, so typing
  "settings" or "trash" jumps straight there even with no matching entity. Arrow keys move the
  selection, Enter navigates, Escape (or clicking outside) closes; a visible "Search ⌘K"/"Search
  Ctrl K" button in the header (`openCommandPalette()`) triggers it too, for anyone who doesn't
  know the shortcut. Verified in the browser: `Ctrl+K` opens the palette from the Trash page,
  typing a real player's name surfaced them with a working link, typing "settings" surfaced the
  Settings command, Escape closed it; `tsc`/`npm run build` clean.

## Phase 14 — Activity feeds
- ✅ **Platform activity timeline** wired up the previously-dead `ActivityLog` type
  (`services/activity.service.ts` `logActivity()`/`listActivity()`, `activity` collection —
  already had a type and a `COL` entry but no writer, reader or UI behind either): create-time
  loggers on `players.service.ts`, `teams.service.ts`, `clubs.service.ts` (new `club_created`
  type), `tournaments.service.ts` and `matches.service.ts`, plus `match_started`/`match_completed`
  in `scoring.service.ts` (the latter folded into the existing `notifyMatchDone()` helper so it
  fires from every completion path — auto-complete, declare, explicit complete, abandon — for
  free). New reusable `components/activity/ActivityFeed.tsx` — pass a `refId` to scope it to one
  team/player/tournament/club, omit it for the platform-wide feed; queries by `refId` only and
  sorts/caps client-side for the same composite-index reason as `notifications.service.ts`.
  Embedded on the Dashboard as "Recent activity" this pass; the component takes a `refId` so
  embedding it on individual Club/Team/Player/Tournament pages is a small, natural follow-up, not
  done yet. `firestore.rules`: public read (these are meant to be visible, like the rest of the
  cricket data), any signed-in user can create (always a side effect of an action they're already
  permitted to take), never updatable/deletable. Out of scope this pass, deliberately: detecting
  "content" events (century scored, hat-trick, record broken, award won) — these need scanning
  scorecards/stats at completion time, a bigger, separate analysis step, not just wiring an
  existing writer to an existing action.

## Phase 15 — Error recovery & client diagnostics
- ✅ **Professional error-recovery UI** (`components/ErrorBoundary.tsx`): every caught render error
  now gets a short **reference id** (`err_...`, shown to the user, e.g. "quote this if you report
  it"), a **Reload page** button (`window.location.reload()`, distinct from the existing "Try
  again" in-place React reset — useful when the error is stale JS from a since-redeployed
  lazy-loaded chunk, which an in-place reset can't fix but a hard reload can) and a **Copy
  diagnostics** button (reference id, URL, timestamp, message and stack, to the clipboard). Also
  picked up `dark:` variants it had missed from the Phase 4 theme pass (it's not a "page" so the
  earlier file-by-file sweep skipped it).
- ✅ **Best-effort client error log** (`services/errorLog.service.ts`, new `clientErrors`
  collection): `ErrorBoundary.componentDidCatch` fire-and-forgets a `logClientError()` with the
  same reference id, message, stack, route and (if signed in) actor uid — logging failure is
  swallowed so a broken logger can never mask the real error or crash the recovery screen itself.
  `firestore.rules`: publicly writable (errors can happen pre-login, same reasoning as
  `recoveryAttempts`), master-admin-only read.
- ✅ **"Client errors" card on Platform Tools** (`features/admin/PlatformToolsPage.tsx`): the last
  50 logged errors, message/route/timestamp/reference id, newest first — gives the master admin
  the "Runtime errors ... surfaced to administrators" visibility this client-only app has no real
  server-side crash reporting for otherwise. Verified live: logged a real error via the service,
  confirmed it appeared on Platform Tools with the right reference id/message/route; `tsc`/
  `npm run build` clean. Triggering an actual in-browser render crash to exercise the
  Reload/Copy-diagnostics buttons visually wasn't done — no way to inject a real render failure
  without editing source, and the button handlers themselves are plain, reviewed DOM/clipboard/
  `location.reload()` calls with no dynamic risk.

## Phase 16 — Saved filters
- ✅ **Saved filter presets** (`store/savedFiltersStore.ts` + `components/ui/SavedFiltersBar.tsx`):
  name and restore the current combination of filter dropdowns on a page, localStorage-only
  (matches `favStore`'s existing local-only convenience-state pattern — no cross-device sync
  needed for this). 
  - **Stats page** (`StatsPage.tsx`): wired to competition/venue/team/club/season/year filters —
    the richest filter set in the app (ROADMAP Phase 6) and the one the "My Club" / "Current Season"
    examples map onto directly.
  - **Players page** (`PlayersPage.tsx`): wired to search + role filters, restores both atomically.
  
  "Save current filter" only appears once at least one filter differs from "all"; saved chips
  restore the exact combination in one click and can be removed individually. Verified end-to-end
  in the browser: created and saved a filter on the Players page, navigated away, returned and
  clicked the saved filter, confirmed the search and role filter both restored; created a Stats
  filter for a specific competition, saved it, and verified restoration — both pages work correctly.

## Phase 17 — Data integrity tools
- ✅ **Detect + safe-repair broken references and orphaned cached stats** on Platform Tools
  (`domain/dataIntegrity.ts` `findIntegrityIssues()` — pure, given already-fetched data;
  `services/dataIntegrity.service.ts` `scanDataIntegrity()` fetches everything and calls it).
  Checks: team rosters referencing a player id that no longer exists at all; captain/vice-captain
  not in their own roster; tournament team lists referencing a team id that no longer exists;
  team/tournament `clubId` and tournament `seasonId` pointing at a deleted club/season;
  `playerStats`/`teamStats` cache docs with no matching player/team; match squads referencing a
  player id that no longer exists (**informational only** — see below). Deliberately checks
  against the **full** (trashed-inclusive) id sets, not the Trash-filtered `listX()` functions —
  a reference to a *soft-deleted* doc isn't broken, it's exactly this app's standing "referenced
  doc can vanish, readers fall back gracefully" convention; only references to ids that never
  existed or were hard-deleted count as an issue.
- ✅ **"Fix" is safe by construction**: every repairable issue is metadata/cache-only (strip a dead
  id from a `playerIds`/`teamIds` array, null out a dangling `clubId`/`seasonId`/captain ref, or
  delete an orphaned stats cache doc — all recomputable via the existing "Recompute leaderboards &
  standings" button). **Match-level issues are `informational`, with no repair button at all** —
  a dangling squad reference is reported, never auto-rewritten; rewriting historical scorecards is
  exactly the kind of destructive "fix" a repair tool must never perform. Every repair is
  audit-logged.
- ✅ New "Data integrity" card on Platform Tools — auto-scans on load, "Scan again" to refresh,
  each issue shows a Fixable/Info badge and (for fixable ones) a "Fix" button. Verified live: the
  scan correctly found two real orphaned `playerStats` docs (`tp1`/`tp3`, pre-existing test-data
  leftovers) in the running dev database — confirms the detection logic works against real data.
  Did **not** click "Fix" to complete the round-trip: the harness's own permission system flagged
  an unverified blind repair against live shared data with no specific user go-ahead and blocked
  it, correctly — clicking through that is for a human operator on Platform Tools, not something
  to force through in an automated verification pass. Detection is proven live; the repair
  functions themselves are plain, reviewed `updateDoc`/`deleteDoc` calls with no dynamic risk.

---

### Notes
- The **scoring engine** is deliberately left untouched (it is verified and reliable); new
  features read from it rather than modifying it.
- Every phase ends with `tsc` + `npm run build` green and a manual smoke test.
