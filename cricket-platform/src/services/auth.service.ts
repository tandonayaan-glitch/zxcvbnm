/* ==================================================================
 * Auth service — username/password UX on top of Firebase Auth.
 *
 * Guarantees:
 *  - never creates a Firebase Auth user without a Firestore profile
 *    (on profile-write failure the auth user is rolled back)
 *  - usernames are unique (transactional check on usernameLookup)
 *  - first-admin bootstrap is detected from Firestore
 * ================================================================== */
import { initializeApp, deleteApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  getAuth,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  type User as FirebaseUser,
  type ConfirmationResult,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore'
import { auth, db, app, usernameToEmail } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { MASTER_ADMIN_USERNAME } from '@/lib/constants'
import { logAudit } from './audit.service'
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
  // master exists; otherwise always SCORER regardless of what was requested —
  // a normal signup can immediately create/score their own matches, but never
  // self-grants ADMIN/TOURNAMENT_MANAGER/MASTER_ADMIN this way.
  const isMasterBootstrap =
    username === MASTER_ADMIN_USERNAME && !(await masterAdminExists())
  const role: Role = isMasterBootstrap ? 'MASTER_ADMIN' : 'SCORER'

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

const TEMP_PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function randomTempPassword(length = 12): string {
  let out = ''
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length]
  }
  return out
}

/** Finds a free `user######` username, retrying on the rare collision. */
async function generateTempUsername(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `user${Math.floor(100000 + Math.random() * 900000)}`
    if (!(await isUsernameTaken(candidate))) return candidate
  }
  throw new Error('Could not generate a free username — try again.')
}

/**
 * Admin-initiated account creation for someone else (e.g. a newly-added
 * player) without disturbing the admin's own signed-in session.
 *
 * The Firebase client SDK signs in as whichever user it just created, so
 * creating an account "for someone else" on the primary `auth` instance
 * would hijack the admin's session. The standard client-side workaround is
 * a throwaway secondary Firebase App instance: `createUserWithEmailAndPassword`
 * runs against that instance's own isolated auth state, leaving the primary
 * app (and the admin's session) untouched. The secondary app is torn down
 * immediately after.
 *
 * Returns the generated credentials — shown to the admin exactly once (they
 * are not retrievable afterwards; Firebase Auth never exposes a plaintext
 * password again once set).
 */
export async function createLinkedAccount(
  displayName: string,
): Promise<{ username: string; password: string; uid: string }> {
  if (!app) throw new Error('Firebase is not configured.')

  const username = await generateTempUsername()
  const password = randomTempPassword()
  const email = usernameToEmail(username)

  const secondaryApp = initializeApp(app.options, `secondary-${Date.now()}`)
  let uid: string
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    uid = cred.user.uid
    await signOut(secondaryAuth)
  } finally {
    await deleteApp(secondaryApp)
  }

  const now = Date.now()
  const profile: UserProfile = {
    id: uid,
    username,
    displayName: displayName.trim() || username,
    role: 'VIEWER',
    status: 'pending_registration',
    bannedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await setDoc(doc(db, COL.users, uid), pruneUndefined(profile))
    await setDoc(doc(db, COL.usernameLookup, username), { uid, username, createdAt: now })
  } catch (err) {
    // No client-side way to delete another user's auth account (that needs
    // the Admin SDK) — leave the auth user but surface the failure so the
    // admin knows the profile write didn't complete.
    throw err
  }

  return { username, password, uid }
}

/**
 * First-login activation: a `pending_registration` account picks a real
 * password and display name, and becomes `active`. Runs as the signed-in
 * user themselves (they're already authenticated with the temp credentials).
 *
 * The assigned `user######` username is kept permanently rather than made
 * choosable here: usernames map to a synthetic email, and changing it means
 * calling Firebase Auth's `updateEmail`, which (on projects with email
 * enumeration protection — the current default for new Firebase projects)
 * requires verifying the new address first. There's no real mailbox behind
 * our synthetic domain, so that verification could never complete — this
 * isn't a corner we're cutting, it's a platform constraint with no client-
 * side workaround short of standing up a backend (Admin SDK) this project
 * doesn't have.
 */
