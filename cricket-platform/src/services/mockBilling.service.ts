import { getSubscription, upsertSubscription } from './subscriptions.service'
import type { BillingProvider } from './billing.types'
import type { PlanTier, Subscription } from '@/types'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Demo/no-op billing backend (ROADMAP_V5 Slice C2). "Checkout" never charges anything or talks to
 * any payment network — it just writes a `Subscription` doc directly, simulating an instantly-
 * successful purchase. This exists so the subscription/entitlement architecture (C1) and the
 * premium-gating mechanism (C3) can be built and exercised end-to-end before a real payment
 * provider is chosen and connected — see billing.types.ts's own doc comment for what that would
 * take. Every UI surface that calls this must make clear to the user that no real payment is
 * happening; this module itself has no way to enforce that.
 */
export const mockBillingProvider: BillingProvider = {
  id: 'mock',

  async startCheckout(uid: string, tier: PlanTier): Promise<Subscription> {
    const now = Date.now()
    const existing = await getSubscription(uid)
    const sub: Subscription = {
      uid,
      tier,
      status: 'active',
      provider: 'mock',
      currentPeriodEnd: now + THIRTY_DAYS_MS,
      cancelAtPeriodEnd: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await upsertSubscription(sub)
    return sub
  },

  async cancelSubscription(uid: string): Promise<Subscription | null> {
    const existing = await getSubscription(uid)
    if (!existing || existing.status !== 'active') return existing
    const sub: Subscription = { ...existing, status: 'canceled', updatedAt: Date.now() }
    await upsertSubscription(sub)
    return sub
  },
}
