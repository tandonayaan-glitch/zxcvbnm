import type { PlanTier, PremiumFeatureDef, Subscription } from '@/types'

/**
 * Feature registry for premium gating (ROADMAP_V5 Slice C3). Deliberately empty — no existing
 * feature is locked behind premium yet. Which features become premium is a product decision the
 * user makes separately; this registry is where that decision gets recorded once made. Until then,
 * `hasEntitlement()` returns `true` for every key (nothing to gate against), so wiring `<PremiumGate>`
 * around a feature ahead of time is harmless — it just won't do anything until the feature is added
 * here.
 */
export const PREMIUM_FEATURES: PremiumFeatureDef[] = []

export function getPremiumFeature(key: string): PremiumFeatureDef | undefined {
  return PREMIUM_FEATURES.find((f) => f.key === key)
}

/** The plan a subscription actually grants right now. A canceled/past-due/missing subscription
 *  always resolves to 'free', regardless of what `tier` says — `tier` records what was purchased,
 *  `status` records whether that purchase is currently in force. */
export function effectiveTier(sub: Subscription | null | undefined): PlanTier {
  if (!sub) return 'free'
  if (sub.status !== 'active') return 'free'
  return sub.tier
}

/**
 * Whether `sub` grants access to the feature registered under `featureKey`. An unregistered key
 * (the common case today, since `PREMIUM_FEATURES` starts empty) always returns `true` — there's
 * nothing to gate against yet, so a `<PremiumGate>` placed around a not-yet-registered feature is a
 * no-op rather than an accidental lockout.
 */
export function hasEntitlement(
  sub: Subscription | null | undefined,
  featureKey: string,
): boolean {
  if (!getPremiumFeature(featureKey)) return true
  return effectiveTier(sub) === 'premium'
}
