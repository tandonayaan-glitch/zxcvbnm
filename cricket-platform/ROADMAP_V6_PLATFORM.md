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
- **AI highlight generation from the recording** (§36–37) — see AI Engine below; the ball-to-video
  linking this needs is now in place, so this is unblocked for a follow-up slice once/if a real AI
  API is configured.

---

## Slice 2 — Discovery, Looking For, Community, Following, Reputation, Rankings ✅ Built

Covers §5–17 (Discovery, Looking For, Community, Following, Stories excluded — see below, Player
profile additions, Ratings/Reputation, Official profiles, Rankings, Leaderboards), plus §19 and §22
partially, §48 (Toss Insights). Full writeup in `CHANGELOG.md`.

- **Discovery** (`domain/discovery.ts` + `DiscoverPage`): players/teams/clubs/tournaments, one
  search box + filters (location, skill level, role). Venue/umpire/scorer/commentator discovery
  NOT built — no venue-as-entity or official-directory data model exists.
- **Looking For** (`services/lookingFor.service.ts` + `LookingForPage`): one unified post/response
  model across player/team/opponent/umpire/scorer requests, real expiry, accept/decline.
- **Following** (`services/follow.service.ts` + `FollowToggle`): real Firestore-backed follow with
  a live follower count, distinct from the pre-existing local-only favorites bookmark
  (`FollowButton`/`favStore`, left untouched). Wired into Player/Team/Club/Tournament pages.
  Follower-count reads are client-filtered over the whole `follows` collection (same convention as
  the media engine) — fine at this platform's scale, would need real aggregation before it could
  scale to a large follower base.
- **Community feed** (`services/community.service.ts` + `CommunityFeedPage`): text/poll posts,
  likes, one-vote-per-user enforced by `firestore.rules` itself (not just the client), reporting.
  Match/achievement/announcement/highlight/quiz post *kinds* exist in the type but only `text` and
  `poll` have composer UI — see audit table.
- **Moderation** (`services/moderation.service.ts` + admin `ModerationPage`): a real review queue
  over submitted `ContentReport` docs, not a placeholder page.
- **Reputation** (`Rating`/`ReputationSummary` types + `domain/reputation.ts` +
  `services/ratings.service.ts` + `RatingWidget`): self-rating and duplicate-rating are blocked by
  `firestore.rules` (doc-id scheme + a `linkedUserId` cross-check), not just the UI hiding the
  control. Wired into `PlayerPage` and, for scorer/admin/tournament-manager accounts,
  `UserProfilePage` alongside a real "matches scored" count derived from `Match.scorerId`/
  `createdBy` (never invented).
- **Rankings** (`domain/rankings.ts` + `RankingsPage`): reuses the existing, already-verified
  `buildLeaderboards()` engine with format/location filters, plus a real scorer leaderboard built
  from actual match-scoring counts (no separate "activity score" invented).
- **Toss insights** (`domain/tossInsights.ts`): real win-rate-by-toss-decision correlation,
  explicitly labeled as correlation not causation, surfaced on the Stats page's Records tab.
- **Tournament report** (`TournamentReportPage`): a clean print-to-PDF page — this project has no
  server-side PDF pipeline, so the browser's own print-to-PDF is the honest way to produce a real
  PDF file, not a fabricated "export" button that doesn't actually generate anything.
- **Broadcast-style score overlay** (`components/broadcast/ScoreOverlay.tsx`): a real lower-third
  graphic over the live video, reading straight from the same `Match`/`InningsState` the scoring
  engine writes — not a separate presentation model that could drift from the real score. It's a
  plain HTML overlay on the viewer's page, not composited into the video stream itself, so it
  doesn't appear to anyone re-streaming or screen-recording the raw feed elsewhere; that would need
  server-side compositing, which (like recording) needs a media provider this project doesn't have.
