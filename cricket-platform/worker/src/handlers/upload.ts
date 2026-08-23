import type { Env } from '../types'
import { HttpError } from '../types'
import { verifyFirebaseIdToken, bearerToken } from '../authToken'
import { getCallerRole, canWriteFolder } from '../roles'
import { LIMITS, isAcceptedImageType, isKnownFolderKey } from '../limits'
import { reserveUsage, releaseUsage, LimitExceededError } from '../usage'
import { keyToObjectId } from '../keys'

function folderOf(key: string): string {
  const idx = key.lastIndexOf('/')
  return idx === -1 ? key : key.slice(0, idx)
}

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (!key) throw new HttpError(400, 'Missing "key" query parameter.')
  if (!isKnownFolderKey(key)) throw new HttpError(400, 'Unknown upload folder.')

  const uid = await verifyFirebaseIdToken(bearerToken(request), env.FIREBASE_PROJECT_ID)
  const role = await getCallerRole(env, uid)
  if (!canWriteFolder(role, key)) {
    throw new HttpError(403, 'Your account does not have permission to upload here.')
  }

  const contentType = request.headers.get('Content-Type') ?? ''
  if (!isAcceptedImageType(contentType)) {
    throw new HttpError(415, 'Please choose a JPEG, PNG, WebP or GIF image.')
  }

  const body = await request.arrayBuffer()
  if (body.byteLength === 0) throw new HttpError(400, 'Empty upload.')
  if (body.byteLength > LIMITS.MAX_IMAGE_BYTES) {
    throw new HttpError(413, 'Image is too large (max 5MB).')
  }

  const objectId = keyToObjectId(key)
  const folder = folderOf(key)

  // Reserve quota BEFORE writing any bytes to R2. If this throws (limit exceeded, or a
  // genuine Firestore error), nothing has been written anywhere — there's nothing to roll
  // back. This ordering is deliberate: it's the only way to guarantee the usage counters
  // can never understate real R2 usage, even if the R2 write below fails.
  try {
    await reserveUsage(env, uid, objectId, key, folder, body.byteLength)
  } catch (err) {
    if (err instanceof LimitExceededError) {
      throw new HttpError(err.scope === 'user' ? 403 : 507, err.message)
    }
    throw new HttpError(500, 'Could not reserve storage quota. Please try again.')
  }

  try {
    await env.MEDIA_BUCKET.put(key, body, { httpMetadata: { contentType } })
  } catch (err) {
    // The reservation succeeded but the actual write didn't — release it so the counters
    // don't overstate forever. Best-effort: if this itself fails, the counters are left
    // conservatively too high (safe direction, never lets anyone exceed the real cap) —
    // see usage.ts's own doc comment for the full reasoning.
    try {
      await releaseUsage(env, uid, objectId, body.byteLength)
    } catch {
      /* logged by the outer catch below; nothing more to do from here */
    }
    console.error('R2 put failed after reserving usage', { key, err })
    throw new HttpError(500, 'Upload failed. Please try again.')
  }

  return Response.json({ url: `${env.R2_PUBLIC_BASE_URL}/${key}` }, { status: 201 })
}
