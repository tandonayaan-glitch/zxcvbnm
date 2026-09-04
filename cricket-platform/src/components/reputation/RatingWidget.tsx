import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { subscribeRatingsFor, rate } from '@/services/ratings.service'
import { summarizeRatings, myRating } from '@/domain/reputation'
import type { Rating, RatingTargetType } from '@/types'

/** Star rating + reputation summary for a player/scorer/umpire. Anti-manipulation is enforced by
 *  `firestore.rules` (one rating per rater per target, no self-rating) — this component just
 *  reflects what the backend actually allows, never fakes an average. */
export function RatingWidget({
  targetType,
  targetId,
  linkedUserId,
}: {
  targetType: RatingTargetType
  targetId: string
  /** The account this target maps to, if any — used only to hide the "rate" control from the
   *  person being rated (belt-and-suspenders on top of the server-side check). */
  linkedUserId?: string | null
}) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [hover, setHover] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeRatingsFor(targetType, targetId, setRatings), [targetType, targetId])

  const summary = summarizeRatings(ratings, targetType, targetId)
  const mine = profile ? myRating(ratings, profile.id, targetType, targetId) : null
  const isSelf = profile && linkedUserId && profile.id === linkedUserId

  async function submit(stars: 1 | 2 | 3 | 4 | 5) {
    if (!profile) {
      toast.error('Sign in to rate.')
      return
    }
    setBusy(true)
    try {
      await rate(targetType, targetId, stars)
      toast.success('Thanks for your rating.')
    } catch {
      toast.error('Could not save your rating.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {summary.count > 0 ? (
          <>
            <Star size={16} className="fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">
              {summary.average.toFixed(1)}
            </span>
            <span className="text-xs text-ink-500 dark:text-ink-400">
              ({summary.count} rating{summary.count === 1 ? '' : 's'})
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-400">No ratings yet</span>
        )}
      </div>
      {profile && !isSelf && (
        <div className="flex items-center gap-0.5">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              disabled={busy}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => submit(n)}
              aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
              className="p-0.5 disabled:opacity-50"
            >
              <Star
                size={16}
                className={
                  (hover || mine?.stars || 0) >= n
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-ink-300 dark:text-ink-600'
                }
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
