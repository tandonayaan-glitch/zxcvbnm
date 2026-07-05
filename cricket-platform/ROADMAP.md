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
- 🟡 Resilience to legacy/foreign docs (missing `displayName`, `status`, etc.) — hardened where hit

## Phase 1 — Master Admin platform tools & audit (THIS PASS)
- ✅ Audit log (`auditLogs` collection + service, records admin actions)
- ✅ Master-Admin **Platform Tools** page (exclusive): recompute leaderboards, rebuild stats
- ✅ **Clear leaderboards** danger flow: full-screen warning, "I understand…" checkbox, type `CLEAR LEADERBOARDS`, final confirm, audit-logged
- ✅ Audit log viewer (master admin)
- ⬜ System diagnostics / Firestore usage stats · offline-queue force-resync · platform backup export

## Phase 2 — Match Centre analytics (THIS PASS)
- ✅ Worm graph (cumulative runs), Manhattan (runs/over), run-rate — SVG, from delivery data
- ✅ Match insights panel (biggest over, best partnership, boundary %, dot-ball %, powerplay) — pure computation from deliveries
- ⬜ Wagon wheel · pitch/bowling map · win probability · momentum · chase predictor
- ⬜ Turning point / best spell, boundary/wicket timeline polish

## Phase 3 — Player account lifecycle
- ⬜ Auto-create linked user account on player create (`user####`, Pending Registration, temp password)
- ⬜ First-login activation (choose username/password, complete profile) → activate
- 🟡 Cricket-based password recovery (fuzzy name match exists at `/recover`; add match-history Q&A verification, rate limiting, cooldowns, recovery audit)
- ⬜ Claim / merge duplicate player profiles (master-admin merge tool preserving stats + audit)

## Phase 4 — Settings & user profile
- 🟡 Background customization (pill + panel + presets, persisted locally) — ✅ done earlier
- ⬜ Unified Settings page on every dashboard: profile pic, display name, bio, email, change password, appearance (light/dark/system/high-contrast, density, reduced motion, font scale), privacy, sessions, export data
- ✅ Cross-device persistence of preferences (Firestore `userPrefs`) — pull/seed on sign-in (remote wins), debounced push on change, resets on sign-out
- ✅ Global undo toasts for create/edit actions (Players, Teams, Tournaments)

## Phase 5 — Player / Team / Tournament depth
- 🟡 Player profile: career/batting/bowling/fielding stats + match log + follow (✅); add season/tournament splits, achievements, awards cabinet, milestones, radar/progress charts, rankings, timeline
- 🟡 Team profile: squad, recent, record, leaders (✅); **recent-form guide (W/L/T chips), win-rate/record summary, top run-scorer & wicket-taker** (✅); add honours, home/away splits, records
- 🟡 Tournament: standings, fixtures, leaders, teams (✅); **records tab** (✅ highest/lowest team
  total, highest individual score, best bowling figures, most sixes/fours in an innings, biggest
  win by runs/wickets — all derived from cached innings cards, no delivery reads); **knockout
  bracket** (✅ per-match `stage` set in the setup wizard, rounds rendered left-to-right with
  winner highlighting — `domain/bracket.ts`); add group tables within group-knockout, awards,
  qualification tracker, timeline

## Phase 6 — Global leaderboards & rankings
- ✅ Global leaderboards (runs, wickets, avg, SR, economy, 4s, 6s, best bowling, fielding) + Stats page
- ⬜ Filters (season/tournament/club/team/venue/year/month), MVP score, consistency & player rating, per-scope ranks

## Phase 7 — Offline scoring hardening
- ✅ Firestore IndexedDB persistent cache (writes queue offline, sync on reconnect)
- ⬜ Explicit event queue model, offline badge, sync-progress indicator, queue-inspection page, manual/force resync

## Phase 8 — Clubs & Seasons architecture
- ⬜ Club (top-level org) + Season entities; Team→Club, Tournament→Club+Season
- ⬜ Club profile pages, season archive, hall of fame
- ⬜ Backwards-compatible migration for existing data

## Phase 9 — Exports, accessibility, performance
- ⬜ PDF/printable scorecard, CSV/JSON export, match archive, import + duplicate detection
- ⬜ Accessibility: full keyboard nav, ARIA, focus rings, colour-blind palettes, large-text mode
- ⬜ Performance: lazy routes, pagination/virtualisation, memoisation, query batching

---

### Notes
- The **scoring engine** is deliberately left untouched (it is verified and reliable); new
  features read from it rather than modifying it.
- Every phase ends with `tsc` + `npm run build` green and a manual smoke test.
