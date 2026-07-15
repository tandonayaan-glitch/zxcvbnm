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
import type { Club } from '@/types'

const clubsCol = () => collection(db, COL.clubs)

export type ClubInput = Omit<Club, 'id' | 'createdAt' | 'updatedAt'>

export async function listClubs(): Promise<Club[]> {
  const snap = await getDocs(query(clubsCol(), orderBy('name')))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as Club)
    .filter((c) => !c.deletedAt)
}

export async function getClub(id: string): Promise<Club | null> {
  const snap = await getDoc(doc(db, COL.clubs, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Club) : null
}

export async function createClub(input: ClubInput): Promise<string> {
  const now = Date.now()
  const ref = doc(clubsCol())
  const data: Club = { ...input, id: ref.id, createdAt: now, updatedAt: now }
  await setDoc(ref, pruneUndefined(data))
  return ref.id
}

export async function updateClub(
  id: string,
  patch: Partial<ClubInput>,
): Promise<void> {
  await updateDoc(
    doc(db, COL.clubs, id),
    pruneUndefined({ ...patch, updatedAt: Date.now() }),
  )
}

export async function deleteClub(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.clubs, id))
}
