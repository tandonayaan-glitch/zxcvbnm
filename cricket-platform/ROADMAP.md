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
- 🟡 Resilience to legacy/foreign docs (missing `displayName`, `status`, etc.) — hardened where hit;
  **`listUsers()` now falls back to the doc key for `id`** (✅ — a legacy doc missing it silently
  broke role/ban actions for that user)

## Phase 1 — Master Admin platform tools & audit (THIS PASS)
- ✅ Audit log (`auditLogs` collection + service, records admin actions)
- ✅ Master-Admin **Platform Tools** page (exclusive): recompute leaderboards, rebuild stats
- ✅ **Clear leaderboards** danger flow: full-screen warning, "I understand…" checkbox, type `CLEAR LEADERBOARDS`, final confirm, audit-logged
- ✅ Audit log viewer (master admin)
- ✅ **Platform backup export** (JSON snapshot of players/teams/tournaments/matches+deliveries/
  users — `domain/platformExport.ts`, audit-logged)
- ✅ **System diagnostics** (`services/diagnostics.service.ts`): Firestore document counts via
  server-side aggregate queries + online/offline badge, on Platform Tools
- ⬜ offline-queue force-resync

## Phase 2 — Match Centre analytics (THIS PASS)
- ✅ Worm graph (cumulative runs), Manhattan (runs/over), run-rate — SVG, from delivery data
- ✅ Match insights panel (biggest over, best partnership, boundary %, dot-ball %, powerplay) — pure computation from deliveries
- 🟡 **Head-to-head record + star performers + live projected score/chase-rate comparison** on the
  match page (✅ `domain/headToHead.ts`, `domain/matchPerformers.ts`, `projectedScore` in
  `lib/format.ts`); add wagon wheel · pitch/bowling map · full win-probability model
- 🟡 **Best bowling spell + boundary/wicket timeline + momentum** in Match Insights (✅ tightest
  2–4 over economy stretch per bowler; ✅ colour-coded ball-order timeline of every 4/6/wicket;
  ✅ last-3-overs rate vs overall, accelerating/slowing/steady); add turning point

## Phase 3 — Player account lifecycle
- ⬜ Auto-create linked user account on player create (`user####`, Pending Registration, temp password)
- ⬜ First-login activation (choose username/password, complete profile) → activate
- 🟡 Cricket-based password recovery (fuzzy name match exists at `/recover`; add match-history Q&A verification, rate limiting, cooldowns, recovery audit)
- ⬜ Claim / merge duplicate player profiles (master-admin merge tool preserving stats + audit)

## Phase 4 — Settings & user profile
- 🟡 Background customization (pill + panel + presets, persisted locally) — ✅ done earlier
- 🟡 Unified Settings page on every dashboard (✅ profile pic/display name/bio/email, change
  password, appearance — text size/density/reduced motion/high contrast — and now
  **self-service "export my data" (JSON)**); add privacy, sessions
- 🟡 **Light/dark/system theme** (✅ `theme` pref in `prefsStore`, synced cross-device like the
  other appearance prefs, live OS-preference listener for "system", Light/Dark/System toggle on
  Settings; scoped to app-shell chrome — page background, sidebar/header/footer, `PageHeader`
  titles — deliberately, since flipping every page's own card/text colours safely needs a broader
  follow-up pass to avoid dark-text-on-dark-background contrast bugs); add full per-page dark
  styling
- ✅ Cross-device persistence of preferences (Firestore `userPrefs`) — pull/seed on sign-in (remote wins), debounced push on change, resets on sign-out
- ✅ Global undo toasts for create/edit actions (Players, Teams, Tournaments)

