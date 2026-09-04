import { collection, doc, setDoc, deleteDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import type { Rating, RatingTargetType } from '@/types'

function ratingsCol() {
  return collection(db, COL.ratings)
}

function ratingDocId(targetType: RatingTargetType, targetId: string, raterId: string): string {
  return `${targetType}_${targetId}_${raterId}`
}

/** Creates or overwrites the signed-in user's own rating for one target. Firestore rules are the
 *  real enforcement of "one rating per rater, no self-rating" — this just builds the doc id the
 *  rules expect. */
export async function rate(
  targetType: RatingTargetType,
  targetId: string,
  stars: 1 | 2 | 3 | 4 | 5,
  comment?: string,
): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in to rate.')
  const id = ratingDocId(targetType, targetId, uid)
  const now = Date.now()
  const rating: Rating = {
    id,
    targetType,
    targetId,
    raterId: uid,
    stars,
    comment,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(doc(ratingsCol(), id), pruneUndefined(rating), { merge: true })
}

export async function removeMyRating(targetType: RatingTargetType, targetId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await deleteDoc(doc(ratingsCol(), ratingDocId(targetType, targetId, uid)))
}

/** All ratings for one target, live. Low cardinality per target (amateur/semi-pro platform), so
 *  a client-side filter over the whole collection is fine — same convention as
 *  `subscribeMatchVideos`/`subscribeClips`. */
export function subscribeRatingsFor(
  targetType: RatingTargetType,
  targetId: string,
  cb: (ratings: Rating[]) => void,
): Unsubscribe {
  return onSnapshot(ratingsCol(), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as Rating)
        .filter((r) => r.targetType === targetType && r.targetId === targetId),
    )
  })
}
