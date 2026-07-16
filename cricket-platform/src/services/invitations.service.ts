import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import { logAudit } from './audit.service'
import { notify } from './notifications.service'
import { setUserRole } from './users.service'
import type { Invitation, InvitationStatus, Role, UserProfile } from '@/types'

const invitationsCol = () => collection(db, COL.invitations)

const DEFAULT_EXPIRY_DAYS = 7

/** An invitation past its `expiresAt` is treated as expired even if its stored
 *  `status` still says "pending" — there's no backend cron to flip it proactively. */
export function isExpired(inv: Invitation): boolean {
  return inv.status === 'pending' && Date.now() > inv.expiresAt
}

/** The status to actually show/act on — lazily resolves "pending past its expiry" to "expired". */
export function effectiveStatus(inv: Invitation): InvitationStatus {
  return isExpired(inv) ? 'expired' : inv.status
}

export async function createInvitation(
  role: Role,
  invitedUid: string,
  invitedUsername: string,
  message: string | undefined,
  expiryDays: number,
  actor: UserProfile,
): Promise<string> {
  const code = genId('inv_')
  const now = Date.now()
  const invitation: Invitation = {
    id: code,
    code,
    role,
    invitedUid,
    invitedUsername,
    message: message?.trim() || undefined,
    status: 'pending',
    createdBy: actor.id,
    createdByName: actor.displayName || actor.username,
    createdAt: now,
    expiresAt: now + (expiryDays || DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000,
    respondedAt: null,
  }
  await setDoc(doc(invitationsCol(), code), pruneUndefined(invitation))
  await notify(
    invitedUid,
    'account',
    'Invitation received',
    `${actor.displayName || actor.username} invited you to become a ${role.replace('_', ' ').toLowerCase()}.`,
    `/invite/${code}`,
  )
  await logAudit(actor, 'invitation.create', `Invited ${invitedUsername} as ${role}`)
  return code
}

export async function listInvitations(): Promise<Invitation[]> {
  const snap = await getDocs(invitationsCol())
  return snap.docs
    .map((d) => d.data() as Invitation)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function listInvitationsForUser(uid: string): Promise<Invitation[]> {
  const snap = await getDocs(query(invitationsCol(), where('invitedUid', '==', uid)))
  return snap.docs
    .map((d) => d.data() as Invitation)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getInvitation(code: string): Promise<Invitation | null> {
  const snap = await getDoc(doc(invitationsCol(), code))
  return snap.exists() ? (snap.data() as Invitation) : null
}

export async function cancelInvitation(inv: Invitation, actor: UserProfile | null): Promise<void> {
  await updateDoc(doc(invitationsCol(), inv.id), { status: 'cancelled', respondedAt: Date.now() })
  await logAudit(actor, 'invitation.cancel', `Cancelled invitation for ${inv.invitedUsername}`)
}

/** Extends the expiry and resets an expired/declined/cancelled invite back to pending. */
export async function resendInvitation(inv: Invitation, actor: UserProfile, expiryDays = DEFAULT_EXPIRY_DAYS): Promise<void> {
  await updateDoc(doc(invitationsCol(), inv.id), {
    status: 'pending',
    expiresAt: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
    respondedAt: null,
  })
  await notify(
    inv.invitedUid,
    'account',
    'Invitation received',
    `${actor.displayName || actor.username} invited you to become a ${inv.role.replace('_', ' ').toLowerCase()}.`,
    `/invite/${inv.code}`,
  )
  await logAudit(actor, 'invitation.resend', `Resent invitation for ${inv.invitedUsername}`)
}

export async function acceptInvitation(inv: Invitation, actor: UserProfile): Promise<void> {
  await updateDoc(doc(invitationsCol(), inv.id), { status: 'accepted', respondedAt: Date.now() })
  await setUserRole(inv.invitedUid, inv.role)
  await notify(
    inv.createdBy,
    'account',
    'Invitation accepted',
    `${actor.displayName || actor.username} accepted your invitation and is now a ${inv.role.replace('_', ' ').toLowerCase()}.`,
  )
  await logAudit(actor, 'invitation.accept', `Accepted invitation as ${inv.role}`)
}

export async function declineInvitation(inv: Invitation, actor: UserProfile): Promise<void> {
  await updateDoc(doc(invitationsCol(), inv.id), { status: 'declined', respondedAt: Date.now() })
  await notify(
    inv.createdBy,
    'account',
    'Invitation declined',
    `${actor.displayName || actor.username} declined your invitation to become a ${inv.role.replace('_', ' ').toLowerCase()}.`,
  )
  await logAudit(actor, 'invitation.decline', `Declined invitation for role ${inv.role}`)
}
