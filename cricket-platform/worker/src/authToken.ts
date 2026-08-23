import { createRemoteJWKSet, jwtVerify } from 'jose'
import { HttpError } from './types'

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

/**
 * Verifies a Firebase Auth ID token against Google's public keys — signature verification
 * against a published, rotating JWKS, the same mechanism Firebase's own backends use. No
 * secret is needed for this: anyone can fetch these public keys, and a valid signature is
 * proof the token was really issued by Firebase Auth for this exact project, not forged.
 * Returns the token's uid (the `sub` claim). Throws `HttpError(401, ...)` on any failure —
 * an expired/malformed/forged token is a client-facing 401, never a 500: this endpoint is
 * working exactly as intended when it rejects a bad token.
 */
export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<string> {
  jwks ??= createRemoteJWKSet(new URL(JWKS_URL))
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('Token has no subject (uid).')
    }
    return payload.sub
  } catch {
    throw new HttpError(401, 'Invalid or expired sign-in. Please sign in again.')
  }
}

/** Extracts the bearer token from an Authorization header. Throws `HttpError(401, ...)` —
 *  same reasoning as `verifyFirebaseIdToken`, a missing header is a normal, expected
 *  rejection, not a server fault. */
export function bearerToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) throw new HttpError(401, 'You must be signed in.')
  return match[1]
}