- **Notifications**: best-effort `notify()` calls wired into new-follower (player accounts only —
  team/club/tournament have no single "owner account" that's always meaningful to notify), new
  Looking For response, and post-liked events. A new `community` `NotificationCategory` was added
  (not smuggled into an existing mismatched one).
- **Security hardening applied during this slice's own review** (not left for later): the community
  poll-vote rule was tightened from "touches only these fields" to "adds exactly one new,
  previously-absent voter," with an existence-check guard to avoid an evaluation error on a
  non-poll post; `communityPosts`/`lookingForPosts`/`contentReports` create rules gained the same
  text-length validation `comments` already had, closing an unbounded-text-blob gap that would
  otherwise have shipped.

**Not built in this slice, and why:**
- **Stories** (§9) — not started; would need its own expiry/media model, deprioritized behind the
  above given session time.
- **Venue discovery** (§52) — no venue-as-an-entity model exists (`venue` is a free-text field on
  `Match`/`Tournament` today); would need a new collection + CRUD, not started.
- **Official profiles for umpires/commentators specifically** — `UserProfilePage`'s official section
  covers scorer-type roles (real matches-scored counts exist); this platform's `Role` model has no
  distinct Umpire/Commentator role to hang a similarly-real stat off of, so those aren't shown
  rather than being faked.
- **Match/achievement/announcement/quiz community post kinds** — the `CommunityPost.kind` type
  supports them, `subscribeFeed`/`likePost`/etc. work for any kind, but only `PostComposer`'s
  text/poll UI was built this slice.
- **Real vote-total verification in `firestore.rules`** — the poll-vote rule now requires a genuine
  new voter, but does not (Firestore rules can't sum across array elements) independently re-derive
  that the touched option's vote count moved by exactly one; documented as an accepted, low-severity
  gap for a non-monetary community poll, not silently left unreviewed.
- **Live re-verification of the new/edited `firestore.rules`** — this session has no Firebase
  emulator or live project to run the rules against; every rule was reasoned through by hand and
  cross-checked against the actual service code that calls it, but that is not the same guarantee
  as an emulator test suite. Flagged as the one open item before treating the rules changes as
  fully verified, not just code-reviewed.

---

## Full 79-section audit

Legend: **BUILT** (working end-to-end, verified) · **PARTIAL** (real subset works) · **NOT BUILT**
(not started this session) · **BLOCKED** (needs an external account/credential/decision this session
cannot supply) · **PRE-EXISTING** (already true before this session, unrelated to this brief).

| § | Item | Status | Note |
|---|---|---|---|
| 1–4 | Inspect repo / respect restrictions / autonomous decisions / implementation loop | Followed | Process sections, not features. |
| 5 | Social + discovery | **PARTIAL (Slice 2)** | `DiscoverPage` covers players/teams/clubs/tournaments; venues/officials not built (no such entity model exists). |
| 6 | "Looking For" system | **BUILT (Slice 2)** | One unified post/response model, real expiry, `LookingForPage`. |
| 7 | Cricket community feed | **PARTIAL (Slice 2)** | Text/poll posts, likes, reporting all real; match/achievement/announcement/quiz post kinds exist in the type but have no composer UI yet. |
| 8 | Following | **BUILT (Slice 2)** | Real Firestore-backed follow + live follower count (`FollowToggle`), on Player/Team/Club/Tournament pages. |
| 9 | Stories | NOT BUILT | |
| 10 | Opportunities + networking | **PARTIAL (Slice 2)** | Same model as §6; "networking around shared teams/clubs/follows" isn't surfaced as its own view beyond Discover + Following. |
| 11 | Public player profiles | **PARTIAL, extended (Slice 2)** | Pre-existing stats/career/teams + this slice's ratings widget and (pre-existing) awards/achievements panel; no video/clip section on the profile itself yet (clips exist per-match, not aggregated per-player). |
| 12 | Career history | PARTIAL (pre-existing) | Unchanged this slice — derivable from `stats.ts`/`playerTimeline.ts`, not a distinct "career" UI. |
| 13 | Awards + badges | PARTIAL (pre-existing) | Unchanged this slice — `domain/awards.ts`/`AchievementsPanel` already real-data-driven and shown on `PlayerPage`; no separate "badge shelf" component, but the functionality exists. |
| 14 | Ratings + reputation | **BUILT (Slice 2)** | `RatingWidget`, self/duplicate-rating blocked server-side by `firestore.rules`, not just the UI. |
| 15 | Official profiles (scorers/umpires) | **PARTIAL (Slice 2)** | `UserProfilePage` shows a real matches-scored count + rating for scorer-capable roles; no distinct Umpire/Commentator role exists to extend this to. |
| 16 | Rankings engine | **BUILT (Slice 2)** | `RankingsPage`, format/location filters, real scorer leaderboard. City/state/country specifically use the free-text `Player.location` field (new, optional, user-entered) rather than a structured geography — real but coarser than the brief's exact wording. |
| 17 | Advanced leaderboards | BUILT (pre-existing) | Unchanged — `buildLeaderboards()`/`LeaderboardCard`. |
| 18 | Tournament pages | PARTIAL (pre-existing) | Unchanged this slice beyond the new "Full report" link — media/highlights section still not built. |
| 19 | Tournament reports + PDF export | **BUILT (Slice 2)** | `TournamentReportPage`, real browser print-to-PDF (no server-side PDF pipeline exists, so this is the honest implementation, not a stub). |
| 20 | Tournament branding + sponsors | BUILT (pre-existing) | `Sponsor[]`/`bannerURL` already on `Tournament`, rendered on `TournamentPage`. |
| 21 | Organizer dashboard | PARTIAL (pre-existing) | `PlatformToolsPage`/tournament admin surfaces exist; not a single unified organizer view. |
| 22 | Live score presentation | **PARTIAL, extended (Slice 2)** | Plain live score UI pre-existing; `ScoreOverlay` now adds a real broadcast-style lower-third graphic on the live video, reading the same live match doc — not composited into the raw video stream itself (would need a media provider). |
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
| 46–50 | Advanced analytics / form / toss / comparisons | **PARTIAL, extended (Slice 2)** | `ROADMAP_V5_PLATFORM.md` already delivers win probability, expected score, batter-vs-bowler, partnerships, and recent-form charts (Current Form / Last Five Matches — already built pre-session, see `PlayerForm.tsx`). This slice adds real toss insights (`domain/tossInsights.ts`). Phase (powerplay/middle/death) analysis specifically still NOT BUILT — would need per-ball reads across many matches, deprioritized on performance grounds (§63) rather than built cheaply and wrong. |
| 51 | Global search | PARTIAL (pre-existing) | Unchanged this slice — `SearchPage.tsx` covers players/teams/tournaments/matches/clubs; `DiscoverPage` (new) adds filtering on top for players/teams/clubs/tournaments specifically, but the two aren't merged into one surface. |
| 52 | Venue discovery | NOT BUILT | No venue-as-an-entity model exists (`venue` today is a free-text field on `Match`/`Tournament`). |
| 53 | Moderation | **BUILT for the surfaces that exist (Slice 2)** | Real `ContentReport` submit-and-review flow (`ModerationPage`) wired to the new community feed. Pre-existing content (comments, match reactions) still has no report path — only reachable content is covered, not retrofitted onto everything that predates this slice. |
| 54 | Privacy + security | Reviewed for both slices | New rules follow existing owner/master/delegated-scorer patterns; Slice 2 added a self-review pass that caught and fixed a real gap (poll-vote rule was rewritten from "touches only these fields" to "adds exactly one new voter," plus text-length caps added to 3 collections that lacked them). Broadcast signaling docs remain the one deliberately-open (anonymous-write) surface, justified inline in `firestore.rules`. **Not run against a live Firebase emulator** — every rule was hand-verified against the actual calling code, not test-suite-verified; flagged as the standing gap, not silently assumed fine. |
| 55 | Notifications | **PARTIAL, extended (Slice 2)** | New `community` category; best-effort `notify()` wired to new-follower (player accounts), new Looking For response, and post-liked. Not wired to broadcast-started/recording-ready/match-result/achievement events yet. |
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
| 75 | Feature priority order | Followed | Slice 1 = priorities 1–3 (live streaming, recording, ball-to-video). Slice 2 = priorities 10–16 (discovery, Looking For, social, rankings, scorer/umpire ecosystem, ratings/reputation) plus 18/21/22 opportunistically since they shared infrastructure already in hand. |
| 76 | Shared systems (6 "engines") | Media/Broadcast + Discovery + Identity/Reputation + Community + Opportunity engines started | AI and Entitlement engines untouched — AI genuinely blocked (no model API configured); Entitlement architecture already exists from `ROADMAP_V5_PLATFORM.md` and wasn't extended to gate the new social features (deliberately — community/discovery is free-tier by design, not an oversight). |
| 77 | No fake functionality | Followed | See per-item notes above; every BUILT item is real, every blocked item says exactly what's missing. |
| 78 | Final feature audit | This table | |
| 79 | Final report | See below | |

---

## Final report (Slices 1 + 2)

**Implementation summary**: Slice 1 — real WebRTC live streaming + client-side live recording +
match video/replay + ball-to-video, wired end-to-end from the scorer's broadcast panel through to
the public match page. Slice 2 — real, backend-driven Discovery, Looking For, Community feed,
Following, Reputation/Ratings, Rankings, Moderation, toss insights, a printable tournament report,
and a broadcast-style score overlay on the live video — all reusing existing verified domain logic
(`stats.ts`, `records.ts`, `awards.ts`) rather than duplicating it.

**What already existed** (confirmed by reading the code, not assumed): ball-by-ball scoring engine,
full stats/leaderboard/records/achievements/awards system, batter-vs-bowler and recent-form
analytics, win probability, expected score, tournament pages with sponsors/branding, comments/
reactions/photo galleries, notifications, audit log, feature flags, mock-billing entitlement
architecture, R2 image storage via a Cloudflare Worker. None of this was rebuilt — every new slice
was checked against it first and built to extend, not duplicate.

**What changed**: see `CHANGELOG.md` for the itemized diff of both slices. Summary: 6 new Firestore
collections for media/broadcast (Slice 1), 8 more for discovery/social/reputation (Slice 2, plus 2
usage-tracking collections), ~30 new source files, `firestore.rules` extended for all of it with a
self-review pass in Slice 2 that found and fixed a real gap (see below), the Cloudflare Worker
extended to accept video uploads on a separate quota, `Player` gained two new optional fields
(`location`, `skillLevel`), `NotificationCategory` gained `community`.

**New architecture**: Media/Broadcast engine (WebRTC mesh + client-side recording, no media
server), Discovery engine (client-side filter/search over existing entity lists, no new index
infrastructure), Opportunity engine (Looking For posts/responses, one unified model not five),
Community engine (posts/polls/likes/reports), Identity/Reputation engine (ratings + rankings, both
derived from real data, no invented scores).

**New services**: `broadcast.service.ts`, `follow.service.ts`, `lookingFor.service.ts`,
`community.service.ts`, `moderation.service.ts`, `ratings.service.ts`, plus `uploadVideo()` added
to `storage.service.ts`.

**New data models**: `Broadcast`/`BroadcastViewerConn`/`MatchVideo`/`Clip` (Slice 1);
`LookingForPost`/`LookingForResponse`/`Follow`/`CommunityPost`/`PostLike`/`ContentReport`/
`Rating`/`ReputationSummary` (Slice 2) — all in `types/index.ts`, none touching `Delivery`/
`BallInput`/`scoring.ts`.

**Firestore changes**: collections listed above; `firestore.rules` additions follow this file's
existing owner/master/delegated-scorer patterns throughout, not a new trust model.

**Firestore rule changes, specifically**: every new collection gated (see the rules file's own
comments for the reasoning per collection); the community poll-vote rule was tightened mid-slice
from "touches only these fields" to "adds exactly one new, previously-absent voter" after review
showed the looser version let a signed-in user rewrite vote counts arbitrarily as long as they
stayed within the allowed key set; `communityPosts`/`lookingForPosts`/`contentReports` gained the
same text-length caps `comments` already had.

**R2/media changes**: Worker's `/upload` accepts `video/webm`/`video/mp4` under
`matches/{id}/videos/`, tracked in a separate `videoUsage`/`r2VideoObjects` quota pool (500MB/user,
20GB platform-wide) so video can't cannibalize the existing 100MB image allowance; 90MB per-file cap
(Workers' request-body ceiling on this plan).

**Streaming/recording/replay/ball-to-video changes**: see Slice 1 write-up above — unchanged by
Slice 2 except that the new `ScoreOverlay` now renders on top of the live video using the same
match doc, and clips/replays are listed alongside the new discovery/rankings surfaces via normal
navigation, not a separate data path.

**Discovery/Looking For/Community/Profile/Reputation/Ranking/Tournament/Analytics changes**: see
Slice 2 write-up above for the full list; the audit table has the per-section detail.

**AI changes**: none. No AI API is configured in this environment, and the brief's own §77
explicitly forbids calling a placeholder "AI." Every analytics feature built or extended this
session (toss insights, rankings, reputation) is plainly labeled as derived/statistical, never as
AI, matching how `winProbability.ts` was already documented before this session touched anything.

**Subscription changes**: none. `ROADMAP_V5_PLATFORM.md`'s mock-billing architecture was left
exactly as-is; the new social/discovery features are intentionally not premium-gated.

**Mobile/UI changes**: new pages reuse the existing responsive primitive components
(`Card`/`Button`/`PageHeader`/`Select`/`EmptyState`) and Tailwind conventions throughout; a
code-level scan for common overflow patterns (fixed pixel widths, `whitespace-nowrap`, non-wrapping
flex rows) found nothing new introduced. **Not verified in an actual browser at 320/375/390/430px**
— this environment has no way to launch one; this is a code-review-level check, not the live
device sweep §65 asks for.

**Security testing**: rules were hand-traced against every new service function's actual Firestore
calls (not just read for plausibility) — e.g. the poll-vote fix above came from checking
`community.service.ts`'s real read-then-write pattern against what the rule actually allowed, not
from inspection alone. **No emulator or live-project test was run** — Firebase CLI isn't available
in this environment (`firebase --version` fails: no executable resolves). This is the single most
important open item on the security side: the rules are reasoned-through and internally consistent
with the calling code, but have not been mechanically verified against Firestore's actual rules
engine.

**Permission testing (viewer/scorer/tournament-admin/master-admin/unauthenticated)**: reasoned
through per-collection in the rules file's own comments (each new `match` block states who can
read/write and why); not exercised with five real logged-in sessions, for the same reason as above
— no live Firebase project reachable from this environment.

**Offline regression testing**: `src/domain/scoring.ts`, `Delivery`, `BallInput`, and
`scoring.service.ts` were not modified by either slice; `tagVideoTimestamp()` in `ScoringPage.tsx`
(Slice 1) is a fire-and-forget best-effort call after `recordBall()` already resolved, never
awaited by the scoring flow itself, so a broadcast/network failure there cannot block or corrupt
scoring. Not exercised against an actual offline device.

**Live streaming / recording / replay / ball-to-video testing**: unchanged from Slice 1's report —
code-verified (`tsc`/`build`/`lint`), not runtime-verified. No two-browser WebRTC session has been
observed working end-to-end in this environment.

**AI testing**: N/A — no AI was built.

**Production testing / deployment status**: **not deployed.** No Firebase CLI, no Cloudflare
`wrangler` authenticated session, and no live project credentials exist in this environment.
`firestore.rules` and the `worker/` changes need `firebase deploy --only firestore:rules` and
`wrangler deploy` respectively before any of this takes effect anywhere outside local code.

**Git commit hashes**: see `git log` on `claude/crickethub-platform-build-us76os` — one commit per
slice (media/broadcast engine; discovery/community/reputation engines), both pushed.

**Push status**: pushed to `origin/claude/crickethub-platform-build-us76os` after each slice.

**Environment variables / provider requirements for what's blocked**: an AI provider key (for
§36–45), a media-streaming provider's API credentials (for a non-mesh, server-recorded stream,
§23–25), Apple Developer Program access (for §61–62), a payment processor's credentials (for real
billing, unchanged from `ROADMAP_V5_PLATFORM.md`), Firebase CLI auth + a live project (to actually
deploy and test anything in this report).

