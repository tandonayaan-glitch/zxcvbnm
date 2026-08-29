import { useAsync } from './useAsync'
import { getSubscription } from '@/services/subscriptions.service'
import { effectiveTier, hasEntitlement, masterAdminSubscription } from '@/domain/entitlements'
import { useAuthStore, isMasterAdmin } from '@/store/authStore'
import type { PlanTier, Subscription } from '@/types'

/** The signed-in user's subscription doc (or `null` — most users never have one, meaning free
 *  tier) plus the loading state, so callers like `<PremiumGate>` can avoid flashing an upsell
 *  before the initial fetch resolves. Signed-out users are always free tier, no fetch needed.
 *
 *  The master admin is a special case handled here, once, for the whole app: they get a synthetic
 *  always-premium subscription (`masterAdminSubscription()`) without any Firestore doc, so every
 *  `usePremiumFeature`/`<PremiumGate>` downstream resolves to entitled. This is the single
 *  authoritative "master admin has every paid feature" rule — do not re-implement it per feature.
 *  `source` tells admin surfaces where the access came from: 'comp' (role), 'manual' (admin grant),
 *  'mock' (simulated checkout), or 'none' (free). */
export function useMySubscription() {
  const profile = useAuthStore((s) => s.profile)
  const uid = profile?.id ?? null
  const master = isMasterAdmin(profile)
  const sub = useAsync(
    () => (uid && !master ? getSubscription(uid) : Promise.resolve(null)),
    [uid, master],
  )

  const subscription: Subscription | null = master
    ? masterAdminSubscription(uid ?? 'master')
    : (sub.data ?? null)
  const tier: PlanTier = effectiveTier(subscription)
  const source: 'comp' | 'manual' | 'mock' | 'none' =
    subscription && subscription.status === 'active'
      ? subscription.provider === 'comp'
        ? 'comp'
        : subscription.provider === 'manual'
          ? 'manual'
          : 'mock'
      : 'none'

  return { subscription, tier, source, loading: master ? false : uid ? sub.loading : false }
}

/** Whether the current user is entitled to the named premium feature. An unregistered key (the
 *  common case today — `PREMIUM_FEATURES` starts empty) is always `true`, so wiring `<PremiumGate>`
 *  around a feature ahead of the product decision to actually charge for it is harmless. The
 *  master admin is always entitled (see `useMySubscription`). */
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
