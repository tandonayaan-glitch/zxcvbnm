# CricketHub — Open problems & things NOT verified

Handoff list as of **2026-09-02** (overnight deploy + readiness pass, then a follow-up
pass: rules deploy + shot-placement animation fix). Newest findings first. This file is
deliberately the "what's still wrong / unproven" list; the "what got fixed" log lives in
`things done.md`.

---

## 1. Authenticated runtime testing — DONE on the follow-up pass (partial matrix)

The owner signed back in on the deployed origin, so the follow-up pass **did** runtime-test
signed-in surfaces on `https://cricket-platform-b03bc.web.app` against the current build
(`index-J_rrFN5c.js`) with the new Firestore rules live:

- **Master writes work post-rules-deploy** — scored a live ball on match
  `i1ENZ1dTpW3gwpGIayNX` (ALP 7/0 → 11/0), then Undo restored it to ALP 7/0 (0.2). No
  `permission-denied`, batch write (Delivery + denormalised innings) succeeded.
- **Public reads work post-rules-deploy** — `/`, `/browse` (matches/teams), `/stats` all
  return content, no permission errors, 0 console errors.
- **16 authenticated routes** swept (`/dashboard`, `/settings`, `/admin/tools`, `/matches`,
  `/players`, `/teams`, `/tournaments`, `/clubs`, `/admin/trash`, `/requests`, `/users`,
  `/admin/merge-players`, `/admin/feature-flags`, `/admin/invitations`, `/admin/media`,
  `/admin/settings`) — every one renders its heading, no "page not found", no
  `permission-denied`, no raw `FirebaseError` text, **0 non-cosmetic console errors**.
- **320px signed-in header** — no horizontal scroll, header fits exactly, no overflow.
- **Dark mode toggle** — `html.dark` applied, body bg → dark slate, reverts cleanly.
- Shot-detail panel opens on scoring a boundary; wagon wheel + pitch map both mount and
  accept a drag (committed zone changed Mid-wicket → Long-off on drag).

**Still NOT re-run this pass** (verified in the Session-5 localhost matrix, not re-checked
on prod): New Batter filtering inside a running match, auto-powerplay phase transitions,
player archive/restore/trash round-trip, tutorial "don't show again" opt-out end-to-end,
2nd-innings / innings-break transitions, refresh-persistence of a signed-in scoring session.
Normal-admin owner-scoping could not be checked (needs a second, non-master account, which
policy forbids me creating) — the server-side boundary is `firestore.rules`
`isOwnerOrMaster`, which is now deployed.

## 2. BLOCKED (config) — image uploads are dead on the live site

`VITE_R2_WORKER_URL` / `VITE_R2_PUBLIC_URL` are **unset** both locally (`.env.local`) and in
the deployed bundle. `uploadImage()` short-circuits before any network call with a friendly
toast *"Image uploads are not configured yet."* — so avatars, team/club logos, tournament
banners and match photos **cannot be uploaded on production right now**. URL-paste image
fields still work. The Media Library page itself loads fine and shows 0 images.

**To close this:** deploy the `crickethub-media-worker` (see `worker/README.md`), then set
both env vars and redeploy hosting. Until then the Media Library is display-only. Nothing
in the app code can fix this — it is purely a deploy/config step for the owner.

## 3. Firestore rules / indexes — DEPLOYED. Storage rules — could not deploy.

`firebase deploy --only hosting,firestore:rules,firestore:indexes` ran successfully on the
follow-up pass:

- **`firestore.rules`** compiled and released to `cloud.firestore` — the live database is
  no longer relying on open/test mode. Public read of cricket data + role-gated writes are
  now enforced server-side. Verified afterwards that public reads and master writes both
  still work (see §1).
- **`firestore.indexes.json`** deployed — it is empty (`{"indexes": [], "fieldOverrides":
  []}`), so this was a no-op, but it is now in sync.
- **`storage.rules` was NOT deployed** — `firebase deploy` refuses with *"Firebase Storage
  has not been set up on project 'cricket-platform-b03bc'"*. Storage was never provisioned
  on this project; images moved to Cloudflare R2 in commit `01c749a`. `storage.rules` is
  therefore dead config. **Not a gap** — there is no Storage bucket to secure. If Storage is
  ever turned on, deploy `storage.rules` at that point.

## 4. Stale production data (not code — needs owner action)

- **Several abandoned "LIVE" test matches** still show on the public homepage's live rail
  (`Aieieie` / "Audit" / "MSW" / "mm" teams stuck at low scores). They now fill the
  freshly-improved live cards. Wipe with the `scripts/wipe-*.mjs` helpers or archive them.
