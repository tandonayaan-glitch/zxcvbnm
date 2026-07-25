# CricketHub — Roadmap V3 (League Ecosystem)

`ROADMAP.md` (37 phases) and `ROADMAP_V2.md` (7 phases) are both complete. This third roadmap is
the next **major product milestone**, not another cleanup pass: turning CricketHub from "a platform
a club/tournament runs on" into a **league ecosystem** — spectators can follow, share, discuss, and
discover; tournaments get a real public storefront (sponsors, galleries, announcements, downloads).

Scope is fixed by the user's own brief (5 phases, listed below) — this file does **not** re-audit
for generic polish; it maps each requested item to what already exists vs. what's genuinely new,
then slices the new work.

Legend: ✅ done · 🟡 partial / in progress · ⬜ planned · 🚫 decided against (see reasoning inline)

Same standing rules as `ROADMAP.md`/`ROADMAP_V2.md`: `src/domain/scoring.ts`, `Delivery`/`BallInput`,
and offline infrastructure are never touched. See `RESTRICTIONS.md` for the full constraint list.
Everything here is additive — new collections, new components, new routes — nothing in this
milestone requires changing how a delivery is scored or how an innings is rebuilt.

---

## Pre-slice reality check (what Phase 1's asks already are)

A targeted pass (not a generic audit — checking specifically against the items the user listed)
found most of **Phase 1 — Live Spectator Experience already built** in prior roadmaps:

- Live spectator mode, public match/tournament/team/player pages — all exist and are already rich
  (`src/features/public/*.tsx`), no auth required, clean permanent URLs (`/match/:id`, `/team/:id`,
  `/tournament/:id`, `/player/:id`, plus `/club/:id`, `/season/:id`).
- Mobile responsiveness — already extensively applied (`sm:`/`md:`/`lg:` classes throughout the
  public pages), not a from-scratch job.

The two genuine gaps: **no share affordance anywhere** (URLs are shareable but nothing offers to
copy/share one), and mobile hasn't had a dedicated **spectator-specific** pass (as opposed to
general responsive classes already in place). Phase 1 below is scoped to just those two slices —
padding it with "confirm already done" busywork would misrepresent the state of the app.

Phases 2-4 are genuinely mostly net-new (comments, reactions, team-roster invites, public user
profiles, QR codes, embeds, sponsors, galleries, announcements, downloads, calendar) — confirmed by
grepping for each concept finding zero or near-zero hits. Full per-item findings are in the slice
write-ups below as they're completed, not duplicated here.

---

## Phase 1 — Live Spectator Experience

### Slice 1.1 — Shareable links
- ⬜ New `ShareButton` component: copies the current page's canonical URL to clipboard, uses
  `navigator.share()` on devices that support it (mobile), falls back to copy-to-clipboard + toast
  everywhere else. Added to Match/Tournament/Team/Player/Club/Season public pages.

### Slice 1.2 — Mobile spectator polish
- ⬜ Targeted pass at real mobile viewport widths on the highest-traffic spectator surfaces
  (live match page, scorecard tables, tournament tabs) — fix whatever's actually found, not a
  speculative rewrite.

## Phase 2 — Community

### Slice 2.1 — Public user profiles
- ⬜ New `/u/:username` public page (bio, photo, display name, role badge, member-since, follows
  summary). `getPublicProfile()` returns a narrowed, safe subset (no email/status/audit fields).

### Slice 2.2 — Extended following + activity feed coverage
- ⬜ `favStore`'s `FavKind` grows to include clubs and seasons (currently players/teams/tournaments
  only); `FollowButton` added wherever a followable entity's public page doesn't have one yet.
  `ActivityFeed refId` scoping extended to any entity page still missing it.

### Slice 2.3 — Team roster invitations
- ⬜ New, separate-from-the-existing-role-`Invitation` mechanism: a team manager/owner invites
  someone (by link/code) to join the team's roster as a player. Deliberately a new collection
  rather than widening `Invitation.role`, to avoid any risk to the already-verified role-grant flow.

### Slice 2.4 — Match comments
- ⬜ New `comments` collection scoped to a match id. Public read, signed-in create, author or
  master-admin delete. Flat (not threaded) — matches the platform's amateur/semi-pro scope.

### Slice 2.5 — Match reactions
- ⬜ Lightweight per-match emoji tap reactions, one-per-user-per-emoji (a `matchReactions/{id}_{uid}`
  doc prevents spam), aggregate counts read from a small summary doc.

## Phase 3 — Sharing

### Slice 3.1 — QR codes
- ⬜ QR codes for match/team/tournament/player pages, generated client-side, surfaced from the new
  `ShareButton`.

### Slice 3.2 — Embeddable widgets
- ⬜ Chrome-free `/embed/match/:id` (compact live score card) and `/embed/scorecard/:id` (read-only
  full scorecard) routes with no app shell, meant to be iframed elsewhere; embed-code snippet
  offered from `ShareButton`.

## Phase 4 — Tournament Ecosystem

### Slice 4.1 — Sponsor showcase
- ⬜ `Tournament.sponsors[]` (name/logo/link/tier), admin editor, public display section.

### Slice 4.2 — Tournament photo galleries
- ⬜ Generalizes the existing match-only gallery pattern (`components/media/MatchGallery.tsx`) into
  a reusable gallery wired onto `TournamentPage.tsx` too; fixes the tracked-folder gap in
  `MediaLibraryPage.tsx` (tournaments folder isn't listed there today).

### Slice 4.3 — Announcements
- ⬜ Tournament-scoped announcement posts, admin create/pin, shown on the tournament page,
  optionally notifying followers via the existing notification service.

### Slice 4.4 — Downloads
- ⬜ Document attachments (PDF rulebook/fixture sheet) on a tournament — extends the Storage
  service beyond images (new upload path + rule), listed with download links on the tournament page.

### Slice 4.5 — Calendar + better fixture/standings sharing
- ⬜ Per-match "Add to calendar" (.ics) download; a calendar/month view for tournament fixtures;
  a standalone standings/fixtures share path independent of the full tournament export.

## Phase 5 — Final Polish

- ⬜ UI consistency pass over everything shipped in Phases 1-4.
- ⬜ Performance check (bundle-size delta from new dependencies).
- ⬜ Accessibility pass on all new interactive components.
- ⬜ SEO for public pages — per-route `document.title`/meta description (no SSR in this client-only
  Vite SPA, so this is real but bounded: crawlers that execute JS will see it, a static crawler
  won't — documented honestly rather than oversold), plus static `robots.txt`/`sitemap.xml`.
- ⬜ Documentation updates (`README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`).
- ⬜ Fix any genuine bugs found along the way (not a speculative bug hunt).

---

### Notes
- Every slice ends with `tsc` + `npm run build` green and a manual smoke test where auth access
  allows it, exactly like `ROADMAP_V2.md`.
- New Firestore collections (`comments`, `matchReactions`, `teamInvitations`, `announcements`) each
  get their own `firestore.rules` block, written alongside the slice that introduces them, following
  the existing owner/role-scoped pattern rather than inventing a new access-control shape.
- This is a large milestone; slices are intentionally small and shippable one at a time rather than
  landed as one giant change.
