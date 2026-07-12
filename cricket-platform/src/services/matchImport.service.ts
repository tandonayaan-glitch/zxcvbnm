import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import type { Delivery, Match } from '@/types'

export interface MatchImportPreview {
  title: string
  teamA: string
  teamB: string
  deliveryCount: number
  status: string
}

/**
 * Import contract: exactly the shape `matchToJSON()` (`domain/matchExport.ts`)
 * produces — `{ match, deliveries }`. This is a deliberate choice over
 * guessing an external file format: it's the one match export/import
 * round-trip this app already defines and controls end to end, so "import"
 * here means restoring a match that was previously exported from this same
 * app (backup/transfer between environments), not parsing an arbitrary
 * third-party format nobody has specified.
 */
export function parseMatchImport(json: string): { match: Match; deliveries: Delivery[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Not valid JSON.')
  }
  const obj = parsed as { match?: unknown; deliveries?: unknown }
  const match = obj.match as Match | undefined
  const deliveries = obj.deliveries as Delivery[] | undefined
  if (!match || typeof match !== 'object' || !match.teamA || !match.teamB || !match.innings) {
    throw new Error(
      "Doesn't look like a match export — expected the { match, deliveries } shape from this app's own \"Export JSON\" button.",
    )
  }
  return { match, deliveries: Array.isArray(deliveries) ? deliveries : [] }
}

export function previewMatchImport(json: string): MatchImportPreview {
  const { match, deliveries } = parseMatchImport(json)
  return {
    title: match.title,
    teamA: match.teamA.name,
    teamB: match.teamB.name,
    deliveryCount: deliveries.length,
    status: match.status,
  }
}

/**
 * Recreates the match as a brand-new doc (never overwrites an existing id —
 * this is a restore/copy, not a merge) owned by the importing admin, plus
 * every delivery. Left `isPublic: false` and archived until reviewed.
 */
export async function importMatch(
  json: string,
  importedByUid: string,
): Promise<string> {
  const { match, deliveries } = parseMatchImport(json)

  const ref = doc(collection(db, COL.matches))
  const now = Date.now()
  const imported: Match = {
    ...match,
    id: ref.id,
    isPublic: false,
    archived: true,
    createdBy: importedByUid,
    ownerId: importedByUid,
    createdAt: now,
    updatedAt: now,
  }

  const BATCH_LIMIT = 400
  let batch = writeBatch(db)
  batch.set(ref, pruneUndefined(imported))
  let ops = 1

  for (const d of deliveries) {
    if (ops >= BATCH_LIMIT) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
    const dRef = doc(collection(db, COL.matches, ref.id, COL.deliveries), d.id)
    batch.set(dRef, pruneUndefined(d))
    ops++
  }

  await batch.commit()
  return ref.id
}
