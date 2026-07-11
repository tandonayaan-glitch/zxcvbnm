import {
  collection,
  collectionGroup,
  getCountFromServer,
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
} from 'firebase/firestore'
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

/**
 * Force a resync: tear down and re-establish Firestore's network connection
 * (forcing every active listener to re-subscribe), then wait for any writes
 * that were queued locally to be acknowledged by the backend.
 *
 * `waitForPendingWrites` never resolves while genuinely offline (there's
 * nothing to acknowledge it against), so it's raced against a timeout —
 * without that, "force resync" while offline would spin forever instead of
 * honestly reporting "still pending, will retry once reconnected".
 *
 * The Firestore client SDK doesn't expose an enumerable list of queued
 * mutations, so this can't show a literal per-write "queue" — it reports
 * aggregate sync state (did pending writes flush, how long it took) rather
 * than a fabricated list of individual operations.
 */
export async function forceResync(): Promise<{ ms: number; flushed: boolean }> {
  const start = Date.now()
  await disableNetwork(db)
  await enableNetwork(db)
  const flushed = await Promise.race([
    waitForPendingWrites(db).then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 8000)),
  ])
  return { ms: Date.now() - start, flushed }
}
