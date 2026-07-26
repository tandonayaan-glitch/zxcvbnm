import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import type { MatchReaction, ReactionEmoji } from '@/types'

function reactionsCol(matchId: string) {
  return collection(db, COL.matches, matchId, COL.reactions)
}

export async function listMatchReactions(matchId: string): Promise<MatchReaction[]> {
  const snap = await getDocs(reactionsCol(matchId))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as MatchReaction)
}

/** Toggles one emoji for this user on this match — on if they hadn't reacted with it, off if
 *  they had. One doc per (match, user) keeps this a single read + write regardless of how many
 *  emojis they've toggled over time. */
export async function toggleReaction(
  matchId: string,
  userId: string,
  emoji: ReactionEmoji,
): Promise<void> {
  const ref = doc(reactionsCol(matchId), userId)
  const snap = await getDoc(ref)
  const current: ReactionEmoji[] = snap.exists() ? (snap.data().emojis ?? []) : []
  const next = current.includes(emoji)
    ? current.filter((e) => e !== emoji)
    : [...current, emoji]
  await setDoc(ref, { userId, matchId, emojis: next, updatedAt: Date.now() })
}
