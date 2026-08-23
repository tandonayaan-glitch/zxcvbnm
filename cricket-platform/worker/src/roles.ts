import type { Env } from './types'
import { getPublicDoc } from './firestore'

/** Mirrors `firestore.rules`' `canManageMedia()` and `storage.rules`' role list exactly —
 *  the same set of roles that could already write media before this migration. */
const MEDIA_MANAGER_ROLES = new Set(['MASTER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'TOURNAMENT_MANAGER', 'SCORER'])

/** `/users/{uid}` is `allow read: if true` in firestore.rules — this is a public,
 *  unauthenticated lookup, not a privileged one. */
export async function getCallerRole(env: Env, uid: string): Promise<string | null> {
  const doc = await getPublicDoc(env.FIREBASE_PROJECT_ID, `users/${uid}`)
  if (!doc) return null
  return typeof doc.role === 'string' ? doc.role : null
}

/**
 * Mirrors `storage.rules`' `canManageMedia()` precisely: every folder needs a content-
 * management-capable role, EXCEPT `users/`, where any signed-in user may write — matching
 * the existing "own avatar" convention exactly (not ownership-checked there today either;
 * preserved as-is here, not newly tightened or loosened).
 */
export function canWriteFolder(role: string | null, folderOrKey: string): boolean {
  if (folderOrKey === 'users' || folderOrKey.startsWith('users/')) return role !== null
  return role !== null && MEDIA_MANAGER_ROLES.has(role)
}
