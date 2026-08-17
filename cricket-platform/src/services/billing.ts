import { mockBillingProvider } from './mockBilling.service'
import type { BillingProvider } from './billing.types'

/**
 * The active billing backend. Call sites should import `getBillingProvider()` rather than
 * `mockBillingProvider` directly, so connecting a real provider later (ROADMAP_V5 Phase C, not yet
 * scheduled — needs the user's provider choice first) is a one-line change here instead of a
 * find-and-replace across every caller.
 */
export function getBillingProvider(): BillingProvider {
  return mockBillingProvider
}