**External blockers, exactly as they stand**:
- Real AI (highlights ranking, commentary, coaching, tactical recommendations, opponent-analysis
  narration) — no model API configured.
- Managed/server-side streaming or recording beyond the WebRTC mesh — no media-provider account.
- Apple Watch / iOS Live Activities — native app development outside a web session's reach; not
  even the data contract has been drafted yet.
- Real billing — needs a provider decision from the project owner (unchanged blocker).
- Deployment and live/emulator testing of everything in this report — no Firebase CLI or
  authenticated Cloudflare session in this environment.

**Remaining bugs**: none known — both slices passed `tsc`/`build`/`lint` clean with no new
warnings, and every new Firestore rule was hand-traced against its calling code. The honest caveat
is that "no known bugs" here means no bugs found by static review and compilation, not by running
the app.

**Remaining incomplete features**: Stories (§9), venue discovery (§52), phase/pace-vs-spin analysis
requiring per-ball reads across many matches (§40–41, deprioritized on the platform's own
performance rules rather than built cheaply and wrong), match/achievement/announcement/quiz
community post *composer* UI (the data model and read/like/report paths already support them),
Live Share token enable/disable/revoke, a scrub-preview clip editor UI, an organizer dashboard that
unifies the several admin surfaces that already exist separately, and every AI/native-mobile/
real-billing item listed as blocked above.
