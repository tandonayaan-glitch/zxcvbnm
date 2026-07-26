import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit as fbLimit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId } from '@/lib/collections'
import type { AppNotification, NotificationCategory } from '@/types'

const notificationsCol = () => collection(db, COL.notifications)

/**
 * Record a notification for another user. Best-effort — never throws into the caller, since a
 * notification failing to send should never block the action that triggered it (approving a
 * request, completing a match, merging a player).
 */
export async function notify(
  userId: string,
  category: NotificationCategory,
  title: string,
  body: string,
  link?: string | null,
): Promise<void> {
  try {
    const id = genId('ntf_')
    const entry: AppNotification = {
      id,
      userId,
      category,
      title,
      body,
      link: link ?? null,
      read: false,
      createdAt: Date.now(),
    }
    await setDoc(doc(notificationsCol(), id), entry)
  } catch (e) {
    console.error('notify failed', e)
  }
}

// Sorted/capped client-side rather than via `orderBy` + `where` together — that
// combination needs a composite Firestore index this project doesn't ship
// (same reasoning as `listAllMatches`'s "sorted client-side to avoid index needs").
function newestFirst(docs: AppNotification[], max: number): AppNotification[] {
  return [...docs].sort((a, b) => b.createdAt - a.createdAt).slice(0, max)
}

// Firestore reads for a `where()`-only query (no `orderBy`) aren't guaranteed to come back in
// any particular order, so `fbLimit()` here bounds the read cost for an account that's
// accumulated a very large notification history rather than guaranteeing the newest N — a true
// "always exactly the newest N" guarantee needs `orderBy('createdAt')` alongside the `where()`,
// which needs a composite index this project doesn't ship (same reasoning documented on every
// other client-sorted list here). Set generously above every real `max` this app passes.
const READ_CAP = 1000

/** A user's notifications, newest first, capped at `max` (default 50). */
export async function listNotifications(
  userId: string,
  max = 50,
): Promise<AppNotification[]> {
  const q = query(notificationsCol(), where('userId', '==', userId), fbLimit(READ_CAP))
  const snap = await getDocs(q)
  return newestFirst(
    snap.docs.map((d) => d.data() as AppNotification),
    max,
  )
}

/** Live subscription to a user's recent notifications, for the header bell badge. */
export function subscribeNotifications(
  userId: string,
  cb: (notifications: AppNotification[]) => void,
  max = 50,
): () => void {
  const q = query(notificationsCol(), where('userId', '==', userId), fbLimit(READ_CAP))
  return onSnapshot(
    q,
    (snap) => cb(newestFirst(snap.docs.map((d) => d.data() as AppNotification), max)),
    () => cb([]),
  )
}

export async function markRead(id: string): Promise<void> {
  await updateDoc(doc(notificationsCol(), id), { read: true })
}

export async function markAllRead(userId: string): Promise<void> {
  const unread = await getDocs(
    query(notificationsCol(), where('userId', '==', userId), where('read', '==', false)),
  )
  if (unread.empty) return
  const batch = writeBatch(db)
  unread.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}
