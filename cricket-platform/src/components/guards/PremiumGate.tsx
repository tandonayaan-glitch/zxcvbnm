import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { usePremiumFeature, useSubscriptionFor } from '@/hooks/useMySubscription'
import { getPremiumFeature, hasEntitlement } from '@/domain/entitlements'
import { useAuthStore, isMasterAdmin } from '@/store/authStore'
import { Card, CardBody } from '@/components/ui/primitives'

/**
 * Wraps a feature that may require a premium plan (ROADMAP_V5 Slice C3). Renders `children` if
 * entitled — which is *always* true for a `feature` key not registered in `domain/entitlements.ts`'s
 * `PREMIUM_FEATURES`. Once a key is registered, a non-entitled viewer sees `fallback` (a small
 * upsell card by default) instead.
 *
 * By default entitlement is checked against the *current viewer's own* plan — right for things a
 * viewer personally unlocks (analytics, exports, tools). Pass `ownerId` for content whose premium
 * status should instead follow whoever *owns* it (a tournament's sponsors/branding/media, a club's
 * activity feed) — a free visitor must still see a paying owner's content, not lose it because the
 * visitor themselves isn't subscribed. While an owner's subscription is still loading, nothing
 * renders (not even `fallback`) rather than flashing an upsell that then disappears.
 */
export function PremiumGate({
  feature,
  ownerId,
  fallback,
  children,
}: {
  feature: string
  ownerId?: string
  fallback?: ReactNode
  children: ReactNode
}) {
  const selfEntitled = usePremiumFeature(feature)
  const owner = useSubscriptionFor(ownerId)
  // The master admin is never gated — mirrors `useMySubscription`'s central bypass for the
  // `ownerId` branch, which checks the content owner's plan rather than the viewer's.
  const viewerIsMaster = isMasterAdmin(useAuthStore((s) => s.profile))

  if (viewerIsMaster) return <>{children}</>

  if (ownerId) {
    if (owner.loading) return null
    if (hasEntitlement(owner.subscription, feature)) return <>{children}</>
  } else if (selfEntitled) {
    return <>{children}</>
  }

  if (fallback !== undefined) return <>{fallback}</>

  const def = getPremiumFeature(feature)
  return (
    <Card className="border-dashed">
      <CardBody className="flex items-center justify-center gap-3 py-6 text-center">
        <Lock size={18} className="text-ink-400 dark:text-ink-500" />
        <div>
          <div className="text-sm font-medium text-ink-800 dark:text-ink-200">
            {def?.name ?? 'Premium feature'}
          </div>
          <div className="text-xs text-ink-500 dark:text-ink-400">
            {def?.description ?? 'This requires a premium plan.'}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
