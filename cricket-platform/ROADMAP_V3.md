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
- ✅ New `/u/:username` public page (bio, photo, display name, `@username`, role badge,
  member-since). `getPublicProfile()` in `services/users.service.ts` resolves `usernameLookup/{u}`
  → `users/{uid}` (both already public-read in `firestore.rules`, so no rules change needed) and
  returns a narrowed `PublicProfile` type — no email/status/bannedAt. Returns `null` (rendered as a
  normal "User not found" state, not an error) for an unknown username or a non-`active` account,
  rather than exposing that a banned/pending account exists.
- **Deliberately does not show "followed teams/players" yet** — `favStore` is localStorage-only
  today (per-device), so there is no server-side data for anyone's follows but the current
  browser's own. Showing a real follows list on another person's public profile needs Slice 2.2 to
  actually decide whether follows move server-side for signed-in users; wiring a fake/placeholder
  section now would be worse than waiting. Revisit as part of 2.2 if that slice adds sync.
- `tsc`/`npm run build` clean. **Verified live end-to-end against the real database**: `/u/ayaan`
  renders the real master-admin profile (avatar initials, name, username, "Master Admin" badge,
  real join date) fetched through the actual `usernameLookup`→`users` chain, not a stub; `/u/`
  plus a nonexistent username correctly resolves to "User not found" after the fetch settles; no
  console errors on either path.

### Slice 2.2 — Extended following + activity feed coverage
- ✅ `favStore.ts`'s `FavKind` grows from `players | teams | tournaments` to also include `clubs`
  and `seasons`. `FollowButton` added to `ClubPage`/`SeasonPage`/`TournamentPage` (all three
  previously had none — `TournamentPage` was missing it despite tournaments already being
  followable before this slice). `ActivityFeed refId` scoping: `ClubPage.tsx` already had it;
  `SeasonPage.tsx` genuinely didn't — added, matching the same pattern.
- **Found and fixed a real, independent bug while wiring this up**: `AccountPage.tsx`'s
  "Following" card only ever rendered `favs.players` and `favs.teams` — `tournaments` was already
  a followable kind *before this slice* but was never shown there, so following a tournament
  produced no visible confirmation anywhere in the account UI. Extended the card to render all
  five kinds (added `listTournaments`/`listClubs`/`listSeasons` fetches alongside the existing
  player/team ones), not just the two new ones — leaving the pre-existing tournament gap in place
  would have been an obvious follow-up miss.
- **Cross-device sync deliberately stays out of scope for this slice**: `favStore` remains
  localStorage-only (per-device). Syncing follows server-side for signed-in users (so a public
  profile page could show what someone follows, per Slice 2.1's own deferred note) is a real
  design decision — new writes, new `firestore.rules`, a migration path for existing local
  follows — bigger than "add two more kinds to an enum." Flagged in `RESTRICTIONS.md` §4 as a
  scoped future slice rather than bundled in here speculatively.
- `tsc`/`npm run build` clean. **Verified live against the real database**: followed the real
  `seedT1` tournament via the actual `FollowButton` click handler (not a reimplementation) and
  confirmed `localStorage['crickethub.favs']` updated correctly with the new `clubs`/`seasons` keys
  already present as empty arrays. `ClubPage`/`SeasonPage`'s `FollowButton`/`ActivityFeed` additions
  verified by code review only — same as Slice 1.1, this dev database has no club/season reachable
  from a real link to click through, and `/account` needs auth this session doesn't have.

### Slice 2.3 — Team roster invitations
- ✅ New `TeamInvitation` type + `teamInvitations.service.ts`, deliberately a separate collection
  from the existing role-granting `Invitation` (not a widened `Invitation.role`) — this touches
  security-sensitive write paths (`players`/`teams` rules), so keeping it fully isolated avoids any
  risk to the already-verified role-grant flow. A team owner/manager invites an existing registered
  user by username (`TeamInviteModal.tsx`, wired into `TeamsPage.tsx` via a new mail-icon button per
  team card); the invitee accepts/declines at `/team-invite/:code` (`TeamInvitePage.tsx`, mirrors
  `InvitePage.tsx`'s layout exactly for consistency).
- **Accepting reuses or creates a linked `Player`, then updates both denormalized roster arrays**:
  `Player.teamIds` and `Team.playerIds` are two independently-maintained fields in this codebase
  (confirmed by reading `PlayerFormModal.tsx`/`TeamFormModal.tsx` — neither form updates the other
  entity's array; `dataIntegrity.ts`'s `orphaned_roster_entry` check exists precisely because they
  can drift). `acceptTeamInvitation()` writes to both: reuses the invitee's existing linked player
  (matched by `linkedUserId`) if they have one, appending the new team to its `teamIds`; otherwise
  creates a fresh `Player` doc (`linkedUserId` set, `ownerId` = the team's actual owner, not the
  invitee) and adds its id to the team's `playerIds`.
- **The real design problem this slice had to solve**: a VIEWER accepting their own invite has
  neither `canManage()` nor team ownership, so normal `firestore.rules` would block every write the
  accept flow needs (creating/updating a `Player`, updating a `Team`). Solved with the exact same
  grant-doc pattern the concurrent session had just added for role invitations
  (`invitationRoleGrants`) — a `teamInvitationGrants/{invitedUid}` doc records `{teamId, expiresAt}`
  and is the *only* thing that authorizes the invitee's own narrow exception, closely modeled on
  that precedent for consistency:
  - `players` create: invitee may create a player only with `linkedUserId == self`, only for the
    exact team named in their still-valid grant, and — closing a hole the naive version of this
    would have had — only with `ownerId` equal to *the real team's actual owner* (via a nested
    `get()`), not an arbitrary value the invitee could pick to "own" their own player doc forever.
  - `players` update: invitee may only touch `teamIds` (`affectedKeys().hasOnly(['teamIds',
    'updatedAt'])`), only by adding exactly one id, and only the granted team's id.
  - `teams` update: invitee may only touch `playerIds`, only by adding exactly one id.
  - Every one of these closes as soon as `acceptTeamInvitation`/`declineTeamInvitation`/
    `cancelTeamInvitation` deletes the grant doc.
- `tsc`/`npm run build` clean. **Not click-tested live, and flagged as needing a real check before
  relying on in production**: exercising this end-to-end needs two authenticated roles at once (a
  team owner/manager to send the invite, a separate signed-in invitee to accept it) — this
  session's browser has no credentials for either (same master-admin-auth-loss caveat as many
  recent phases). The `firestore.rules` additions were manually re-read line by line for brace/
  logic consistency, but **no Firebase CLI is installed in this environment** (`npx firebase
  --version` fails — confirmed, not assumed) so they could not be validated by the rules linter or
  emulator either. Given this is the most security-sensitive change in this slice pass, **recommend
  a real `firebase emulators:start` or a staging deploy dry-run before this reaches production**,
  the same "author against local dev, verify against a real deploy" caveat already applied to the
  CSP recommendation in `ROADMAP.md` Phase 30.

