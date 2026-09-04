import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  increment,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import type { CommunityPost, PostKind, PollOption } from '@/types'

function postsCol() {
  return collection(db, COL.communityPosts)
}
function likesCol() {
  return collection(db, COL.postLikes)
}

export interface CreatePostInput {
  kind: PostKind
  text: string
  imageURL?: string | null
  matchId?: string | null
  matchTitle?: string | null
  pollOptions?: string[] // plain text options; converted to PollOption[] here
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const uid = auth.currentUser?.uid
  const profile = auth.currentUser
  if (!uid) throw new Error('You must be signed in to post.')
  const ref = doc(postsCol())
  const now = Date.now()
  const pollOptions: PollOption[] | undefined = input.pollOptions?.map((text, i) => ({
    id: String(i),
    text,
    votes: 0,
  }))
  const post: CommunityPost = {
    id: ref.id,
    kind: input.kind,
    authorId: uid,
    authorName: profile?.displayName || 'A CricketHub user',
    authorPhotoURL: profile?.photoURL ?? null,
    text: input.text,
    imageURL: input.imageURL ?? null,
    matchId: input.matchId ?? null,
    matchTitle: input.matchTitle ?? null,
    pollOptions,
    pollVoterIds: pollOptions ? [] : undefined,
    likeCount: 0,
    commentCount: 0,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, pruneUndefined(post))
  return ref.id
}

/** Feed, newest first. Cursor-free (no pagination) — matches this app's amateur/semi-pro scale;
 *  a genuinely large feed would need `orderBy` + `startAfter`, deliberately not built until
 *  there's real usage data showing it's needed. */
export function subscribeFeed(cb: (posts: CommunityPost[]) => void): Unsubscribe {
  return onSnapshot(postsCol(), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as CommunityPost)
        .filter((p) => !p.deletedAt)
        .sort((a, b) => b.createdAt - a.createdAt),
    )
  })
}

export async function deletePost(id: string): Promise<void> {
  await updateDoc(doc(postsCol(), id), { deletedAt: Date.now(), updatedAt: Date.now() })
}

export async function votePoll(postId: string, optionId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in to vote.')
  const ref = doc(postsCol(), postId)
  const snap = await getDoc(ref)
  const post = snap.data() as CommunityPost | undefined
  if (!post?.pollOptions) return
  if (post.pollVoterIds?.includes(uid)) return // already voted — one vote per user
  const updated = post.pollOptions.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o))
  await updateDoc(ref, {
    pollOptions: updated,
    pollVoterIds: arrayUnion(uid),
    updatedAt: Date.now(),
  })
}

/* --------------------------- Likes --------------------------- */

function likeId(postId: string, userId: string): string {
  return `${postId}_${userId}`
}

export async function likePost(postId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in to like a post.')
  await setDoc(doc(likesCol(), likeId(postId, uid)), { id: likeId(postId, uid), postId, userId: uid, createdAt: Date.now() })
  await updateDoc(doc(postsCol(), postId), { likeCount: increment(1) }).catch(() => {})
}

export async function unlikePost(postId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await deleteDoc(doc(likesCol(), likeId(postId, uid)))
  await updateDoc(doc(postsCol(), postId), { likeCount: increment(-1) }).catch(() => {})
}

export function subscribeMyLikes(cb: (postIds: Set<string>) => void): Unsubscribe {
  const uid = auth.currentUser?.uid
  if (!uid) {
    cb(new Set())
    return () => {}
  }
  return onSnapshot(likesCol(), (snap) => {
    cb(
      new Set(
        snap.docs
          .map((d) => d.data() as { postId: string; userId: string })
          .filter((l) => l.userId === uid)
          .map((l) => l.postId),
      ),
    )
  })
}
