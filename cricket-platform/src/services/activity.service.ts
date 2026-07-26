import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { ActivityLog } from '@/types'

const activityCol = () => collection(db, COL.activity)

/** Record a platform activity event. Best-effort — never throws into the caller, since a
 *  timeline entry failing to write should never block the action that triggered it. */
export async function logActivity(
  type: ActivityLog['type'],
  message: string,
  opts?: { actorId?: string; refId?: string },
): Promise<void> {
  try {
    const id = genId('act_')
    const entry: ActivityLog = {
      id,
      type,
      message,
      actorId: opts?.actorId,
      refId: opts?.refId,
      createdAt: Date.now(),
    }
    await setDoc(doc(activityCol(), id), pruneUndefined(entry))
  } catch (e) {
    console.error('logActivity failed', e)
  }
}

/**
 * Recent activity, newest first. Pass `refId` to scope to one entity (a team, player,
 * tournament or club id — every creation event stores the created doc's own id there),
 * omit it for the platform-wide feed. Sorted/capped client-side rather than via `orderBy`,
 * same reasoning as `notifications.service.ts` — avoids a composite-index requirement.
 */
export async function listActivity(opts?: {
  refId?: string
  max?: number
}): Promise<ActivityLog[]> {
  const snap = opts?.refId
    ? await getDocs(query(activityCol(), where('refId', '==', opts.refId)))
    : await getDocs(activityCol())
  const items = snap.docs.map((d) => d.data() as ActivityLog)
  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, opts?.max ?? 50)
}
