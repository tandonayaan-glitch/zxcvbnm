import {
  collection,
  getCountFromServer,
  getDocs,
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
  /** True when at least one match's delivery log couldn't be read this run, so
   *  `counts.deliveries` is a floor, not the exact total. Never silently zero. */
  deliveriesPartial: boolean
  generatedAt: number
}

async function count(ref: Parameters<typeof getCountFromServer>[0]): Promise<number> {
  const snap = await getCountFromServer(ref)
  return snap.data().count
}

/** Run `task` over `items` with at most `limit` in flight, results in order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await task(items[i])
    }
  })
  await Promise.all(runners)
  return results
}

/**
 * Total ball-by-ball deliveries across every match.
 *
 * Deliveries live in the per-match `matches/{id}/deliveries` subcollection. A
 * single collection-group aggregate over all of them would need a
 * `match /{path=**}/deliveries/{ballId}` read rule, which `firestore.rules`
 * deliberately does not grant (public read is scoped to the `matches/{id}` path,
 * not to arbitrary-depth `deliveries` anywhere in the tree). So instead this
 * enumerates matches and sums each match's own subcollection count — every one
 * of which IS covered by the existing `allow read: if true` on
 * `matches/{id}/deliveries`. A match whose count can't be read is skipped and
 * reported via `partial`, never silently counted as zero.
 */
async function tallyDeliveries(
  matchIds: string[],
): Promise<{ total: number; partial: boolean }> {
  const per = await mapLimit(matchIds, 24, async (id) => {
    try {
      return await count(collection(db, COL.matches, id, COL.deliveries))
    } catch {
      return null
    }
  })
  let total = 0
  let partial = false
  for (const n of per) {
    if (n === null) partial = true
    else total += n
  }
  return { total, partial }
}

/**
 * Read-only Firestore usage snapshot for the master-admin diagnostics panel.
 * Top-level collections use server-side aggregate counts (`getCountFromServer`);
 * the deliveries total is summed per match (see `tallyDeliveries` for why a
 * collection-group aggregate isn't used here).
 */
export async function getPlatformDiagnostics(): Promise<PlatformDiagnostics> {
  const [players, teams, tournaments, users, auditLogs, adminRequests, matchSnap] =
    await Promise.all([
      count(collection(db, COL.players)),
      count(collection(db, COL.teams)),
      count(collection(db, COL.tournaments)),
      count(collection(db, COL.users)),
      count(collection(db, COL.auditLogs)),
      count(collection(db, COL.adminRequests)),
      getDocs(collection(db, COL.matches)),
    ])

  const { total: deliveries, partial: deliveriesPartial } = await tallyDeliveries(
    matchSnap.docs.map((d) => d.id),
  )

  return {
    counts: {
      players,
      teams,
      tournaments,
      matches: matchSnap.size,
      users,
      auditLogs,
      adminRequests,
      deliveries,
    },
    deliveriesPartial,
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
