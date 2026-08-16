import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit as fbLimit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { AuditLog, UserProfile } from '@/types'

/** Record a privileged action. Best-effort — never throws into the caller.
 *  Pass `before`/`after` when the action changed a single field (a role, a status, a flag) —
 *  omit them for actions with no single before/after value. `userAgent` is captured
 *  automatically; there's no IP address (see `AuditLog`'s doc comment for why). */
export async function logAudit(
  actor: UserProfile | null,
  action: string,
  details?: string,
  change?: { before?: AuditLog['before']; after?: AuditLog['after'] },
): Promise<void> {
  if (!actor) return
  try {
    const id = genId('aud_')
    const entry: AuditLog = pruneUndefined({
      id,
      action,
      details: details ?? '',
      before: change?.before,
      after: change?.after,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      actorId: actor.id,
      actorName: actor.displayName || actor.username,
      actorRole: actor.role,
      createdAt: Date.now(),
    })
    await setDoc(doc(db, COL.auditLogs, id), entry)
  } catch (e) {
    console.error('audit log failed', e)
  }
}

export async function listAuditLogs(max = 100): Promise<AuditLog[]> {
  const q = query(
    collection(db, COL.auditLogs),
    orderBy('createdAt', 'desc'),
    fbLimit(max),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as AuditLog)
}

// A `where('actorId', ...)` + `orderBy('createdAt')` pair would need a composite index this
// project doesn't ship, so — same pattern as `notifications.service.ts`'s `listNotifications` —
// this reads a where-only, generously capped batch and sorts/slices client-side instead.
const MY_LOGS_READ_CAP = 500

/** A user's own audit trail (logins, role changes, trash actions, etc.), newest first — the
 *  "Recent activity" section on the Account Settings page. Firestore's `auditLogs` read rule
 *  scopes this to entries where `actorId` matches the caller, same as `notifications`. */
export async function listMyAuditLogs(uid: string, max = 20): Promise<AuditLog[]> {
  const q = query(
    collection(db, COL.auditLogs),
    where('actorId', '==', uid),
    fbLimit(MY_LOGS_READ_CAP),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => d.data() as AuditLog)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max)
}
