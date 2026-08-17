import { useAsync } from './useAsync'
import { getSubscription } from '@/services/subscriptions.service'
import { effectiveTier, hasEntitlement } from '@/domain/entitlements'
import { useAuthStore } from '@/store/authStore'
import type { PlanTier } from '@/types'

/** The signed-in user's subscription doc (or `null` — most users never have one, meaning free
 *  tier) plus the loading state, so callers like `<PremiumGate>` can avoid flashing an upsell
 *  before the initial fetch resolves. Signed-out users are always free tier, no fetch needed. */
export function useMySubscription() {
  const uid = useAuthStore((s) => s.profile?.id ?? null)
  const sub = useAsync(() => (uid ? getSubscription(uid) : Promise.resolve(null)), [uid])
  const tier: PlanTier = effectiveTier(sub.data)
  return { subscription: sub.data ?? null, tier, loading: uid ? sub.loading : false }
}

/** Whether the current user is entitled to the named premium feature. An unregistered key (the
 *  common case today — `PREMIUM_FEATURES` starts empty) is always `true`, so wiring `<PremiumGate>`
 *  around a feature ahead of the product decision to actually charge for it is harmless. */
export function usePremiumFeature(key: string): boolean {
  const { subscription } = useMySubscription()
  return hasEntitlement(subscription, key)
}
