import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { notify } from './notifications.service'
import type { LookingForPost, LookingForResponse, LookingForKind } from '@/types'

function postsCol() {
  return collection(db, COL.lookingForPosts)
}
function responsesCol() {
  return collection(db, COL.lookingForResponses)
}

const DEFAULT_EXPIRY_DAYS = 30

export interface CreateLookingForInput {
  kind: LookingForKind
  title: string
  description: string
  location?: string
  format?: LookingForPost['format']
  skillLevel?: LookingForPost['skillLevel']
  date?: number | null
  teamId?: string | null
  teamName?: string | null
  tournamentId?: string | null
  tournamentName?: string | null
  expiresInDays?: number
}

export async function createLookingForPost(input: CreateLookingForInput): Promise<string> {
  const uid = auth.currentUser?.uid
  const name = auth.currentUser?.displayName
  if (!uid) throw new Error('You must be signed in.')
  const ref = doc(postsCol())
  const now = Date.now()
  const post: LookingForPost = {
    id: ref.id,
    kind: input.kind,
    title: input.title,
    description: input.description,
    location: input.location,
    format: input.format,
    skillLevel: input.skillLevel,
    date: input.date ?? null,
    teamId: input.teamId ?? null,
    teamName: input.teamName ?? null,
    tournamentId: input.tournamentId ?? null,
    tournamentName: input.tournamentName ?? null,
    status: 'open',
    createdBy: uid,
    createdByName: name || 'A CricketHub user',
    expiresAt: now + (input.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 86400000,
    responseCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, pruneUndefined(post))
  return ref.id
}

/** Every open, unexpired post, most-recent first — expired posts are filtered out client-side
 *  (their `status` field isn't flipped server-side by anything, since there's no scheduled
 *  function in this project; `expiresAt` is the real source of truth, checked at read time). */
export async function listOpenLookingForPosts(): Promise<LookingForPost[]> {
  const snap = await getDocs(postsCol())
  const now = Date.now()
  return snap.docs
    .map((d) => d.data() as LookingForPost)
    .filter((p) => !p.deletedAt && p.status === 'open' && p.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function subscribeLookingForPosts(cb: (posts: LookingForPost[]) => void): Unsubscribe {
  return onSnapshot(postsCol(), (snap) => {
    const now = Date.now()
    cb(
      snap.docs
        .map((d) => d.data() as LookingForPost)
        .filter((p) => !p.deletedAt && p.status === 'open' && p.expiresAt > now)
        .sort((a, b) => b.createdAt - a.createdAt),
    )
  })
}

export async function closeLookingForPost(id: string): Promise<void> {
  await updateDoc(doc(postsCol(), id), { status: 'closed', updatedAt: Date.now() })
}

export async function deleteLookingForPost(id: string): Promise<void> {
  await deleteDoc(doc(postsCol(), id))
}

export async function respondToLookingForPost(postId: string, message?: string): Promise<void> {
  const uid = auth.currentUser?.uid
  const name = auth.currentUser?.displayName
  if (!uid) throw new Error('You must be signed in.')
  const ref = doc(responsesCol())
  const response: LookingForResponse = {
    id: ref.id,
    postId,
    responderId: uid,
    responderName: name || 'A CricketHub user',
    message,
    status: 'pending',
    createdAt: Date.now(),
  }
  await setDoc(ref, pruneUndefined(response))
  // Best-effort — the post's responseCount is a display convenience, not authoritative (the real
  // count is always derivable from the responses collection itself).
  try {
    await updateDoc(doc(postsCol(), postId), { updatedAt: Date.now() })
  } catch {
    /* non-fatal */
  }
  try {
    const postSnap = await getDoc(doc(postsCol(), postId))
    const post = postSnap.data() as LookingForPost | undefined
    if (post && post.createdBy !== uid) {
      await notify(
        post.createdBy,
        'community',
        'New response to your post',
        `${response.responderName} responded to "${post.title}".`,
        '/looking-for',
      )
    }
  } catch {
    /* best-effort — never block the response itself */
  }
}

export function subscribeResponsesFor(postId: string, cb: (responses: LookingForResponse[]) => void): Unsubscribe {
  return onSnapshot(responsesCol(), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as LookingForResponse)
        .filter((r) => r.postId === postId)
        .sort((a, b) => b.createdAt - a.createdAt),
    )
  })
}

export async function setResponseStatus(id: string, status: LookingForResponse['status']): Promise<void> {
  await updateDoc(doc(responsesCol(), id), { status })
}
