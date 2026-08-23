import { SignJWT, importPKCS8 } from 'jose'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Datastore scope covers Firestore — this is the same scope the Firebase Admin SDK uses,
// and grants access that BYPASSES firestore.rules entirely (the trust boundary this
// Worker relies on to write imageUsage/r2Objects, which are otherwise locked to
// `allow write: if false` for every client-facing request).
const SCOPE = 'https://www.googleapis.com/auth/datastore'

interface CachedToken {
  accessToken: string
  expiresAt: number // epoch ms
}

let cached: CachedToken | undefined

/**
 * Exchanges the Firebase service-account credentials (Worker secrets) for a short-lived
 * Google OAuth2 access token. This is the one genuinely privileged credential this Worker
 * holds — everything else (the R2 binding, Firebase ID token verification) needs no secret
 * at all. Cached in module scope for the life of the Worker isolate and reused across
 * requests until ~60s before expiry, so most requests don't pay for a fresh token exchange.
 */
export async function getServiceAccountAccessToken(
  clientEmail: string,
  privateKeyRaw: string,
): Promise<string> {
  const now = Date.now()
  if (cached && cached.expiresAt - 60_000 > now) return cached.accessToken

  // `wrangler secret put` stores exactly what you paste; a private key copied out of a
  // Firebase service-account JSON file typically has literal `\n` escape sequences rather
  // than real newlines once it's flattened into a single-line secret value — normalize
  // either form so this works regardless of how the secret was pasted in.
  const pem = privateKeyRaw.includes('\\n') ? privateKeyRaw.replace(/\\n/g, '\n') : privateKeyRaw
  const key = await importPKCS8(pem, 'RS256')
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('55m')
    .sign(key)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    throw new Error(`Service-account token exchange failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return cached.accessToken
}
