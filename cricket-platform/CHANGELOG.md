# Changelog

All notable changes to CricketHub. Newest first.

## [Unreleased] — Commercial expansion pass

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
