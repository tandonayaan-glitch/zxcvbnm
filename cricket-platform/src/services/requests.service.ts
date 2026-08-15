import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { setUserRole } from './users.service'
import { notify } from './notifications.service'
import type { AdminRequest, UserProfile } from '@/types'

const reqCol = () => collection(db, COL.adminRequests)

/** Submit (or re-submit) an admin request. Doc id = uid so one request/user. */
export async function createAdminRequest(
  profile: UserProfile,
  input: { tournamentName: string; message?: string },
): Promise<void> {
  const now = Date.now()
  const data: AdminRequest = {
    id: profile.id,
    uid: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    tournamentName: input.tournamentName.trim(),
    message: input.message?.trim() || '',
    status: 'pending',
    createdAt: now,
    decidedAt: null,
    decidedBy: null,
  }
  await setDoc(doc(reqCol(), profile.id), data)
}

export async function getMyRequest(uid: string): Promise<AdminRequest | null> {
  const snap = await getDoc(doc(reqCol(), uid))
  return snap.exists() ? (snap.data() as AdminRequest) : null
}

export async function listRequests(): Promise<AdminRequest[]> {
  const snap = await getDocs(query(reqCol(), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => d.data() as AdminRequest)
}

export async function listPendingRequests(): Promise<AdminRequest[]> {
  const snap = await getDocs(query(reqCol(), where('status', '==', 'pending')))
  return snap.docs
    .map((d) => d.data() as AdminRequest)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Approve: promote the user to TOURNAMENT_MANAGER (scoped to running their own
 *  tournament, matching what the request form actually asks for) and mark the
 *  request approved. */
export async function approveRequest(
  req: AdminRequest,
  masterUid: string,
): Promise<void> {
  await setUserRole(req.uid, 'TOURNAMENT_MANAGER')
  await updateDoc(doc(reqCol(), req.id), {
    status: 'approved',
    decidedAt: Date.now(),
    decidedBy: masterUid,
  })
  await notify(
    req.uid,
    'account',
    'Admin request approved',
    `You're now the tournament manager for "${req.tournamentName}".`,
    '/dashboard',
  )
}

export async function rejectRequest(
  req: AdminRequest,
  masterUid: string,
): Promise<void> {
  await updateDoc(doc(reqCol(), req.id), {
    status: 'rejected',
    decidedAt: Date.now(),
    decidedBy: masterUid,
  })
  await notify(
    req.uid,
    'account',
    'Admin request declined',
    `Your request for "${req.tournamentName}" was declined.`,
    '/dashboard',
  )
}
