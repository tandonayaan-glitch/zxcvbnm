import { collection, doc, deleteDoc, getDocs, setDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { MatchComment, UserProfile } from '@/types'

const commentsCol = () => collection(db, COL.comments)

const MAX_LENGTH = 500

export async function listComments(matchId: string): Promise<MatchComment[]> {
  const snap = await getDocs(query(commentsCol(), where('matchId', '==', matchId)))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as MatchComment)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function postComment(
  matchId: string,
  actor: UserProfile,
  text: string,
): Promise<void> {
  const trimmed = text.trim().slice(0, MAX_LENGTH)
  if (!trimmed) throw new Error('Comment cannot be empty.')
  const id = genId('cmt_')
  const comment: MatchComment = {
    id,
    matchId,
    authorId: actor.id,
    authorName: actor.displayName || actor.username,
    authorPhotoURL: actor.photoURL ?? null,
    text: trimmed,
    createdAt: Date.now(),
  }
  await setDoc(doc(commentsCol(), id), pruneUndefined(comment))
}

export async function deleteComment(id: string): Promise<void> {
  await deleteDoc(doc(commentsCol(), id))
}
