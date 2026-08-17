import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { usePremiumFeature } from '@/hooks/useMySubscription'
import { getPremiumFeature } from '@/domain/entitlements'
import { Card, CardBody } from '@/components/ui/primitives'

/**
 * Wraps a feature that may require a premium plan (ROADMAP_V5 Slice C3). Renders `children` if the
 * user is entitled — which today means *always*, for any `feature` key not yet registered in
 * `domain/entitlements.ts`'s `PREMIUM_FEATURES` (still empty; no feature is gated yet, that's a
 * separate product decision). Once a key is registered, a non-entitled user sees `fallback` (a
 * small upsell card by default) in its place instead.
 */
export function PremiumGate({
  feature,
  fallback,
  children,
}: {
  feature: string
  fallback?: ReactNode
  children: ReactNode
}) {
  const entitled = usePremiumFeature(feature)
  if (entitled) return <>{children}</>
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
