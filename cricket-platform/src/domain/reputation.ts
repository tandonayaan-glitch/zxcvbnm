/* Pure aggregation over Rating docs — no I/O. See services/ratings.service.ts. */
import type { Rating, ReputationSummary, RatingTargetType } from '@/types'

export function summarizeRatings(
  ratings: Rating[],
  targetType: RatingTargetType,
  targetId: string,
): ReputationSummary {
  const relevant = ratings.filter((r) => r.targetType === targetType && r.targetId === targetId)
  const count = relevant.length
  const average = count > 0 ? relevant.reduce((sum, r) => sum + r.stars, 0) / count : 0
  return { targetType, targetId, count, average: Math.round(average * 10) / 10 }
}

/** The current user's own existing rating for a target, if any — so the UI can show "your
 *  rating" and let them update it rather than only ever adding a new one. */
export function myRating(ratings: Rating[], raterId: string, targetType: RatingTargetType, targetId: string): Rating | null {
  return (
    ratings.find(
      (r) => r.raterId === raterId && r.targetType === targetType && r.targetId === targetId,
    ) ?? null
  )
}
