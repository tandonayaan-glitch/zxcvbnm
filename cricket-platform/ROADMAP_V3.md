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
- ✅ New `components/ui/ShareButton.tsx`: tries `navigator.share()` first (mobile share sheet),
  falls back to `navigator.clipboard.writeText()` + a success toast, and — this is the real
  finding from verification, not a hypothetical — **the clipboard write itself can reject** (focus
  loss, permissions, insecure context), which the first version didn't handle, so a failed copy
  would fail completely silently with no feedback at all. Fixed with a second fallback level: an
  error toast telling the visitor to copy the URL from the address bar instead. Two variants
  (`button` with label, `icon`-only for tight headers) sharing one `cn()`-styled base to match
  `FollowButton`'s existing look. Added to all six public entity pages: Match (top-right of the
  dark header bar), Tournament (next to the admin action buttons, always visible unlike those),
  Team, Player, Club, Season.
- `tsc`/`npm run build` clean. **Verified live**: confirmed `aria-label="Share"` renders exactly
  once on Match/Tournament/Player/Team pages (Club/Season use the identical one-line pattern,
  verified by code review — this dev database has no club/season to click-test against). Exercised
  the real failure path live rather than just the happy path: this browser automation session's
  `navigator.clipboard.writeText()` genuinely rejects with `NotAllowedError: Document is not
  focused`, which is exactly the real-world condition the fix above targets — confirmed the error
  toast fires correctly instead of the original silent failure.

### Slice 1.2 — Mobile spectator polish
- ✅ Real 375px-viewport audit (not a speculative rewrite) of the highest-traffic surfaces: a
  completed match page (scorecard tables, match insights, boundary/wicket timeline), a live match
  page (`LivePanel`, wagon wheel, bowling line/length grid), and the tournament page's 11-tab bar.
  Checked programmatically (page `scrollWidth` vs `innerWidth`, per-element bounding rects) rather
  than eyeballing screenshots, since this session's `computer`/screenshot tooling was intermittently
  timing out — confirmed via `get_page_text`/`javascript_tool` (which worked fine throughout) that
  this was a tooling issue, not an app one.
- **Result: the responsive foundation was already solid.** Zero page-level horizontal overflow on
  any of the three surfaces; scorecard tables fit their container exactly; the tournament tab bar's
  `overflow-x-auto` (`components/ui/Tabs.tsx`) already scrolls its own 869px of tabs within a 343px
  viewport correctly rather than breaking the page. This matches the pre-slice reality check above
  — most of Phase 1 was already built, and this confirms the "already-extensive responsive classes"
  finding by testing it, not just reading the code.
- **One genuine gap found and fixed**: the public footer's four links (`Scorer login`/`Search`/
  `Privacy`/`Terms`, present via `PublicLayout.tsx` on every single public page) were plain
  unpadded text — a 20px-tall tap target, well under accessible touch-target size. Added
  padding + a hover background (`rounded-md px-2 py-2.5`, tightened `gap-4`→`gap-2 sm:gap-4` on
  mobile so four wider targets still fit one row) — measured 40px tall post-fix, confirmed no new
  overflow introduced.
- `tsc`/`npm run build` clean. Verified live via direct DOM measurement (footer link heights
  20px→40px) rather than a visual screenshot, for the same tooling-timeout reason as above.

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
