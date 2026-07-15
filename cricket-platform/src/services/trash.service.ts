import { collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { deletePlayer } from './players.service'
import { deleteTeam } from './teams.service'
import { deleteClub } from './clubs.service'
import { deleteSeason } from './seasons.service'
import { deleteTournament } from './tournaments.service'
import { purgeMatch } from './scoring.service'
import { logAudit } from './audit.service'
import type { UserProfile } from '@/types'

export type TrashEntityType =
  | 'player'
  | 'team'
  | 'club'
  | 'season'
  | 'tournament'
  | 'match'

const TRASH_COLLECTIONS: Record<TrashEntityType, string> = {
  player: COL.players,
  team: COL.teams,
  club: COL.clubs,
  season: COL.seasons,
  tournament: COL.tournaments,
  match: COL.matches,
}

const TRASH_LABEL_FIELD: Record<TrashEntityType, string> = {
  player: 'fullName',
  team: 'name',
  club: 'name',
  season: 'name',
  tournament: 'name',
  match: 'title',
}

/** Match cleans up its `deliveries`/`ballMeta` subcollections; the rest are plain doc deletes. */
const PERMANENT_DELETERS: Record<TrashEntityType, (id: string) => Promise<void>> = {
  player: deletePlayer,
  team: deleteTeam,
  club: deleteClub,
  season: deleteSeason,
  tournament: deleteTournament,
  match: purgeMatch,
}

export interface TrashedDoc {
  id: string
  type: TrashEntityType
  label: string
  deletedAt: number
  deletedBy?: string | null
  ownerId?: string | null
}

/** Every soft-deleted doc across all trash-supported collections, newest-deleted first. */
export async function listTrash(): Promise<TrashedDoc[]> {
  const types = Object.keys(TRASH_COLLECTIONS) as TrashEntityType[]
  const perType = await Promise.all(
    types.map(async (type) => {
      const snap = await getDocs(collection(db, TRASH_COLLECTIONS[type]))
      return snap.docs
        .map(
          (d) =>
            ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<
              string,
              unknown
            > & { id: string },
        )
        .filter((data) => typeof data.deletedAt === 'number')
        .map(
          (data): TrashedDoc => ({
            id: data.id as string,
            type,
            label: String(data[TRASH_LABEL_FIELD[type]] ?? data.id),
            deletedAt: data.deletedAt as number,
            deletedBy: (data.deletedBy as string | null | undefined) ?? null,
            ownerId: (data.ownerId as string | null | undefined) ?? null,
          }),
        )
    }),
  )
  return perType.flat().sort((a, b) => b.deletedAt - a.deletedAt)
}

/** Move a doc to Trash. It stops appearing in every list/browse surface but nothing is rewritten
 *  or deleted — matches this app's existing "referenced docs can vanish, readers fall back
 *  gracefully" convention, so restoring is always exact and free of side effects. */
export async function softDelete(
  type: TrashEntityType,
  id: string,
  actor: UserProfile | null,
): Promise<void> {
  await updateDoc(doc(db, TRASH_COLLECTIONS[type], id), {
    deletedAt: Date.now(),
    deletedBy: actor?.id ?? null,
  })
  await logAudit(actor, `${type}.trash`, `Moved ${type} "${id}" to Trash`)
}

export async function restoreFromTrash(
  type: TrashEntityType,
  id: string,
  actor: UserProfile | null,
): Promise<void> {
  await updateDoc(doc(db, TRASH_COLLECTIONS[type], id), {
    deletedAt: null,
    deletedBy: null,
  })
  await logAudit(actor, `${type}.restore`, `Restored ${type} "${id}" from Trash`)
}

export async function permanentlyDelete(
  type: TrashEntityType,
  id: string,
  actor: UserProfile | null,
): Promise<void> {
  await PERMANENT_DELETERS[type](id)
  await logAudit(actor, `${type}.permanentDelete`, `Permanently deleted ${type} "${id}"`)
}

export async function bulkRestore(
  items: { type: TrashEntityType; id: string }[],
  actor: UserProfile | null,
): Promise<void> {
  for (const item of items) await restoreFromTrash(item.type, item.id, actor)
}

export async function bulkPermanentlyDelete(
  items: { type: TrashEntityType; id: string }[],
  actor: UserProfile | null,
): Promise<void> {
  for (const item of items) await permanentlyDelete(item.type, item.id, actor)
}

/**
 * Permanently delete everything past the retention window. There's no backend cron in this
 * client-only app, so "automatic cleanup" means an admin presses a button (Trash page) rather
 * than a fabricated schedule — consistent with `forceResync()`'s honest-best-effort approach.
 * Returns how many items were purged.
 */
export async function purgeExpired(
  retentionDays: number,
  actor: UserProfile | null,
): Promise<number> {
  const trash = await listTrash()
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const expired = trash.filter((t) => t.deletedAt < cutoff)
  for (const t of expired) await permanentlyDelete(t.type, t.id, actor)
  return expired.length
}
