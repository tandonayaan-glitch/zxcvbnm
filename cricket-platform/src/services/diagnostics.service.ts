import { collection, collectionGroup, getCountFromServer } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'

export interface PlatformDiagnostics {
  counts: {
    players: number
    teams: number
    tournaments: number
    matches: number
    users: number
    deliveries: number
    auditLogs: number
    adminRequests: number
  }
  generatedAt: number
}

async function count(ref: Parameters<typeof getCountFromServer>[0]): Promise<number> {
  const snap = await getCountFromServer(ref)
  return snap.data().count
}

/**
 * Read-only Firestore usage snapshot for the master-admin diagnostics panel.
 * Uses server-side aggregate counts (getCountFromServer), so it's cheap even
 * as the platform grows — it never downloads the underlying documents.
 */
export async function getPlatformDiagnostics(): Promise<PlatformDiagnostics> {
  const [players, teams, tournaments, matches, users, auditLogs, adminRequests, deliveries] =
    await Promise.all([
      count(collection(db, COL.players)),
      count(collection(db, COL.teams)),
      count(collection(db, COL.tournaments)),
      count(collection(db, COL.matches)),
      count(collection(db, COL.users)),
      count(collection(db, COL.auditLogs)),
      count(collection(db, COL.adminRequests)),
      // Deliveries live under matches/{id}/deliveries — a collection-group
      // count reaches every match's subcollection in one aggregate query.
      count(collectionGroup(db, COL.deliveries)),
    ])

  return {
    counts: { players, teams, tournaments, matches, users, auditLogs, adminRequests, deliveries },
    generatedAt: Date.now(),
  }
}
