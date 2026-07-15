import { collection, doc, setDoc, getDocs, query, orderBy, limit as fbLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId } from '@/lib/collections'
import type { ClientErrorLog } from '@/types'

/**
 * Record a runtime error for admin diagnostics. Best-effort — never throws, since a broken error
 * logger must never mask the original error or crash the recovery UI that's reporting it.
 */
export async function logClientError(input: {
  referenceId: string
  message: string
  stack?: string
  route: string
  userId?: string | null
}): Promise<void> {
  try {
    const id = genId('err_')
    const entry: ClientErrorLog = {
      id,
      referenceId: input.referenceId,
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 4000),
      route: input.route,
      userId: input.userId ?? null,
      userAgent: navigator.userAgent,
      createdAt: Date.now(),
    }
    await setDoc(doc(db, COL.clientErrors, id), entry)
  } catch (e) {
    console.error('logClientError failed', e)
  }
}

export async function listClientErrors(max = 50): Promise<ClientErrorLog[]> {
  const q = query(collection(db, COL.clientErrors), orderBy('createdAt', 'desc'), fbLimit(max))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ClientErrorLog)
}
