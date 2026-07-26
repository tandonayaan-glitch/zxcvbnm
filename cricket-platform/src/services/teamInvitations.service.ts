import { collection, doc, deleteDoc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import { logAudit } from './audit.service'
import { notify } from './notifications.service'
import { listPlayers, createPlayer, updatePlayer } from './players.service'
import { getTeam, updateTeam } from './teams.service'
import type { TeamInvitation, TeamInvitationStatus, UserProfile } from '@/types'

const teamInvitationsCol = () => collection(db, COL.teamInvitations)

/** See `collections.ts` for why this internal grant doc exists — same pattern as
 *  `invitationRoleGrants`, scoped to team-roster joins instead of role elevation. */
const teamGrantRef = (invitedUid: string) => doc(db, COL.teamInvitationGrants, invitedUid)

const DEFAULT_EXPIRY_DAYS = 7

/** A team invitation past its `expiresAt` is treated as expired even if its stored
 *  `status` still says "pending" — there's no backend cron to flip it proactively. */
export function isExpired(inv: TeamInvitation): boolean {
  return inv.status === 'pending' && Date.now() > inv.expiresAt
}

export function effectiveStatus(inv: TeamInvitation): TeamInvitationStatus {
  return isExpired(inv) ? 'expired' : inv.status
}

export async function createTeamInvitation(
  teamId: string,
  teamName: string,
  invitedUid: string,
  invitedUsername: string,
  message: string | undefined,
  expiryDays: number,
  actor: UserProfile,
): Promise<string> {
  const code = genId('tinv_')
  const now = Date.now()
  const expiresAt = now + (expiryDays || DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000
  const invitation: TeamInvitation = {
    id: code,
    code,
    teamId,
    teamName,
    invitedUid,
    invitedUsername,
    message: message?.trim() || undefined,
    status: 'pending',
    createdBy: actor.id,
    createdByName: actor.displayName || actor.username,
    createdAt: now,
    expiresAt,
    respondedAt: null,
  }
  await setDoc(doc(teamInvitationsCol(), code), pruneUndefined(invitation))
  await setDoc(teamGrantRef(invitedUid), { teamId, expiresAt })
  await notify(
    invitedUid,
    'account',
    'Team invitation received',
    `${actor.displayName || actor.username} invited you to join ${teamName}.`,
    `/team-invite/${code}`,
  )
  await logAudit(actor, 'teamInvitation.create', `Invited ${invitedUsername} to join ${teamName}`)
  return code
}

export async function listTeamInvitationsForTeam(teamId: string): Promise<TeamInvitation[]> {
  const snap = await getDocs(query(teamInvitationsCol(), where('teamId', '==', teamId)))
  return snap.docs.map((d) => d.data() as TeamInvitation).sort((a, b) => b.createdAt - a.createdAt)
}

export async function getTeamInvitation(code: string): Promise<TeamInvitation | null> {
  const snap = await getDoc(doc(teamInvitationsCol(), code))
  return snap.exists() ? (snap.data() as TeamInvitation) : null
}

export async function cancelTeamInvitation(inv: TeamInvitation, actor: UserProfile | null): Promise<void> {
  await deleteDoc(teamGrantRef(inv.invitedUid))
  await updateDoc(doc(teamInvitationsCol(), inv.id), { status: 'cancelled', respondedAt: Date.now() })
  await logAudit(actor, 'teamInvitation.cancel', `Cancelled team invitation for ${inv.invitedUsername}`)
}

/** Extends the expiry and resets an expired/declined/cancelled invite back to pending. */
export async function resendTeamInvitation(
  inv: TeamInvitation,
  actor: UserProfile,
  expiryDays = DEFAULT_EXPIRY_DAYS,
): Promise<void> {
  const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000
  await setDoc(teamGrantRef(inv.invitedUid), { teamId: inv.teamId, expiresAt })
  await updateDoc(doc(teamInvitationsCol(), inv.id), {
    status: 'pending',
    expiresAt,
    respondedAt: null,
  })
  await notify(
    inv.invitedUid,
    'account',
    'Team invitation received',
    `${actor.displayName || actor.username} invited you to join ${inv.teamName}.`,
    `/team-invite/${inv.code}`,
  )
  await logAudit(actor, 'teamInvitation.resend', `Resent team invitation for ${inv.invitedUsername}`)
}

export async function acceptTeamInvitation(inv: TeamInvitation, actor: UserProfile): Promise<void> {
  const team = await getTeam(inv.teamId)
  if (!team) throw new Error('This team no longer exists.')

  // Reuse the invitee's existing linked player if they already have one, rather than creating a
  // second Player doc for the same person.
  const players = await listPlayers()
  const existing = players.find((p) => p.linkedUserId === actor.id)

  let playerId: string
  if (existing) {
    playerId = existing.id
    if (!existing.teamIds.includes(inv.teamId)) {
      // Order matters: this self-update is only permitted by firestore.rules while the grant
      // doc still exists, so it must happen before the grant is deleted below.
      await updatePlayer(existing.id, { teamIds: [...existing.teamIds, inv.teamId] })
    }
  } else {
    playerId = await createPlayer({
      fullName: actor.displayName,
      displayName: actor.displayName,
      role: 'batter',
      battingStyle: 'right_hand',
      bowlingStyle: 'none',
      teamIds: [inv.teamId],
      photoURL: actor.photoURL ?? null,
      active: true,
      linkedUserId: actor.id,
      ownerId: team.ownerId,
    })
  }

  if (!team.playerIds.includes(playerId)) {
    await updateTeam(inv.teamId, { playerIds: [...team.playerIds, playerId] })
  }

  await deleteDoc(teamGrantRef(inv.invitedUid))
  await updateDoc(doc(teamInvitationsCol(), inv.id), { status: 'accepted', respondedAt: Date.now() })
  await notify(
    inv.createdBy,
    'account',
    'Team invitation accepted',
    `${actor.displayName || actor.username} accepted your invitation and joined ${inv.teamName}.`,
  )
  await logAudit(actor, 'teamInvitation.accept', `Joined ${inv.teamName}`)
}

export async function declineTeamInvitation(inv: TeamInvitation, actor: UserProfile): Promise<void> {
  await deleteDoc(teamGrantRef(inv.invitedUid))
  await updateDoc(doc(teamInvitationsCol(), inv.id), { status: 'declined', respondedAt: Date.now() })
  await notify(
    inv.createdBy,
    'account',
    'Team invitation declined',
    `${actor.displayName || actor.username} declined your invitation to join ${inv.teamName}.`,
  )
  await logAudit(actor, 'teamInvitation.decline', `Declined invitation to join ${inv.teamName}`)
}
