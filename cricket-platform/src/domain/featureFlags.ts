import type { FeatureFlag } from '@/types'

/** Deterministic 0-99 "bucket" for a user+flag pair, so the same user always lands on the same
 *  side of a gradual rollout instead of flipping randomly on every render/reload. */
function bucketFor(uid: string, key: string): number {
  const s = `${key}:${uid}`
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 100
}

/**
 * Whether `flag` is on for this user. `uid` of `null` (signed out) always evaluates to the
 * flag's base `enabled`/`rolloutPercent` state at bucket 0 — i.e. only flags at 100% rollout
 * (and not beta-only) reach signed-out viewers, which matters for public-site gating.
 */
export function isFlagEnabledFor(
  flag: FeatureFlag,
  ctx: { uid: string | null; betaOptIn: boolean },
): boolean {
  if (!flag.enabled) return false
  if (flag.betaOnly && !ctx.betaOptIn) return false
  if (flag.rolloutPercent >= 100) return true
  if (flag.rolloutPercent <= 0) return false
  const bucket = bucketFor(ctx.uid ?? 'anonymous', flag.key)
  return bucket < flag.rolloutPercent
}
