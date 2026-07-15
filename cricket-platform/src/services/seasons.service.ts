import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import type { Season } from '@/types'

const seasonsCol = () => collection(db, COL.seasons)

export type SeasonInput = Omit<Season, 'id' | 'createdAt' | 'updatedAt'>

export async function listSeasons(): Promise<Season[]> {
  const snap = await getDocs(query(seasonsCol(), orderBy('createdAt', 'desc')))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as Season)
    .filter((s) => !s.deletedAt)
}

export async function getSeason(id: string): Promise<Season | null> {
  const snap = await getDoc(doc(db, COL.seasons, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Season) : null
}

export async function createSeason(input: SeasonInput): Promise<string> {
  const now = Date.now()
  const ref = doc(seasonsCol())
  const data: Season = { ...input, id: ref.id, createdAt: now, updatedAt: now }
  await setDoc(ref, pruneUndefined(data))
  return ref.id
}

export async function updateSeason(
  id: string,
  patch: Partial<SeasonInput>,
): Promise<void> {
  await updateDoc(
    doc(db, COL.seasons, id),
    pruneUndefined({ ...patch, updatedAt: Date.now() }),
  )
}

export async function deleteSeason(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.seasons, id))
}
