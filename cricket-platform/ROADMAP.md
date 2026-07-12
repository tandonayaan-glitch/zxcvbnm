# CricketHub — Product Roadmap

This roadmap tracks the "commercial platform" expansion (MyCricketApp / CricHeroes /
GullyScore parity). It is intentionally phased: the app stays shippable at every step,
existing data and working features are preserved, and no phase leaves placeholders.

Legend: ✅ done · 🟡 partial / in progress · ⬜ planned

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
- 🟡 **Head-to-head record + star performers + live projected score/chase-rate comparison** on the
  match page (✅ `domain/headToHead.ts`, `domain/matchPerformers.ts`, `projectedScore` in
  `lib/format.ts`; ✅ **win-probability bar** for the chasing side — `domain/winProbability.ts`
  `chaseWinProbability()`, a transparent required-rate/wickets-in-hand heuristic, explicitly labelled
  "heuristic estimate" rather than a trained model, since there's no historical ball-by-ball dataset
  in this app to fit one on); add wagon wheel · pitch/bowling map — both need shot-direction/
  line-length data that isn't captured anywhere in the scoring flow today; adding it would mean
  extending the ball-input UI during live scoring, a materially bigger feature than an analytics
  read over existing data, so it's left for a dedicated future slice rather than faked
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
- 🟡 Cricket-based password recovery (fuzzy name match exists at `/recover`; add match-history Q&A verification, rate limiting, cooldowns, recovery audit)
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
  Player/Tournament/Settings pages, 157/158 on Stats
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
- ⬜ Explicit event queue model / queue-inspection page listing individual pending writes: not
  implementable honestly — the Firestore client SDK's offline queue is internal and doesn't expose
  enumerable pending mutations (no public API returns "what's queued"). `forceResync()` covers the
  real, exposable part of this (force a resync, know whether it flushed); a literal queue list
  would have to be faked to exist at all.

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
- 🟡 **Printable scorecard (print CSS) + CSV/JSON export** from the match page (✅
  `domain/matchExport.ts`), **tournament standings/leaders export** (✅
  `domain/tournamentExport.ts`) **and player career/splits/match-log export** (✅
  `domain/playerExport.ts`); **PDF export** (✅ "Print / Save as PDF" buttons on the Match,
  Tournament and Player pages — reuse the existing print stylesheet via `window.print()`, the
  standard way a client-only app produces a real PDF without shipping a PDF-rendering library;
  a generated-PDF-in-JS route would just be a worse version of the browser's own "Save as PDF"
  print destination); **duplicate detection** (✅ `domain/duplicateDetection.ts`
  `findDuplicateCandidates()` — fuzzy Levenshtein-based name matching across active players,
  surfaced as a "Suggested duplicates" panel on the merge-players tool with a similarity % and a
  shared-team flag, one click pre-fills the keep/merge pickers; verified live — created two
  near-duplicate test players, confirmed the suggestion appeared at 90% with a working "Review"
  button, cleaned up after); add match archive, import — an import format/source isn't specified
  anywhere in this project, so building one would be guessing a contract no consumer has asked
  for; left for a slice with a concrete source system to import from
- 🟡 Accessibility: focus rings, large-text mode, high-contrast (✅ earlier); **skip-to-content
  link + `main` landmarks + nav `aria-current`/labels** (✅); **colour-blind friendly palette**
  (✅ `colorBlind` pref remaps the `pitch-*` green token to teal via a `.colorblind` CSS-variable
  override — covers every Tailwind-class usage of pitch plus the few chart/SVG spots that read the
  same CSS variable; standalone decorative icon tones left as-is since they don't pair information
  with colour alone); **scoped ARIA pass** (✅ `Modal` and the danger-zone dialog gained
  `role="dialog"`/`aria-modal`/`aria-labelledby`; `Modal`'s and the toast's close/dismiss buttons
  gained `aria-label`; the toast region gained `role="status" aria-live="polite"`; every icon-only
  edit/delete button on the Teams/Tournaments/Clubs & Seasons/Matches/Players list pages gained an
  `aria-label` naming the specific row — previously relied on `title` alone or had no accessible
  name at all); a truly exhaustive audit (every interactive element in the app) is unbounded scope
  and diminishing-returns without a specific target, so this targeted the shared dialog/toast
  primitives (used everywhere) plus the concretely-missing icon buttons found by grepping for them
- ✅ Performance: **lazy-loaded routes / code-splitting** (`React.lazy` + `Suspense` per route);
  **memoised TeamPage/PlayerPage/MatchPage/TournamentPage analytics** (`useMemo`, incl. the
  live-scoring MatchPage which re-renders every ball); **batched backup-export delivery reads**
  (`Promise.all` instead of sequential per-match reads); **client-side pagination** (`usePaginated`
  hook + shared `Pagination` component — Players table 20/page, Teams/Tournaments grids 12/page,
  Matches list 15/page; page clamps automatically when a filter shrinks the list)

---

### Notes
- The **scoring engine** is deliberately left untouched (it is verified and reliable); new
  features read from it rather than modifying it.
- Every phase ends with `tsc` + `npm run build` green and a manual smoke test.