- Match `i1ENZ1dTpW3gwpGIayNX` ("Aieieie", Audit Alpha vs Audit Bravo) is the disposable
  fixture used for the scoring runtime checks — left LIVE at ALP 7/0 (0.2). Safe to wipe.
- **Possible orphan `ballMeta` doc(s)** in that match — tagging a shot on a delivery that is
  later Undone leaves its `matches/{id}/ballMeta/{deliveryId}` doc behind (the scoring
  engine's rebuild doesn't prune ballMeta). Harmless: nothing renders ballMeta for a
  delivery that no longer exists. Cleared by wiping the match.
- Leftover dev/test **accounts, teams, players** in the production directory (full inventory
  in `git show` of an earlier `next.md` revision).
- `/admin/tools` → "Client errors" panel may still list **stale ReferenceErrors dated
  2026-08-29** from a broken WIP build. Already fixed in code; they age out after 7 days;
  the panel has no manual clear.

## 5. FIXED — Wagon Wheel / Pitch Map shot-placement animation didn't replay

**This was a real bug** (correcting the earlier "not a bug" note). The shot-placement
*motion* — the wagon-wheel ray drawing itself out from the batter, the pitch-map mark
dropping in from the bowler's end — is driven by SMIL (`<animate>` / `<animateTransform>`)
with a declarative `begin="0s"`. `begin="0s"` resolves against the **SVG document
timeline**, not "now". The first ball of a scoring session the SVG is fresh, so `0s` ≈ now
and the animation plays. Every ball after that the SVG has been alive for seconds, so `0s`
is in the past → SMIL jumps straight to the frozen end state (`fill="freeze"`) and the mark
just *appears*. That is exactly what the owner reported ("it doesn't [animate] yet it
should").

**Confirmed at runtime on prod:** a fresh `<animate begin="0s" fill="freeze">` inserted
into the live scoring SVG (timeline age ~180s) immediately shows its end value — no
interpolation.

**Fix** (`src/components/scoring/WagonWheelInput.tsx`,
`src/components/scoring/PitchLengthInput.tsx`): a `useLayoutEffect` keyed on the reveal key
calls `SVGAnimationElement.beginElement()` on every `animate` / `animateTransform` in the
reveal group, so the animation restarts *from now* on every commit (a fresh tag or a
reopened saved ball). Layout effect = pre-paint, so no flash of the end state. Wrapped in
`try/catch` — if an engine lacks `beginElement()` the declarative `begin` still runs and
the mark renders correctly at rest (i.e. exactly today's behaviour), so the change is
purely additive with no regression risk. Honoured `reducedMotion` (skips entirely).

**Not visually verified in the automation browser.** The Browser pane used for this pass
does not tick SMIL / CSS / WAA animation clocks frame-by-frame (a clean controlled probe
animation also fails to progress there), and screenshots are too slow to catch a ~340 ms
motion. The fix compiles (`tsc` 0, `lint` 0), is in the deployed bundle
(`ScoringPage-*.js` contains `beginElement`), and `beginElement()` is the standard, widely
used way to re-fire SMIL. **Someone should eyeball it in a normal desktop browser**: score
2+ balls, tag a shot on the 2nd, confirm the ray draws itself / the mark drops in.

## 6. Deliberately left alone

- **No-ball boundary count** (`domain/scoring.ts` ~line 237): a 4 or 6 off a no-ball adds to
  runs/strike-rate but not the batter's 4s/6s column. `scoring.ts` is treated as
  verified/frozen — flagged for the owner's own call, not changed.
- **`AppShell` secondary controls hidden below 640px** (Background picker, Tutorial button,
  name/role block) — deliberate, so the signed-in header fits a 320px phone.
- **`Tabs` wraps to a 2nd row on very narrow phones** for the 5-tab Stats strip — deliberate
  (all tabs reachable beats a hidden horizontal scroll). On laptop/iPad it stays one row.
- **Stale `// verified phone` comment** in `src/features/auth/SignupPage.tsx:12` — copy-only,
  not rendered; left for a copy sweep.

## 7. Known cosmetic — Firebase Storage `listAll` CORS console lines

`firebasestorage.googleapis.com/...?prefix=players/` preflight fails (that bucket does not
exist / is not in a CORS allowlist — see §3). **This DOES appear on the deployed scoring
page** (player-avatar gallery probe), as a handful of red `CORS policy` /
`ERR_HTTP2_PROTOCOL_ERROR` lines. Caught; galleries still render from R2; the
`storage.service.ts` circuit breaker limits it to ~1 probe per session. Cosmetic — no user
impact — but noisy in the console. To silence it, gate the `listAll` probe behind a
"Storage configured" check the same way image upload is gated.
