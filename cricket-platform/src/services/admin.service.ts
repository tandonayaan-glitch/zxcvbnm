import {
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'

async function deleteAll(colName: string): Promise<number> {
  const snap = await getDocs(collection(db, colName))
  if (snap.empty) return 0
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  return snap.size
}

/**
 * Permanently clear all cached leaderboard/stat documents. Match data itself is
 * untouched, so leaderboards can be rebuilt from history with "Recompute".
 * Returns how many docs were removed for the audit trail.
 */
export async function clearLeaderboards(): Promise<{
  playerStats: number
  teamStats: number
  standings: number
}> {
  const playerStats = await deleteAll(COL.playerStats)
  const teamStats = await deleteAll(COL.teamStats)

  // standings live under each tournament
  let standings = 0
  const tSnap = await getDocs(collection(db, COL.tournaments))
  for (const t of tSnap.docs) {
    const sSnap = await getDocs(
      collection(db, COL.tournaments, t.id, COL.standings),
    )
    if (!sSnap.empty) {
      const batch = writeBatch(db)
      sSnap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
      standings += sSnap.size
    }
  }

  return { playerStats, teamStats, standings }
}
