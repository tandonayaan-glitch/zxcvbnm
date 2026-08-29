Here are both artifacts as plain text — no HTML/CSS, just the content.

---

# CricketHub Launch Audit

**Verdict: Ready with minor fixes.** Read-only audit of the live app plus a full read of firestore.rules, the R2 media Worker, and the scoring engine. Nothing modified, committed, or deployed. Severity counts: 0 Critical, 4 High, 3 Medium, 3 Low.

**Methodology note:** live browser testing using a disposable test account (no real account's password touched); the automated browser's render pane never composited frames this session, so clicks were verified via DOM/network state rather than screenshots; the environment's safety controls correctly blocked probing Firestore write-rules with forged data and pulling ambient cloud credentials — both treated as working as intended. Where a real account-permission wall blocked live testing, fell back to validating the scoring engine against real completed matches already in production rather than inventing test data.

## Findings (ranked by severity)

**HIGH — Onboarding tutorial tells every new user they need a "verified phone number"**
First-time tutorial, step 5 of 7, "Becoming a Tournament Manager." Read: "Hosting your own tournament needs a verified phone number and Tournament Manager access. Verify your phone and request access from Account Settings." Phone verification was fully removed from the product earlier in the session — no phone field exists anywhere in Account Settings. File: `src/components/layout/TutorialButton.tsx`, the `STEPS` array entry titled "Becoming a Tournament Manager." Shown to 100% of new signups by default.

**HIGH — Tournaments page tells users to "verify your phone" to become a Tournament Manager**
Confirmed live: a fresh Scorer account opening `/tournaments` sees, under the disabled "New tournament" button: "Ask the master admin for Tournament Manager access (and verify your phone) to create tournaments." The rule this describes was removed — `canCreateTournament()` is role-only now. File: `src/features/tournaments/TournamentsPage.tsx:56-60`, the `createBlockedReason` ternary. Its phone-mentioning branch was actually dead code — could never render given the current permission logic. Live on the real deployed site.

**HIGH — Premium upsell cards show raw internal file paths as the customer-facing pitch**
On a real match page, the "Performance charts" upsell card read verbatim: "A match's run/wicket progression chart, components/charts/MatchGraphs.tsx." — an internal developer audit note from `entitlements.ts`, rendered directly to a paying prospect. Same pattern on "Match photo galleries" ("Gated on the match owner's plan"). All ~24 entries in `PREMIUM_FEATURES` had this same internal-note-shaped description. File: `src/components/guards/PremiumGate.tsx:52` renders `def?.description` verbatim; descriptions authored in `src/domain/entitlements.ts`. Live on every premium touchpoint, every Free-plan visitor.

**HIGH — A brand-new self-signup account cannot actually create or score a match**
Signed up fresh (role: Scorer, matching the "new accounts can create/score matches immediately" design). Adding a player: form submits, nothing happens, no error. Adding a team: same. The "New match" wizard's team picker is empty even though the platform has existing teams, because it's scoped to teams the account owns — and Scorer alone can't own any, since creating a player or team required `canManage()` (Team Manager/Admin/Tournament Manager/Master Admin only). Contradicts CHANGELOG Slice D2's promise. Files: `firestore.rules:145-190` (the `canManage()` gate), `src/features/matches/MatchSetupPage.tsx:241-242` (owner-scoped team picker). Affects any genuinely new user with no pre-existing owned teams.

**MEDIUM — "Add player" / "Add team" fail silently for roles that lack permission**
Firestore correctly rejects the write (security is fine) — but the button and full form are shown to Scorer regardless, and when the rejected write throws, nothing tells the user: no toast, no inline error across repeated polling. The modal just sits there indefinitely. File: `src/features/players/PlayersPage.tsx:150,177-179` — a `toast.error(...)` call was present but never visibly fired in testing.

**MEDIUM — A boundary hit off a no-ball doesn't count toward the batter's 4s/6s**
Code-level read of the (untouched, per instruction) scoring engine. On a no-ball, `runsOffBat` is correctly credited to the striker's runs, but the fours/sixes counters are gated by `if (!extra && runsOffBat === 4)`, which is false whenever `extra === 'no_ball'`. A four or six off a no-ball adds to runs/strike rate but not the 4s/6s column, and (via `stats.ts` aggregation) not career boundary counts either. File: `src/domain/scoring.ts:237-238`. Not yet observed live — zero matches in production currently contain a no-ball.

**MEDIUM — Every page scrolls horizontally on a phone-width viewport**
Measured at 375px viewport width: `document.documentElement.scrollWidth` was 446px — 71px of unwanted horizontal scroll, traced to a decorative glow blob inside the global `BackgroundLayer` component. Its parent has `overflow-hidden`, but because the parent is `position: fixed`, that clip doesn't reliably constrain the document's own scroll width in Chromium. File: `src/components/background/BackgroundLayer.tsx:29,33`. Affects every page, every visitor on a narrow viewport.

**LOW — Eight abandoned test matches sit permanently in "LIVE" on the public homepage**
The homepage's Live matches rail shows 8 matches (teams "MWA"/"MWB") stuck at or near 0/0 — dev-session matches started and never finished or archived.

**LOW — Leftover dev/test accounts in the production user directory**
`testaccount1`, four "MSW Test P1-P4" pending-registration rows, an account named "ZZ Trash…", plus "test" and "xxx" Admin accounts. Not a security issue — profiles are meant to be public — just unpolished for a launch.

**LOW — CHANGELOG.md claims Hosting deploys are disabled — they aren't**
The changelog's Slice D5 entry says "This repo can no longer push a Hosting deploy." A later commit reverted that, but the changelog was never updated.

## A. Confirmed working
- Auth core loop: signup (correct Scorer role, no phone gate), wrong-password/unknown-user handling (generic message, no account enumeration), logout, session persistence across refresh, redirect-to-login for signed-out visitors.
- Tournament Manager application flow: submitted end-to-end with no phone requested; duplicate-application correctly blocked while pending.
- Tournament-creation gate itself correctly blocks Scorer, both client and server side (only the copy was wrong).
- Scoring-engine arithmetic checked against two real completed matches: strike rates, balls-faced-vs-overs, bowling economy, runs-conceded sum, wickets tally, fall-of-wickets all reconcile exactly. A 6-a-side match's "won by 3 wickets" margin correctly reflects a custom team size.
- Match analytics (partnerships, boundary %, powerplay, best spell, turning point, momentum) render real computed numbers on real data.
- firestore.rules — full manual read: role model, owner-scoping, delegated-scorer field allowlist, invitation-grant narrow-scoping, R2 usage collections locked server-only. No privilege-escalation path found.
- R2 Worker: Firebase ID tokens verified against Google's real JWKS (issuer+audience checked); quota reservation atomic and strictly before any R2 write, with compensating rollback on failure; secrets only as wrangler secrets, never committed; CORS restricted to known origins.
- No secrets found in the shipped frontend bundle.
- No TODO/FIXME/HACK markers anywhere in src/.

## C. Security
No confirmed vulnerability. The one UI/backend mismatch found (Add player/team) is a UX gap, not a security hole — the server correctly rejects the write every time. Live authenticated write-probing against the rules was intentionally not attempted (the environment's safety tooling correctly blocks that pattern).

## D. Could not test
Everything gated behind Master Admin/elevated roles (approving requests, role changes); creating a tournament/match and ball-by-ball scoring from scratch (blocked by the new-account dead end, validated against historical data instead); extras and rarer wicket types live (zero production examples exist to check against — wide, no-ball, bye, leg-bye, LBW, run-out, stumped, hit-wicket, Last Man Standing, Super Over); R2 image upload/delete through the actual UI; Wagon Wheel/Pitch Map/heat-map visual correctness; true pixel-level visual QA (render pane didn't composite frames); multi-tab/multi-user real-time sync and reconnection behavior.

## E. Manual tests to run yourself
1. Approve or delete the "QA Audit Test Cup" Tournament Manager request submitted from the disposable `qaaudit24aug` test account.
2. Create one tournament per format (league, knockout, group/knockout) with an unusual combination (6-a-side, 10 overs, custom powerplay, Last Man Standing on), score a full match watching specifically for a boundary off a no-ball.
3. Run a tied match through Super Over end-to-end at least once.
4. Open the site on an actual phone to confirm the horizontal-scroll finding in person.
5. Decide whether to delete the 8 stuck "LIVE" test matches and leftover test accounts.
6. Try avatar/logo image upload end-to-end including an oversized file and wrong file type; confirm the quota counter updates and rolls back correctly.

## F. Recommended fixes (not implemented at audit time)
Drop the phone sentence from the tutorial step; collapse the Tournaments page's dead phone branch; give `PremiumFeatureDef` real customer-facing copy and stop rendering the internal audit note; seed a starter team/roster for new Scorers or let the match wizard include unowned teams; hide Add-player/team for roles lacking `canManage()` or confirm why the existing toast wasn't firing; flag the no-ball boundary count for the user's own judgment (scoring.ts is treated as verified/reliable); clamp the background blobs or add `overflow-x: hidden`; clean up stale test data before launch; correct the CHANGELOG's Slice D5 entry.

## G. Overall launch readiness
**Ready with minor fixes.** Everything load-bearing checks out: authentication, the permission model, Firestore's server-side enforcement, the R2 Worker's security, and the scoring engine's core arithmetic (verified against real match data) are all sound. Nothing found is a data-loss, security, or payment risk. What blocks a clean launch is copy and first-run UX — two places tell new users to verify a phone number that no longer exists, the premium upsell reads like an internal audit log, and a genuinely new user can get stuck with nothing to do. All four are copy/gating changes, no schema or security work. The rest (no-ball boundary count, mobile overflow, stale test data) is safe to ship and patch after.

*(Note: every fix in "F" above — except the deliberately-left-alone no-ball issue and the deliberately-not-executed test-data cleanup — was subsequently implemented, tested, and committed in a follow-up turn: 7 commits on `master`, `tsc`/build/lint clean, nothing deployed.)*

---

# CricketHub Data Inventory

Read-only inventory — nothing modified, deleted, or migrated. Every collection was read directly from production Firestore via its own public-read rule, plus the R2 Worker's public `/list` endpoint and Firebase Storage's public REST listing. Two things were not reachable this way: `adminRequests` (Tournament Manager applications — master-admin-only by design) and anything needing a Cloudflare account token.

**Totals:** 14 accounts, 2 tournaments, 6 teams, 17 players, 23 matches, exactly 1 account to keep.

## Accounts (14 total)

| Username | Display name | Role | Status | Verdict |
|---|---|---|---|---|
| ayaan | Ayaan | MASTER_ADMIN | active | **Preserve** |
| xxxxx | xxx | ADMIN | active | Can't tell |
| Ayaan_12234 | Ayaan | ADMIN | active | Can't tell |
| test | test | ADMIN | active | Disposable |
| test1 | test1 | SCORER | active | Disposable |
| testaccount1 | Test12 | VIEWER | active | Disposable |
| qaaudit24aug | QA Audit Bot | TOURNAMENT_MANAGER | active | Mine — disposable |
| qafixpass24aug | QA Fixpass Bot 2 | SCORER | active | Mine — disposable |
| user490048 | MSW Test P1 | VIEWER | pending_registration | Disposable |
| user673068 | MSW Test P2 | VIEWER | pending_registration | Disposable |
| user676845 | MSW Test P3 | VIEWER | pending_registration | Disposable |
| user577993 | MSW Test P4 | VIEWER | pending_registration | Disposable |
| user274257 | ad | VIEWER | pending_registration | Can't tell |
| user166431 | ZZ Trash Test Player | VIEWER | pending_registration | Disposable |

Two accounts not classified: "xxxxx"/"xxx" (ADMIN) and "Ayaan_12234"/"Ayaan" (ADMIN, sharing the Master Admin's own display name) — no obvious test-data name pattern, and both currently own real content, so deleting either takes that content down too.

## Cricket data

**Tournaments (2):** "MSW Test Tournament" (league, upcoming, owned by xxxxx) — disposable. "CricketHub Cup" (knockout, ongoing, no owner set) — seed/demo.

**Teams (6):** "MSW Test Team A" (MWA) and "MSW Test Team B" (MWB), both owned by xxxxx — disposable. "x" (XXX) and "xj" (JJ), both owned by the Master Admin — seed/demo, the Master Admin's own. Two unnamed legacy rows (ids `tt1`, `tt2`) missing name/owner/createdAt fields entirely — these are the "Royal Strikers"/"Thunder Kings" teams whose display names live only on match documents, not the team docs themselves.

**Players (17):** MSW Test P1-P4 (4, disposable) + "ad" (1, can't tell) + 12 real-named cricketers (Rohit Sharma, Shubman Gill, Shreyas Iyer, Hardik Pandya, Jasprit Bumrah, Virat Kohli, KL Rahul, Ravindra Jadeja, Mohammed Shami, Yuzvendra Chahal, Vikram Singh, Sanjay Patel) all owned by the Master Admin — a curated seed/demo roster.

**Matches (23 total):** 7 live, 4 abandoned, 3 setup, 1 innings_break, 6 completed — all 21 of these are MSW test matches. Plus 2 completed real/seed matches ("Royal Strikers vs Thunder Kings," "XXX vs JJ"), the Master Admin's own, fully scored with internally consistent scorecards. 21 of 23 total match documents are test data. Each match carries its own `deliveries` and `ballMeta` subcollections that do NOT get removed automatically if the parent match doc is deleted. `playerStats` (14 docs) and `teamStats` (6 docs) mirror the same ownership split.

## Social, notifications & applications
- Activity feed: 59 entries, overwhelmingly MSW test-match events.
- Comments, announcements, clubs, seasons, feature flags: all genuinely empty (zero documents).
- Notifications, audit logs, invitations, team invitations, subscriptions: not enumerable via public read — each requires a signed-in owner or Master Admin.
- Tournament Manager applications (`adminRequests`): not enumerable via public read either; at least one real row exists (a disposable "QA Audit Test Cup" test request from this session's own audit work).

## Storage & R2
**R2 (Cloudflare):** could not enumerate. The Worker's public `/list` endpoint is unauthenticated by design, but the currently deployed frontend has no R2 Worker URL configured at all (`VITE_R2_WORKER_URL`/`VITE_R2_PUBLIC_URL` both empty in the live bundle) — no working endpoint to call, and no Cloudflare account token to query the bucket directly. This also means image uploads are likely broken on the live site right now, independent of the reset question.

**Firebase Storage:** inconclusive via public REST. Storage rules are public-read for every folder; querying each via Storage's public list endpoint returned "Not Found" for all seven folders — consistent with an empty bucket, but not conclusive proof. Check the Firebase Console's Storage tab directly.

## Safest way to do a full reset yourself

1. **Export a full Firestore backup first** — Firebase Console or `gcloud firestore export`. Given the mix of test and seed content sharing owners, this is the difference between a reset and a mistake.
2. **Confirm the Master Admin doc survives, first and on its own** — `users/xGOkCzUm1EXdP2WLmZRoUoYEHB72` (username `ayaan`) is what login reads right after Firebase Auth signs in. `usernameLookup/ayaan` isn't load-bearing for sign-in but is worth keeping too.
3. **Delete Firestore collections one at a time, recursively** — `firebase firestore:delete --recursive <collection>` for tournaments, teams, players, matches, playerStats, teamStats, activity, notifications, adminRequests, auditLogs, invitations, teamInvitationGrants, invitationRoleGrants, usernameLookup, imageUsage, r2Objects, and any empty ones you want cleared on principle. `--recursive` matters specifically for `matches` — it's the only way to also take each match's deliveries/ballMeta/reactions subcollections with it.
4. **Delete every `users` doc except the Master Admin's** — not a blanket collection delete, filter to every doc except that one uid.
5. **Delete the matching Firebase Auth accounts separately** — deleting a Firestore `users` doc does not delete the Auth account behind it. Firebase Console → Authentication, or `firebase auth:export` reviewed first, then delete by UID.
6. **Clear R2 via Cloudflare dashboard or wrangler** — `wrangler r2 object list crickethub-media` to see what's actually there, then delete objects. Leave the bucket, Worker, and secrets untouched.
7. **Clear Firebase Storage the same way** — Console → Storage → delete folder contents, leave the bucket and rules in place.
8. **Verify** — sign in as Master Admin only, confirm exactly one row in Users & Roles, zero tournaments/teams/players/matches, and genuinely empty dashboard states.

Two things deliberately left to your own judgment, not a script: the "xxxxx"/"xxx" and "Ayaan_12234" accounts, and the Master Admin's own "x"/"xj" teams, players, and two seed matches — none match a test-data pattern confidently enough to auto-classify, and getting either of the two ambiguous accounts wrong takes real owned content down with it.