import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { logAudit } from './audit.service'
import type { PlanTier, Subscription, UserProfile } from '@/types'

const subsCol = () => collection(db, COL.subscriptions)

/** A user's subscription doc, or `null` if they've never had one (the common case — treat as
 *  the 'free' tier via `domain/entitlements.ts`'s `effectiveTier()`, don't assume a doc exists). */
export async function getSubscription(uid: string): Promise<Subscription | null> {
  const snap = await getDoc(doc(subsCol(), uid))
  return snap.exists() ? (snap.data() as Subscription) : null
}

/** Every subscription doc that exists — for admin-facing views. Most users will never appear here
 *  (no doc == free tier), so this is not the same as "every user." */
export async function listSubscriptions(): Promise<Subscription[]> {
  const snap = await getDocs(subsCol())
  return snap.docs
    .map((d) => d.data() as Subscription)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Low-level upsert — the primitive billing providers write through (see billing.types.ts) and
 *  the two admin actions below build on. Prefer `grantSubscription`/`revokeSubscription` for admin
 *  actions so there's always an audit entry; a billing provider's own checkout/cancel flow is its
 *  own record of "why", so it calls this directly instead. */
export async function upsertSubscription(sub: Subscription): Promise<void> {
  await setDoc(doc(subsCol(), sub.uid), pruneUndefined(sub))
}

/** Master-admin manual grant (comping access) — bypasses billing entirely, same shape a real
 *  provider's webhook would eventually write, but attributed to an admin action instead. */
export async function grantSubscription(
  uid: string,
  tier: PlanTier,
  actor: UserProfile | null,
): Promise<void> {
  const now = Date.now()
  const existing = await getSubscription(uid)
  const sub: Subscription = {
    uid,
    tier,
    status: 'active',
    provider: 'mock',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await upsertSubscription(sub)
  await logAudit(actor, 'subscription.grant', `${uid} → ${tier}`, {
    before: existing?.tier ?? 'free',
    after: tier,
  })
}

/** Master-admin manual revoke — same shape a cancellation would leave behind. */
export async function revokeSubscription(
  uid: string,
  actor: UserProfile | null,
): Promise<void> {
  const existing = await getSubscription(uid)
  if (!existing) return
  const sub: Subscription = { ...existing, status: 'canceled', updatedAt: Date.now() }
  await upsertSubscription(sub)
  await logAudit(actor, 'subscription.revoke', uid, {
    before: existing.status,
    after: 'canceled',
  })
}
