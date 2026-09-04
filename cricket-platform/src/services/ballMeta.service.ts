import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import type { BallMeta } from '@/types'

function ballMetaCol(matchId: string) {
  return collection(db, COL.matches, matchId, COL.ballMeta)
}

/** Merge-writes a shot-zone/line-length tag for one delivery. Optional and
 * additive — never called from the scoring engine or its write path. */
export async function recordBallMeta(
  matchId: string,
  deliveryId: string,
  patch: Partial<Pick<BallMeta, 'zone' | 'line' | 'length' | 'note' | 'reviewed' | 'videoTimestampSec'>>,
): Promise<void> {
  await setDoc(
    doc(ballMetaCol(matchId), deliveryId),
    pruneUndefined({ id: deliveryId, ...patch, createdAt: Date.now() }),
    { merge: true },
  )
}

export async function listBallMeta(matchId: string): Promise<BallMeta[]> {
  const snap = await getDocs(ballMetaCol(matchId))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as BallMeta)
}
