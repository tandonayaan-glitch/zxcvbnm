# Changelog

All notable changes to CricketHub. Newest first.

## [Unreleased] — Commercial expansion pass

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