### Slice 2.4 — Match comments
- ✅ New `MatchComment` type + `comments.service.ts` (`listComments`/`postComment`/
  `deleteComment`), a new `comments` collection scoped by `matchId`. Public read; signed-in create
  (500-char cap enforced both client-side and in `firestore.rules`); delete by the comment's own
  author or the master admin (moderation) — no edit, a removed-and-reposted comment is simpler to
  reason about than an editable one. New `CommentSection.tsx`, wired into the public `MatchPage.tsx`
  right after the photo gallery: a textarea + character counter for signed-in visitors, a "Sign in
  to leave a comment" prompt otherwise, and a flat (not threaded) list with a delete button shown
  only to the comment's author or an admin.
- `tsc`/`npm run build` clean. **Verified live against the real database** for the signed-out read
  path (the only path testable without credentials): loaded a real completed match page, confirmed
  the "Comments" section renders "Sign in to leave a comment." and "No comments yet — be the
  first.", no console errors. The signed-in post/delete path verified by code review + `tsc` only —
  same master-admin-auth-loss caveat as recent phases.

### Slice 2.5 — Match reactions
- ✅ Four fixed reaction emojis (🔥 👏 😮 💔) as a new `matches/{id}/reactions/{uid}` subcollection
  (one doc per reacting user, matching the existing `deliveries`/`ballMeta` subcollection
  convention rather than a top-level composite-id collection) — toggling is a single read + write
  per tap, and aggregate counts are computed client-side from the full per-match list rather than
  maintained as separate counters, since per-match reaction volume is low. New
  `MatchReactions.tsx`, wired onto `MatchPage.tsx` just above the export toolbar; disabled with a
  "Sign in to react" tooltip for signed-out visitors.
- **Hit the same concurrent-edit race as `App.tsx`'s entry #24, this time on `MatchPage.tsx`**: the
  first attempt to wire in the import + `<MatchReactions>` usage was silently overwritten — caught
  only because a routine post-edit grep (now standing practice for hot shared files) came up empty
  right after a clean `tsc` run. Re-applied against the then-current file, re-verified via grep
  immediately, and confirmed the earlier `ShareButton`/`CommentSection`/`MatchGallery` wiring from
  prior slices survived the same overwrite untouched. `tsc`/`npm run build` clean after the fix.
- `firestore.rules`: doc id must equal the writer's own uid and `userId` must match — much simpler
  than Slice 2.3's grant-doc design since there's no cross-user privilege to gate, just "you can
  only write your own reaction doc."
- **Verified live against the real database**: loaded a real completed match page, confirmed all
  four reaction buttons render and are correctly disabled for a signed-out visitor, no console
  errors. The signed-in tap/toggle path verified by code review + `tsc` only — same
  master-admin-auth-loss caveat as recent phases.

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