## Phase 5 — Player / Team / Tournament depth
- 🟡 Player profile: career/batting/bowling/fielding stats + match log + follow, achievements, awards cabinet (✅); **per-tournament splits tab** (✅ `domain/playerSplits.ts`); **recent-form charts** (✅ batting/bowling SVG bars — `components/charts/PlayerForm`); **global
  rankings strip** (✅ runs/wickets/sixes rank); **career timeline** (✅ `domain/playerTimeline.ts`);
  **player-vs-player comparison** (✅ `/compare`); **radar profile chart** (✅ `domain/radar.ts` +
  `components/charts/PlayerRadar`); **season splits** (✅ `playerSeasonSplits` in
  `domain/playerSplits.ts` buckets by season via each match's tournament -> season lookup; "By
  season" tab shown once a player has at least one match under a seasoned tournament)
- 🟡 Team profile: squad, recent, record, leaders (✅); **recent-form guide (W/L/T chips), win-rate/record summary, top run-scorer & wicket-taker** (✅); **honours (knockout titles) + team records** (✅ highest total/chase, biggest wins, best individual batting/bowling — `domain/teamRecords.ts`); **record vs opponents + record by venue** (✅ `domain/teamOpponents.ts`, `domain/teamVenues.ts`);
  **runs-scored form chart** (✅ `components/charts/TeamForm`);
  **team-vs-team comparison** (✅ `/compare/teams`)
- 🟡 Tournament: standings, fixtures, leaders, teams (✅); **records tab** (✅ highest/lowest team
  total, highest individual score, best bowling figures, most sixes/fours in an innings, biggest
  win by runs/wickets — all derived from cached innings cards, no delivery reads); **knockout
  bracket** (✅ per-match `stage` set in the setup wizard, rounds rendered left-to-right with
  winner highlighting — `domain/bracket.ts`); **awards tab** (✅ Player of the Tournament MVP +
  best batter/bowler/all-rounder/economy/sixes/most-POTM — `domain/awards.ts`); standings robust
  to deleted team docs (✅); **group tables within group-knockout** (✅ per-team group label set in
  the tournament form, `domain/groups.ts` reuses `computeStandings` per group, "Groups" tab shown
  when configured); add qualification tracker, timeline

## Phase 6 — Global leaderboards & rankings
- ✅ Global leaderboards (runs, wickets, avg, SR, economy, 4s, 6s, best bowling, fielding) + Stats page
- 🟡 **Competition + venue + team filters, all-time Records tab, MVP/impact rating, consistency
  rating on the Stats page + per-tournament player rank** (✅ composable competition/venue/team
  filters recompute boards, totals, records, impact and consistency leaderboards —
  `domain/consistency.ts`; ✅ per-tournament runs rank on the player "By tournament" tab); **season/
  club/year filters** (✅ same composable, non-cross-narrowing pattern — options derived from the
  competition-scoped matches via each match's tournament -> club/season lookup, or match date for
  year; selects stay hidden until real club/season data exists)

## Phase 7 — Offline scoring hardening
- ✅ Firestore IndexedDB persistent cache (writes queue offline, sync on reconnect)
- 🟡 **Global offline banner** (✅ `useOnlineStatus` + `OfflineBanner`); add explicit event queue
  model, sync-progress indicator, queue-inspection page, manual/force resync

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
  `domain/playerExport.ts`); add PDF, match archive, import + duplicate detection
- 🟡 Accessibility: focus rings, large-text mode, high-contrast (✅ earlier); **skip-to-content
  link + `main` landmarks + nav `aria-current`/labels** (✅); **colour-blind friendly palette**
  (✅ `colorBlind` pref remaps the `pitch-*` green token to teal via a `.colorblind` CSS-variable
  override — covers every Tailwind-class usage of pitch plus the few chart/SVG spots that read the
  same CSS variable; standalone decorative icon tones left as-is since they don't pair information
  with colour alone); add full ARIA audit
- 🟡 Performance: **lazy-loaded routes / code-splitting** (✅ `React.lazy` + `Suspense` per route);
  **memoised TeamPage/PlayerPage/MatchPage/TournamentPage analytics** (✅ `useMemo`, incl. the
  live-scoring MatchPage which re-renders every ball); **batched backup-export delivery reads**
  (✅ `Promise.all` instead of sequential per-match reads); add pagination/virtualisation

---

### Notes
- The **scoring engine** is deliberately left untouched (it is verified and reliable); new
  features read from it rather than modifying it.
- Every phase ends with `tsc` + `npm run build` green and a manual smoke test.
