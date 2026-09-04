# CricketHub — Roadmap V6 (Full-Platform Build)

This roadmap tracks the "CRICKETHUB COMPLETE PLATFORM BUILD" master prompt — a 79-section brief
asking for live streaming, live recording, ball-to-video, AI everything, a social/discovery layer,
rankings/reputation, tournament reports, subscriptions, and native mobile integrations, on top of
the existing scoring/stats/tournament platform.

**Reality check, stated up front, because the brief itself demands it (§77 "No fake
functionality", §78 "Final feature audit"):** this is realistically a multi-month, multi-engineer
project. One session cannot build all 79 sections to the brief's own bar — "the actual functionality
must work," never mark something BUILT because the UI exists. So this roadmap is worked the way
every other roadmap in this repo is worked: **one complete, verified slice at a time**, each slice
shippable and honestly audited before the next starts, rather than a shallow pass leaving 79 half-
wired stubs. What follows is Slice 1 plus a grounded status for every other section.

**Standing rules**, same as `ROADMAP_V5*`:
- `src/domain/scoring.ts` and `Delivery`/`BallInput` are not modified.
- Every slice: `tsc` (app + worker) + `oxlint` + `vite build`, verified before commit.
- No fabricated data, no fake progress states, no feature labeled "AI" without a real model call.

---

## Slice 1 — Media/Broadcast engine: live streaming, recording, replay, ball-to-video ✅ Built

Covers §22–35 (live score presentation reuses the existing engine unmodified; live streaming, live
broadcast controls, live recording, recording states/metadata, Live Share's video half, the public
live match page's video half, match video, replay, video player, clip editor, ball-to-video). Full
architecture writeup in `CHANGELOG.md`'s "Media/Broadcast engine" entry — summary:

- Real WebRTC peer-to-peer video (browser camera → Firestore-signaled peer connections → spectator
  browsers), not a simulation. Mesh topology, not a media-server broadcast — practical for a
  spectator count in the tens, not built to scale to thousands, because there's no SFU/media
  provider account in this project.
- Real client-side recording (`MediaRecorder` on the broadcaster's own stream) uploaded to R2 once
  the broadcast stops. Continues through spectators connecting/disconnecting/the page closing —
  genuinely so, since it never touches the peer connections. Does **not** survive the broadcaster's
  own device failing before `stop()` — no server-side capture exists without a paid provider.
- Match videos (live-recorded or directly uploaded) with real states — never shows "Replay ready"
  before the file exists.
- Ball-to-video: every scored ball is auto-tagged with a real elapsed-seconds-into-the-recording
  offset while a broadcast is actively recording; nothing is guessed or hand-entered.
- Clips are saved time-range bookmarks (play by seeking) — there's no video transcoding pipeline in
  this project, so a clip is never presented as a separately rendered/exported file.

**Not built in this slice, and why:**
- **A managed streaming fallback / SFU** for audiences beyond mesh scale — needs a provider account
  (Cloudflare Stream, LiveKit Cloud, etc.) and API keys this session doesn't have.
- **Server-side recording independent of the broadcaster's device** — same blocker; genuinely
  requires a media server or provider doing the capture, not client code.
- **Score overlays/broadcast-style presentation graphics** (§22) — the plain live-score UI already
  exists (`MatchPage`) and the video now sits alongside it; a dedicated overlay/graphics layer is
  future work, not started.
- **AI highlight generation from the recording** (§36–37) — see AI Engine below; the ball-to-video
  linking this needs is now in place, so this is unblocked for a follow-up slice once/if a real AI
  API is configured.

---

## Full 79-section audit

Legend: **BUILT** (working end-to-end, verified) · **PARTIAL** (real subset works) · **NOT BUILT**
(not started this session) · **BLOCKED** (needs an external account/credential/decision this session
cannot supply) · **PRE-EXISTING** (already true before this session, unrelated to this brief).

| § | Item | Status | Note |
|---|---|---|---|
| 1–4 | Inspect repo / respect restrictions / autonomous decisions / implementation loop | Followed | Process sections, not features. |
| 5 | Social + discovery | NOT BUILT | Data model designed (types added: `Follow`, community/discovery), no UI/services yet. |
| 6 | "Looking For" system | NOT BUILT | `LookingForPost`/`LookingForResponse` types + Firestore rules added this session; no service/UI. |
| 7 | Cricket community feed | NOT BUILT | `CommunityPost`/`PostLike` types + rules added; no service/UI. |
| 8 | Following | NOT BUILT | `Follow` type + rules added; no service/UI. |
| 9 | Stories | NOT BUILT | |
| 10 | Opportunities + networking | NOT BUILT | Same underlying model as §6; UI not built. |
| 11 | Public player profiles | PARTIAL (pre-existing) | `PlayerPage.tsx` already shows stats/career/teams; no ratings/reputation/badges/videos section yet. |
| 12 | Career history | PARTIAL (pre-existing) | Derivable from `stats.ts`/`playerTimeline.ts` already; not surfaced as a distinct "career" UI. |
| 13 | Awards + badges | PARTIAL (pre-existing) | `domain/awards.ts`/`domain/achievements.ts` exist and are real-data-driven; no unified badge shelf UI. |
| 14 | Ratings + reputation | NOT BUILT | No rating collection/anti-abuse logic exists. |
| 15 | Official profiles (scorers/umpires) | NOT BUILT | No umpire/scorer-as-a-profile concept beyond the existing `Role`. |
| 16 | Rankings engine | NOT BUILT | `stats.ts`/`records.ts` are a real foundation; no cross-player ranking computation yet. |
| 17 | Advanced leaderboards | PARTIAL (pre-existing) | `buildLeaderboards()` in `stats.ts` + `LeaderboardCard.tsx` already cover runs/wickets/etc. |
| 18 | Tournament pages | PARTIAL (pre-existing) | `TournamentPage.tsx` already covers fixtures/standings/results/sponsors; no media/highlights section. |
| 19 | Tournament reports + PDF export | NOT BUILT | `matchExport.ts`/`tournamentExport.ts` do CSV/JSON; no PDF. |
| 20 | Tournament branding + sponsors | BUILT (pre-existing) | `Sponsor[]`/`bannerURL` already on `Tournament`, rendered on `TournamentPage`. |
| 21 | Organizer dashboard | PARTIAL (pre-existing) | `PlatformToolsPage`/tournament admin surfaces exist; not a single unified organizer view. |
| 22 | Live score presentation | PARTIAL | Plain live score UI pre-existing + reused; broadcast-style overlay graphics not built. |
| 23 | Actual live streaming | **BUILT (Slice 1)** | Real WebRTC, mesh-scale limitation documented above. |
| 24 | Live broadcast controls | **BUILT (Slice 1)** | Start/stop/camera-switch/mute/video-toggle; states never lie about actual stream state. |
| 25 | Live recording | **BUILT (Slice 1), with a disclosed limitation** | Client-side capture; not server-independent (see above). |
| 26 | Recording states | **BUILT (Slice 1)** | `RecordingStatus` state machine, never fakes "ready". |
| 27 | Recording metadata | **BUILT (Slice 1)** | `MatchVideo`/`Broadcast.recording` fields. |
| 28 | Live Share | PARTIAL | Public match URL/QR/share already existed pre-session; broadcast is now attached to the same match page. Enable/disable/revoke token flow not added. |
| 29 | Public live match page | **BUILT (Slice 1) for video** | Score/commentary/etc. pre-existing; live video now included. |
| 30 | Live score + video independence | **BUILT (Slice 1)** | Scoring and broadcast are separate Firestore docs/subsystems by construction. |
| 31 | Match video (uploaded + recorded) | **BUILT (Slice 1)** | Both kinds share `MatchVideo`, clearly tagged `kind`. |
| 32 | Replay | **BUILT (Slice 1)** | Same match page swaps live→replay once a ready video exists. |
| 33 | Video player | **BUILT (Slice 1)** | Standard HTML5 controls via `ReplayPlayer`. |
| 34 | Clip editor | PARTIAL (Slice 1) | Save a time-range bookmark; no trim-preview scrubber UI yet (numeric start/end only). |
| 35 | Ball-to-video | **BUILT (Slice 1)** | Auto-timestamped from a real recording; "key moments" list on `MatchPage`. |
| 36–37 | Automatic/AI highlights | NOT BUILT / BLOCKED for the "AI" half | Candidate-moment data (wickets/boundaries + timestamp) now exists from Slice 1; auto-clip generation from it is unstarted; real AI ranking needs an AI API this environment doesn't have configured. |
| 38 | AI past-match insights | BLOCKED | No AI API configured. `domain/insights.ts` already provides real, non-AI heuristic analysis. |
| 39 | AI momentum | PARTIAL, non-AI | `winProbability.ts`/`insights.ts` already compute real momentum-adjacent heuristics; not framed as "AI". |
| 40 | AI phase analysis | NOT BUILT | Real powerplay/middle/death splits are computable from existing ball data; not built yet. |
| 41 | AI opponent analysis | NOT BUILT | `headToHead.ts` exists at team level only. |
| 42 | AI live-match analysis | PARTIAL, non-AI | Win probability is live already; projected score/pressure framing not built. |
| 43 | AI tactical recommendations | BLOCKED | Needs real AI generation to avoid inventing advice; not attempted. |
| 44 | AI post-match coaching | BLOCKED | Same reason. |
| 45 | AI commentary | BLOCKED | Real AI generation required to avoid inventing events; not attempted. |
| 46–50 | Advanced analytics / form / toss / comparisons | PARTIAL (pre-existing) | `ROADMAP_V5_PLATFORM.md` already tracks and partially delivers these (win probability, expected score, batter-vs-bowler, partnerships). Toss insights and current-form snapshot not built. |
| 51 | Global search | PARTIAL (pre-existing) | `SearchPage.tsx`/`search.service.ts` exist for players/teams/tournaments; opportunities/venues not indexed (don't exist yet). |
| 52 | Venue discovery | NOT BUILT | No venue-as-an-entity model exists (`venue` today is a free-text field on `Match`/`Tournament`). |
| 53 | Moderation | PARTIAL | `ContentReport` type + Firestore rules added this session for the new social surfaces; no admin review UI, and pre-existing content (comments) has no report path yet. |
| 54 | Privacy + security | Reviewed for this slice | New rules follow existing owner/master/delegated-scorer patterns exactly; broadcast signaling docs are the one deliberately-open (anonymous-write) surface, justified above and scoped to carry only WebRTC payloads. Full platform-wide re-audit out of scope for one slice. |
| 55 | Notifications | PRE-EXISTING, not extended | `notifications.service.ts` exists; not wired to broadcast-started/recording-ready events this session. |
| 56 | Custom themes | PRE-EXISTING | Dark mode/appearance prefs already exist (`prefsStore`). |
| 57–59 | PRO / ad-free / premium community | PARTIAL (pre-existing) | `ROADMAP_V5_PLATFORM.md` Phase C covers entitlement architecture (mock billing only, by design — no real payment processor configured). |
| 60 | Merchandise | NOT BUILT | |
| 61 | Apple Watch | BLOCKED | Native app development is outside a web session's reach; no data contract defined yet. |
| 62 | iOS Live Activities | BLOCKED | Same — no contract defined yet. |
| 63 | Performance | Followed for Slice 1 | New Firestore reads use client-side filtering matching this codebase's existing convention for low-cardinality per-match subcollections (see `subscribeMatchVideos`/`subscribeClips` comments); no new unindexed cross-collection queries added. |
| 64 | AI cost control | N/A | No AI calls exist yet to control the cost of. |
| 65 | Mobile-first | Followed for Slice 1's UI | New components use the existing responsive primitives/Tailwind conventions; not device-tested in this session (no browser preview available here — see Testing note below). |
| 66 | Offline scoring independence | Preserved | Broadcast/recording code never touches `scoring.service.ts`/`scoring.ts`; a broadcast failure cannot block `recordBall`. |
| 67 | Real error handling | Followed for Slice 1 | Every new async path (camera permission, WebRTC connect, upload) has a distinct loading/failure state surfaced via toast or inline UI — no fake success. |
| 68–74 | Testing (existing platform, new systems, production) | NOT DONE THIS SESSION | This remote environment has no way to launch a browser against a live Firebase project or grant camera/mic permissions — `tsc`+`build`+`lint` verified the code compiles and types are sound; the WebRTC/recording acceptance tests in §69–71 require a real two-browser manual run, which needs a human (or a follow-up session with browser automation + real Firebase credentials + camera permission). **This is the single most important caveat on Slice 1**: the code is real and unfaked, but it has not been observed working live end-to-end in this session. |
| 75 | Feature priority order | Followed | Slice 1 = priorities 1–3 exactly (live streaming, live recording, ball-to-video). |
| 76 | Shared systems (6 "engines") | Media/Broadcast engine started | Discovery, Identity/Reputation, Analytics, AI, Community, Entitlement engines: only data-model scaffolding added this session (types + Firestore rules for discovery/social), no service/UI layer. |
| 77 | No fake functionality | Followed | See per-item notes above; every BUILT item is real, every blocked item says exactly what's missing. |
| 78 | Final feature audit | This table | |
| 79 | Final report | See below | |

---

## Final report (Slice 1)

**Implementation summary**: real WebRTC live streaming + client-side live recording + match
video/replay + ball-to-video, wired end-to-end from the scorer's broadcast panel through to the
public match page, on top of the existing scoring/match infrastructure (untouched).

**Architecture**: see `CHANGELOG.md`. Media/Broadcast engine = Firestore-signaled WebRTC mesh +
`MediaRecorder` capture + Cloudflare R2 (via the existing `crickethub-media` Worker, extended for
video) + new `MatchVideo`/`Clip`/`Broadcast` Firestore collections.

**Firestore changes**: `broadcasts` (+ signaling subcollections), `matchVideos`, `clips`,
`videoUsage`, `r2VideoObjects` — plus data-model-only scaffolding for `lookingForPosts`,
`lookingForResponses`, `follows`, `communityPosts`, `postLikes`, `contentReports` (types + rules,
no services/UI yet — staged for the next slice, not left half-built in the UI).

**Security changes**: new rules mirror this file's existing owner/master/delegated-scorer patterns;
the one new open-write surface (anonymous viewer signaling docs) is scoped to WebRTC-only payloads
and justified inline in the rules file itself.

**R2/streaming/recording/replay/ball-to-video architecture**: see Slice 1 section above.

**Routes**: none added — the media UI lives inside the existing `/scoring/:id` and `/match/:id`
routes rather than new pages.

**Completed features**: Slice 1's media/broadcast engine, as detailed above.

**Partial features**: clip editor (no scrub UI), Live Share (video attached, but token
enable/disable/revoke not touched), several pre-existing analytics/leaderboard/profile surfaces
that already partially satisfy later brief sections.

**Blocked features, and exactly what unblocks them**:
- Any **real AI** feature (highlights ranking, commentary, coaching, tactical recommendations) —
  needs an AI API key/provider configured for this project (none exists today).
- **Managed/server-side streaming or recording** beyond the WebRTC mesh — needs a media-provider
  account (Cloudflare Stream, Mux, LiveKit Cloud, or similar) and its API credentials.
- **Apple Watch / iOS Live Activities** — needs native app development outside this session's reach;
  no data contract defined yet, so even the "define the contract" half of §61–62 is still open.
- **Real billing/subscriptions** — `ROADMAP_V5_PLATFORM.md` already flags this as needing a provider
  decision from the project owner.

**Tests**: `tsc` (app `tsconfig.app.json` + worker) clean, `vite build` clean, `oxlint` clean (no
new warnings). **No live browser/two-peer WebRTC test was run** — this environment has no way to
launch a browser with camera/mic permission against a real Firebase project. Treat Slice 1 as
code-verified, not yet runtime-verified; the next step before calling it fully done is a manual
two-device test following §69–71's acceptance steps.

**Production/deployment status**: not deployed. `firestore.rules` and the `worker/` changes need
`firebase deploy --only firestore:rules` and `wrangler deploy` respectively before they take effect
anywhere — nothing in this session deploys automatically.

**Environment variables / provider requirements for what's blocked**: an AI provider key (for
§36–45), a media-streaming provider's API credentials (for a non-mesh, server-recorded stream),
Apple Developer Program access (for §61–62), a payment processor's credentials (for real billing).

**Remaining limitations, stated plainly**: the live stream is peer-to-peer and only exists while the
broadcaster's browser tab stays open; the recording is not independent of the broadcaster's device
crashing; per-video upload is capped at 90MB by this Worker's request-body ceiling.

**Next slices**, in the brief's own priority order: player/team discovery + Looking For + community
feed + following (data model already staged this session); rankings/reputation; the
tournament-report PDF export; the non-AI advanced-analytics items (toss insights, current form,
phase/opponent analysis) that don't need any blocked provider.
