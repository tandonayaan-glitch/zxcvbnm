import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import type { Prefs } from '@/store/prefsStore'

/** Read a user's saved preferences, or null if they've never saved any. */
export async function getRemotePrefs(uid: string): Promise<Partial<Prefs> | null> {
  const snap = await getDoc(doc(db, COL.userPrefs, uid))
  if (!snap.exists()) return null
  const data = snap.data() as Partial<Prefs> & { updatedAt?: number }
  const { updatedAt: _ignore, ...prefs } = data
  return prefs
}

/** Persist a user's preferences so they follow them across devices. */
export async function saveRemotePrefs(uid: string, prefs: Prefs): Promise<void> {
  await setDoc(
    doc(db, COL.userPrefs, uid),
    pruneUndefined({ ...prefs, updatedAt: Date.now() }),
    { merge: true },
  )
}
