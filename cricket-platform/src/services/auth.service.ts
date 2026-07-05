/* ==================================================================
 * Auth service — username/password UX on top of Firebase Auth.
 *
 * Guarantees:
 *  - never creates a Firebase Auth user without a Firestore profile
 *    (on profile-write failure the auth user is rolled back)
 *  - usernames are unique (transactional check on usernameLookup)
 *  - first-admin bootstrap is detected from Firestore
 * ================================================================== */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore'
import { auth, db, usernameToEmail } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { MASTER_ADMIN_USERNAME } from '@/lib/constants'
import type { Role, UserProfile } from '@/types'

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function validateUsername(username: string): string | null {
  const u = normalizeUsername(username)
  if (!USERNAME_RE.test(u)) {
    return 'Username must be 3–20 characters: lowercase letters, numbers or underscore.'
  }
  return null
}

/** Does the master admin exist yet? Drives the first-time setup screen. */
export async function masterAdminExists(): Promise<boolean> {
  const q = query(
    collection(db, COL.users),
    where('role', '==', 'MASTER_ADMIN'),
    limit(1),
  )
  const snap = await getDocs(q)
  return !snap.empty
}

/** Back-compat alias used by older callers (setup / login banner). */
export const adminExists = masterAdminExists

export async function isUsernameTaken(username: string): Promise<boolean> {
  const u = normalizeUsername(username)
  const snap = await getDoc(doc(db, COL.usernameLookup, u))
  return snap.exists()
}

export async function loadProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COL.users, uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

interface RegisterInput {
  username: string
  password: string
  displayName: string
  role?: Role // requested role is ignored except for the master bootstrap
}

/**
 * Create an account end-to-end: auth user + profile doc + username lookup.
 * All Firestore writes happen in one transaction; on any failure we delete
 * the freshly-created auth user so we never leave an orphan.
 *
 * Role policy (security): self-registration can ONLY create a VIEWER, except
 * the one-time master-admin bootstrap (reserved username, no master yet).
 * ADMIN / SCORER are granted exclusively by the master admin afterwards.
 */
export async function registerUser(
  input: RegisterInput,
): Promise<UserProfile> {
  const username = normalizeUsername(input.username)

  const usernameErr = validateUsername(username)
  if (usernameErr) throw new Error(usernameErr)
  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }

  // Early, friendly duplicate check (the transaction below is the real guard).
  if (await isUsernameTaken(username)) {
    throw new Error('That username is already taken.')
  }

  // Decide the role: master bootstrap only for the reserved username while no
  // master exists; otherwise always VIEWER regardless of what was requested.
  const isMasterBootstrap =
    username === MASTER_ADMIN_USERNAME && !(await masterAdminExists())
  const role: Role = isMasterBootstrap ? 'MASTER_ADMIN' : 'VIEWER'

  const email = usernameToEmail(username)
  const cred = await createUserWithEmailAndPassword(auth, email, input.password)
  const uid = cred.user.uid
  const now = Date.now()

  const profile: UserProfile = {
    id: uid,
    username,
    displayName: input.displayName.trim() || username,
    role,
    status: 'active',
    bannedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await runTransaction(db, async (tx) => {
      const lookupRef = doc(db, COL.usernameLookup, username)
      const existing = await tx.get(lookupRef)
      if (existing.exists()) {
        throw new Error('That username is already taken.')
      }
      tx.set(doc(db, COL.users, uid), profile)
      tx.set(lookupRef, { uid, username, createdAt: now })
    })
  } catch (err) {
    // Roll back the auth user so we never strand an account without a profile.
    try {
      await deleteUser(cred.user)
    } catch {
      /* best-effort cleanup */
    }
    throw err
  }

  return profile
}

/**
 * Login by username + password. We construct the synthetic email directly
 * from the username (deterministic), then sign in and load the profile.
 */
export async function login(
  username: string,
  password: string,
): Promise<UserProfile> {
  const u = normalizeUsername(username)
  const email = usernameToEmail(u)
  const cred = await signInWithEmailAndPassword(auth, email, password)
  const profile = await loadProfile(cred.user.uid)
  if (profile && profile.status === 'banned') {
    await signOut(auth)
    throw new Error('Your account has been suspended. Contact the administrator.')
  }
  if (!profile) {
    // Should never happen given registration guarantees; self-heal a minimal
    // profile rather than dead-end the user.
    const now = Date.now()
    const fallback: UserProfile = {
      id: cred.user.uid,
      username: u,
      displayName: u,
      role: 'VIEWER',
      status: 'active',
      bannedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(db, COL.users, cred.user.uid), fallback)
    await setDoc(doc(db, COL.usernameLookup, u), {
      uid: cred.user.uid,
      username: u,
      createdAt: now,
    })
    return fallback
  }
  return profile
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

/**
 * Change the signed-in user's password. Re-authenticates with the current
 * password first (Firebase requires recent login for password changes).
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('You must be signed in.')
  if (newPassword.length < 6)
    throw new Error('New password must be at least 6 characters.')
  const cred = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, cred)
  await updatePassword(user, newPassword)
}

/** Subscribe to auth state; loads the Firestore profile (with retry to absorb
 *  the brief window right after signup before the profile write commits). */
export function observeAuth(
  cb: (profile: UserProfile | null, fbUser: FirebaseUser | null) => void,
): () => void {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      cb(null, null)
      return
    }
    let profile = await loadProfile(fbUser.uid)
    for (let i = 0; i < 4 && !profile; i++) {
      await new Promise((r) => setTimeout(r, 250))
      profile = await loadProfile(fbUser.uid)
    }
    // Banned accounts are force signed-out and treated as logged-out.
    if (profile && profile.status === 'banned') {
      await signOut(auth)
      cb(null, null)
      return
    }
    cb(profile, fbUser)
  })
}

/** Friendly messages for common Firebase auth error codes. */
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect username or password.'
    case 'auth/email-already-in-use':
      return 'That username is already taken.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'Firebase configuration looks invalid. Check your .env.local values.'
    default:
      return err instanceof Error ? err.message : 'Something went wrong.'
  }
}
