import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { notify } from './notifications.service'
import type { Follow, FollowTargetType, Player } from '@/types'

function followsCol() {
  return collection(db, COL.follows)
}

function followId(followerId: string, targetType: FollowTargetType, targetId: string): string {
  return `${followerId}_${targetType}_${targetId}`
}

export async function followEntity(targetType: FollowTargetType, targetId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in to follow.')
  const id = followId(uid, targetType, targetId)
  const follow: Follow = { id, followerId: uid, targetType, targetId, createdAt: Date.now() }
  await setDoc(doc(followsCol(), id), follow)

  // Best-effort: notify a player being followed, when their account is linked (the only
  // target type this app can currently resolve back to a real notifiable account — teams/
  // clubs/tournaments don't have a single "owner account" that's always meaningful to page).
  if (targetType === 'player') {
    try {
      const playerSnap = await getDoc(doc(db, COL.players, targetId))
      const player = playerSnap.data() as Player | undefined
      if (player?.linkedUserId && player.linkedUserId !== uid) {
        await notify(player.linkedUserId, 'community', 'New follower', 'Someone started following you.', `/player/${targetId}`)
      }
    } catch {
      /* best-effort */
    }
  }
}

export async function unfollowEntity(targetType: FollowTargetType, targetId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await deleteDoc(doc(followsCol(), followId(uid, targetType, targetId)))
}

/** Live: does the signed-in user follow this one entity. */
export function subscribeIsFollowing(
  targetType: FollowTargetType,
  targetId: string,
  cb: (following: boolean) => void,
): Unsubscribe {
  const uid = auth.currentUser?.uid
  if (!uid) {
    cb(false)
    return () => {}
  }
  return onSnapshot(doc(followsCol(), followId(uid, targetType, targetId)), (snap) => cb(snap.exists()))
}

/** Every entity the signed-in user follows, live — powers the "Following" feed filter and
 *  notification opt-in surfaces. Client-filtered like the media-engine subscriptions (low
 *  cardinality per user). */
export function subscribeMyFollows(cb: (follows: Follow[]) => void): Unsubscribe {
  const uid = auth.currentUser?.uid
  if (!uid) {
    cb([])
    return () => {}
  }
  return onSnapshot(followsCol(), (snap) => {
    cb(snap.docs.map((d) => d.data() as Follow).filter((f) => f.followerId === uid))
  })
}

/** Follower count for one entity, live — real count from the `follows` collection, never
 *  simulated. Only practical while an entity's follower count stays in the tens/hundreds
 *  (client-side onSnapshot over the whole collection, filtered) — see note in
 *  `subscribeMatchVideos` for the same convention elsewhere in this codebase. */
export function subscribeFollowerCount(
  targetType: FollowTargetType,
  targetId: string,
  cb: (count: number) => void,
): Unsubscribe {
  return onSnapshot(followsCol(), (snap) => {
    cb(snap.docs.filter((d) => {
      const f = d.data() as Follow
      return f.targetType === targetType && f.targetId === targetId
    }).length)
  })
}
