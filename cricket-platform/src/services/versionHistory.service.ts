import { collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { EntityVersion, UserProfile, VersionedEntity } from '@/types'

const versionsCol = () => collection(db, COL.entityVersions)

const ENTITY_COLLECTION: Record<VersionedEntity, string> = {
  player: COL.players,
  team: COL.teams,
  club: COL.clubs,
  tournament: COL.tournaments,
  match: COL.matches,
}

/**
 * Snapshot an entity's current fields before an edit is applied, so "restore" can write them
 * back. Call this with the doc's state *before* `updateDoc`/`updatePlayer` etc. runs. Best-effort
 * — never throws into the caller, since a missed history entry should never block a real edit.
 */
export async function snapshotVersion(
  entityType: VersionedEntity,
  entityId: string,
  previous: Record<string, any>,
  changedFields: string[],
  actor: UserProfile | null,
  reason?: string,
): Promise<void> {
  if (changedFields.length === 0) return
  try {
    const id = genId('ver_')
    const entry: EntityVersion = {
      id,
      entityType,
      entityId,
      snapshot: previous,
      changedFields,
      editedBy: actor?.id ?? null,
      editedByName: actor?.displayName ?? actor?.username ?? null,
      reason: reason ?? null,
      createdAt: Date.now(),
    }
    await setDoc(doc(versionsCol(), id), pruneUndefined(entry))
  } catch (e) {
    console.error('snapshotVersion failed', e)
  }
}

/** Field names present in `next` whose value differs from `prev` — feeds `changedFields`. */
export function changedKeys(
  prev: Record<string, any>,
  next: Record<string, any>,
): string[] {
  return Object.keys(next).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]))
}

/** Every stored version of one entity, newest edit first. */
export async function listVersions(
  entityType: VersionedEntity,
  entityId: string,
): Promise<EntityVersion[]> {
  const snap = await getDocs(
    query(versionsCol(), where('entityType', '==', entityType), where('entityId', '==', entityId)),
  )
  return snap.docs
    .map((d) => d.data() as EntityVersion)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Restore an entity to a previous version. The entity's *current* state is snapshotted first
 * (as its own new version) so restoring is itself undoable, then the old snapshot is written
 * back over the live doc.
 */
export async function restoreVersion(
  version: EntityVersion,
  actor: UserProfile | null,
): Promise<void> {
  const colName = ENTITY_COLLECTION[version.entityType]
  const ref = doc(db, colName, version.entityId)
  const current = await getDoc(ref)
  if (current.exists()) {
    await snapshotVersion(
      version.entityType,
      version.entityId,
      current.data(),
      Object.keys(version.snapshot),
      actor,
      `Reverted to version from ${new Date(version.createdAt).toLocaleString()}`,
    )
  }
  await updateDoc(ref, pruneUndefined({ ...version.snapshot, updatedAt: Date.now() }))
}
