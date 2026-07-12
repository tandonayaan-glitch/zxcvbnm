import { collection, doc, getDocs, orderBy, query, setDoc, limit as fbLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { RecoveryAttempt } from '@/types'

const col = () => collection(db, COL.recoveryAttempts)

export async function logRecoveryAttempt(
  input: Omit<RecoveryAttempt, 'id' | 'createdAt'>,
): Promise<void> {
  const ref = doc(col(), genId('rcv_'))
  const data: RecoveryAttempt = { ...input, id: ref.id, createdAt: Date.now() }
  await setDoc(ref, pruneUndefined(data))
}

export async function listRecoveryAttempts(max = 100): Promise<RecoveryAttempt[]> {
  const snap = await getDocs(query(col(), orderBy('createdAt', 'desc'), fbLimit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as RecoveryAttempt)
}
