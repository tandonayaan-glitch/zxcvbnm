import type { Env } from '../types'
import { HttpError } from '../types'
import { verifyFirebaseIdToken, bearerToken } from '../authToken'
import { getCallerRole, canWriteFolder } from '../roles'
import { isKnownFolderKey, isVideoFolderKey } from '../limits'
import { getTrackedObject, releaseUsage, type UsageScope } from '../usage'
import { keyToObjectId } from '../keys'

export async function handleDelete(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (!key) throw new HttpError(400, 'Missing "key" query parameter.')
  if (!isKnownFolderKey(key)) throw new HttpError(400, 'Unknown folder.')

  const uid = await verifyFirebaseIdToken(bearerToken(request), env.FIREBASE_PROJECT_ID)
  const role = await getCallerRole(env, uid)
  // Same permission model as upload — preserves the existing behavior exactly: any
  // manager-role account can delete any image in a manager-gated folder, not just their
  // own uploads (storage.rules never enforced per-uploader ownership either).
  if (!canWriteFolder(role, key)) {
    throw new HttpError(403, 'Your account does not have permission to remove this.')
  }

  const scope: UsageScope = isVideoFolderKey(key) ? 'video' : 'image'
  const objectId = keyToObjectId(key)
  // Look up who actually gets credited back BEFORE deleting — once the R2 object is gone
  // there's no way to recover its size from R2 itself.
  const tracked = await getTrackedObject(env, scope, objectId)

  // R2 delete first, counter release second — the opposite order from upload, and
  // deliberately so: for a delete, the safe-direction failure is "R2 is gone but the
  // counter hasn't caught up yet" (counter overstates real usage — annoying, never
  // dangerous). The unsafe order would be releasing the counter first and then failing to
  // actually delete from R2, which would let the freed-up quota be reused while the old
  // file still silently occupies real bytes.
  await env.MEDIA_BUCKET.delete(key)

  let counterWarning: string | undefined
  if (tracked) {
    try {
      await releaseUsage(env, scope, tracked.ownerId, objectId, tracked.size)
    } catch (err) {
      // The file is genuinely gone; only the counter update failed. Don't report this
      // delete as failed to the caller — that would be actively misleading — but do
      // surface it so it's visible rather than silently swallowed.
      console.error('releaseUsage failed after successful R2 delete', { key, err })
      counterWarning = 'Deleted, but storage usage may take a moment to update.'
    }
  }

  return Response.json({ ok: true, counterWarning })
}
