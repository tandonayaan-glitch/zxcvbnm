# CricketHub media Worker

Handles authenticated image uploads/deletes against the `crickethub-media` R2 bucket, and
unauthenticated folder listing. Public reads of the images themselves happen directly
against R2's public bucket URL and never touch this Worker.

## What this Worker needs, and why

- **R2 access**: none — it uses a native `[[r2_buckets]]` binding (see `wrangler.toml`),
  which Cloudflare authenticates internally. There is no R2 access-key-id/secret anywhere.
- **Firebase Auth verification**: no secret — Firebase ID tokens are verified against
  Google's public JWKS, the same mechanism Firebase's own backends use.
- **Firestore writes** (`imageUsage/*`, `r2Objects/*`): the one genuinely privileged
  credential this Worker holds. These two collections are locked to
  `allow write: if false` for every client-facing request in `firestore.rules` — this
  Worker is the only writer, authenticated as a real Firebase service account whose
  requests bypass security rules entirely (the same trust boundary the Admin SDK uses).

## One-time setup (you, not me — I have no live credentials to do this)

1. **Generate a service-account key**: Firebase Console → Project Settings → Service
   Accounts → "Generate new private key". This downloads a JSON file — keep it private,
   never commit it.
2. **Set the two secrets** (from that JSON file's `client_email` and `private_key` fields):
   ```bash
   cd worker
   npx wrangler secret put FIREBASE_CLIENT_EMAIL
   npx wrangler secret put FIREBASE_PRIVATE_KEY
   ```
   Paste the `private_key` value exactly as it appears in the JSON (including the
   `-----BEGIN PRIVATE KEY-----...` header/footer) — the Worker normalizes escaped `\n`
   sequences automatically either way.
3. **Deploy** (not done by me — explicitly out of scope until you approve it):
   ```bash
   npm install
   npx wrangler deploy
   ```
   Wrangler will print the deployed URL (`https://crickethub-media-worker.<subdomain>.workers.dev`).
   Put that in the frontend's `.env.local` as `VITE_R2_WORKER_URL`.
4. **Local dev** (optional): `npx wrangler dev` — put the same two secrets in a local
   `.dev.vars` file (gitignored) for local testing without touching production secrets:
   ```
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

## Config that isn't secret (`wrangler.toml`'s `[vars]`)

- `FIREBASE_PROJECT_ID` — already public in the frontend's own `VITE_FIREBASE_PROJECT_ID`.
- `R2_PUBLIC_BASE_URL` — the bucket's `r2.dev` public URL. **This is a rate-limited
  "development" URL per Cloudflare's own docs, not recommended for real production
  traffic** — fine for now (no custom domain requested yet), but move to a Cloudflare
  "Custom Domain" for the bucket before relying on this at real scale. Nothing else in
  this design needs to change to do that later — just update this one value and redeploy.
- `ALLOWED_ORIGINS` — CORS allowlist. Update if the app's Hosting domain changes.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/upload?key=<folder>/<filename>` | Firebase ID token | Validate, enforce caps, store to R2 |
| POST | `/delete?key=<key>` | Firebase ID token | Remove from R2, release quota |
| GET | `/list?folder=<folder>` | none (public) | List a folder's objects for galleries/media library |
| GET | `/usage` | Firebase ID token | The caller's own current usage + limit |

## Storage limits

Defined in exactly one place: `src/limits.ts`. Change values there only.

## What's still untested

Everything here has never run against a real Firebase project or R2 bucket from within
this sandbox (no live credentials were available) — `tsc --noEmit` is clean, but the actual
JWT verification, service-account token exchange, Firestore REST commit/precondition
behavior, and R2 binding calls have not been exercised end-to-end. Test locally with
`wrangler dev` and real secrets before deploying to production traffic.
