import { collection, doc, deleteDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { Announcement, UserProfile } from '@/types'

const announcementsCol = () => collection(db, COL.announcements)

export async function listAnnouncements(tournamentId: string): Promise<Announcement[]> {
  const snap = await getDocs(query(announcementsCol(), where('tournamentId', '==', tournamentId)))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as Announcement)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
}

export async function createAnnouncement(
  tournamentId: string,
  tournamentOwnerId: string | undefined,
  title: string,
  body: string,
  actor: UserProfile,
): Promise<void> {
  const id = genId('ann_')
  const announcement: Announcement = {
    id,
    tournamentId,
    title: title.trim(),
    body: body.trim(),
    pinned: false,
    createdBy: actor.id,
    createdByName: actor.displayName || actor.username,
    createdAt: Date.now(),
    ownerId: tournamentOwnerId,
  }
  await setDoc(doc(announcementsCol(), id), pruneUndefined(announcement))
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(announcementsCol(), id), { pinned })
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(announcementsCol(), id))
}
