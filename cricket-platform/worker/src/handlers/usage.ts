import type { Env } from '../types'
import { verifyFirebaseIdToken, bearerToken } from '../authToken'
import { getUserUsage } from '../usage'

/** Authenticated, self-only: a user's own usage figure, for the "X of 100MB used" display. */
export async function handleUsage(request: Request, env: Env): Promise<Response> {
  const uid = await verifyFirebaseIdToken(bearerToken(request), env.FIREBASE_PROJECT_ID)
  const usage = await getUserUsage(env, uid)
  return Response.json(usage)
}
