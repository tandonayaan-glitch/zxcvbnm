import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { pruneUndefined } from '@/lib/collections'
import { notify } from './notifications.service'
import type { Role, UserProfile, UserStatus } from '@/types'

const ROLE_LABELS: Record<Role, string> = {
  MASTER_ADMIN: 'Master Admin',
  ADMIN: 'Admin',
  SCORER: 'Scorer',
  VIEWER: 'Viewer',
  TEAM_MANAGER: 'Team Manager',
  TOURNAMENT_MANAGER: 'Tournament Manager',
}

export async function listUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(collection(db, COL.users), orderBy('createdAt', 'desc')),
  )
  // Fall back to the doc's own key for `id` — some legacy docs predate the
  // field being stored, which otherwise breaks every id-keyed action below.
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as UserProfile)
}

export async function setUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, COL.users, uid), { role, updatedAt: Date.now() })
}

/** Like `setUserRole`, but also notifies the user — for direct admin-driven role
 * changes (Users & Roles page). Not used by the admin-request approval flow,
 * which already sends its own more specific "request approved" notification. */
export async function setUserRoleNotified(uid: string, role: Role): Promise<void> {
  await setUserRole(uid, role)
  await notify(
    uid,
    'security',
    'Your role changed',
    `You're now a ${ROLE_LABELS[role]} on CricketHub.`,
    '/settings',
  )
}

export interface ProfileUpdate {
  displayName?: string
  bio?: string
  photoURL?: string | null
  email?: string
}

/** Update the user's own editable profile fields. */
export async function updateUserProfile(
  uid: string,
  patch: ProfileUpdate,
): Promise<void> {
  await updateDoc(
    doc(db, COL.users, uid),
    pruneUndefined({ ...patch, updatedAt: Date.now() }),
  )
}

export async function setUserStatus(
  uid: string,
  status: UserStatus,
): Promise<void> {
  await updateDoc(doc(db, COL.users, uid), {
    status,
    bannedAt: status === 'banned' ? Date.now() : null,
    updatedAt: Date.now(),
  })
  if (status === 'banned') {
    await notify(uid, 'security', 'Account suspended', 'Your account access was suspended by an administrator.')
  } else if (status === 'active') {
    await notify(uid, 'security', 'Account reinstated', 'Your account access was restored.', '/dashboard')
  }
}
