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

/** An arbitrary uid's subscription — for content (a tournament, a match, a club…) whose owner may
 *  differ from whoever is currently viewing it. Some registered features (sponsor showcase,
 *  tournament branding/media/announcements, club activity feeds) are gated on the *content owner's*
 *  plan, not the viewer's: a free visitor should still see a paying owner's sponsors, not lose them
 *  because the visitor themselves isn't subscribed. `<PremiumGate ownerId={...}>` uses this. */
export function useSubscriptionFor(uid: string | null | undefined) {
  const sub = useAsync(() => (uid ? getSubscription(uid) : Promise.resolve(null)), [uid])
  return { subscription: sub.data ?? null, loading: uid ? sub.loading : false }
}