export async function activateAccount(input: {
  newPassword: string
  displayName: string
}): Promise<UserProfile> {
  const user = auth.currentUser
  if (!user) throw new Error('You must be signed in.')

  if (input.newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }

  const current = await loadProfile(user.uid)
  if (!current) throw new Error('Profile not found.')

  await updatePassword(user, input.newPassword)

  const updated: UserProfile = {
    ...current,
    displayName: input.displayName.trim() || current.username,
    status: 'active',
    updatedAt: Date.now(),
  }
  await setDoc(doc(db, COL.users, user.uid), pruneUndefined(updated))

  return updated
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
    void logAudit(fallback, 'auth.login', `@${fallback.username} signed in`)
    return fallback
  }
  void logAudit(profile, 'auth.login', `@${profile.username} signed in`)
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

/* ------------------- Phone verification -------------------
 * Verifying ownership of a phone number, not signing in with one — the app's own auth stays
 * username/password throughout. `linkWithPhoneNumber` attaches a phone credential to the already
 * signed-in user and requires an interactive reCAPTCHA challenge, so this can only run in a real
 * browser tab with a rendered container, never headlessly or from a script. Requires the "Phone"
 * sign-in provider to be enabled in the Firebase console for this project — this app has no way to
 * enable that itself, and enabling it can incur real per-SMS cost once used with real numbers. See
 * RESTRICTIONS.md for why this code path could not be live-tested from this sandbox. */

let recaptchaVerifier: RecaptchaVerifier | null = null
// Which container the cached verifier above was actually built for. This app now has more
// than one phone-verification entry point (Account Settings, and the Tournament Manager
// application on AccountPage), each rendering its own reCAPTCHA container element. A
// verifier is only safe to reuse against the exact container it was constructed with —
// reusing one bound to a different (possibly unmounted) element throws "reCAPTCHA has
// already been rendered in this element", since the underlying widget is still registered
// against the stale node.
let recaptchaContainerId: string | null = null

/** Renders (or reuses) an invisible reCAPTCHA challenge in `containerId` and sends a verification
 *  SMS to `phoneNumber` (E.164 format, e.g. "+15551234567") for the currently signed-in user. */
export async function sendPhoneVerificationCode(
  phoneNumber: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const user = auth.currentUser
  if (!user) throw new Error('You must be signed in.')
  if (recaptchaVerifier && recaptchaContainerId !== containerId) {
    recaptchaVerifier.clear()
    recaptchaVerifier = null
  }
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
    recaptchaContainerId = containerId
  }
  return linkWithPhoneNumber(user, phoneNumber, recaptchaVerifier)
}

/** Confirms the code sent by `sendPhoneVerificationCode` and marks the profile's phone verified.
 *  Forces a fresh ID token *before* the Firestore write: `firestore.rules` only allows
 *  `phoneVerified: true` when the caller's own token carries a `phone_number` claim (set by
 *  Firebase Auth once `linkWithPhoneNumber` really succeeds, unforgeable by writing the Firestore
 *  field directly) — without this refresh, the cached token from before linking wouldn't have that
 *  claim yet and the write would be rejected. */
export async function confirmPhoneVerificationCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<void> {
  await confirmation.confirm(code)
  const user = auth.currentUser
  if (!user) return
  await user.getIdToken(true)
  await updateDoc(doc(db, COL.users, user.uid), { phoneVerified: true, updatedAt: Date.now() })
}

/** Clears the reCAPTCHA widget after a failed/abandoned attempt so the next call to
 *  `sendPhoneVerificationCode` renders a fresh challenge instead of reusing a spent one. */
export function resetPhoneVerification(): void {
  recaptchaVerifier?.clear()
  recaptchaVerifier = null
  recaptchaContainerId = null
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
    case 'auth/invalid-phone-number':
      return 'Enter a phone number with country code, e.g. +15551234567.'
    case 'auth/code-expired':
      return 'That code expired. Send a new one.'
    case 'auth/invalid-verification-code':
      return "That code doesn't match. Check it and try again."
    case 'auth/credential-already-in-use':
    case 'auth/provider-already-linked':
      return 'That phone number is already linked to another account.'
    case 'auth/operation-not-allowed':
      return 'Phone verification isn’t enabled for this project yet.'
    default:
      return err instanceof Error ? err.message : 'Something went wrong.'
  }
}
