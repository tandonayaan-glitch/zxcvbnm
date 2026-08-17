import type { BillingProviderId, PlanTier, Subscription } from '@/types'

/**
 * Provider-independent billing interface (ROADMAP_V5 Slice C2). No real payment provider is
 * connected in this codebase — `MockBillingProvider` (mockBilling.service.ts) is the only
 * implementation that exists, and it never moves real money; it just writes a `Subscription` doc
 * directly. Wiring up a real provider (Stripe, Razorpay, etc. — an explicit later decision, not
 * made here) means adding a second class implementing this same interface, plus a trusted server
 * context for its webhooks, which this project doesn't have yet (no Cloud Functions / backend).
 *
 * Every method is keyed by `uid`, not a provider-specific customer id — callers never need to know
 * which provider is behind the interface.
 */
export interface BillingProvider {
  id: BillingProviderId

  /** Starts a checkout for `tier` and returns the resulting subscription once "purchased". A real
   *  provider would instead return a redirect URL/client secret and only resolve the subscription
   *  later via webhook; the mock resolves immediately since nothing is actually being charged. */
  startCheckout(uid: string, tier: PlanTier): Promise<Subscription>

  /** Cancels `uid`'s active subscription (status → 'canceled'; the record itself is kept, not
   *  deleted, for history). No-op if they have no active subscription. */
  cancelSubscription(uid: string): Promise<Subscription | null>
}
