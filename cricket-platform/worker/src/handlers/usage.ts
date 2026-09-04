import type { Env } from '../types'
import { verifyFirebaseIdToken, bearerToken } from '../authToken'
import { getUserUsage } from '../usage'

/** Authenticated, self-only: a user's own usage figure, for the "X of 100MB used" display.
 *  `?scope=video` returns the separate video-storage allowance instead of images (default). */
export async function handleUsage(request: Request, env: Env): Promise<Response> {
  const uid = await verifyFirebaseIdToken(bearerToken(request), env.FIREBASE_PROJECT_ID)
  const scope = new URL(request.url).searchParams.get('scope') === 'video' ? 'video' : 'image'
  const usage = await getUserUsage(env, scope, uid)
  return Response.json(usage)
}
