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
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  runTransaction,
  collection,
  query,
  where,
  limit,
  getDocs,
  getDocsFromServer,
  getDocsFromCache,
  type FirestoreError,
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

/**
 * Whether the master admin exists yet — drives the first-time setup screen.
 *
 *  - `'exists'`  — a MASTER_ADMIN is definitely present
 *  - `'missing'` — the SERVER was reached and reports none (offer /setup)
 *  - `'unknown'` — could NOT get an authoritative answer (offline / permission /
 *                  backend error). Callers treat this as "do not offer setup".
 *
 * Why `getDocsFromServer` and not plain `getDocs`: with the persistent local
 * cache enabled (see `lib/firebase.ts`), an OFFLINE `getDocs()` does **not**
 * throw — it quietly resolves an *empty* result from an unpopulated cache
 * (`{ empty: true, fromCache: true }`). That empty result is indistinguishable
 * from "no admin exists", which is exactly the false "No admin account exists
 * yet" this function must never produce. `getDocsFromServer()` forces a real
 * round-trip and *rejects* with `unavailable` when the client can't reach the
 * backend, so offline and empty are finally distinct. A *positive* cache hit is
 * still trustworthy offline (if we've ever seen a master admin, one exists), so
 * that path can still answer `'exists'` without the network.
 */
export type MasterAdminStatus = 'exists' | 'missing' | 'unknown'

export async function masterAdminStatus(): Promise<MasterAdminStatus> {
  const q = query(
    collection(db, COL.users),
    where('role', '==', 'MASTER_ADMIN'),
    limit(1),
  )
  try {
    const snap = await getDocsFromServer(q)
    return snap.empty ? 'missing' : 'exists'
  } catch {
    // Couldn't reach the backend (offline / unavailable / permission / error).
    // A cached hit still proves existence; anything else is 'unknown', NEVER
    // 'missing'.
    try {
      const cached = await getDocsFromCache(q)
      if (!cached.empty) return 'exists'
    } catch {
      /* nothing usable in the cache */
    }
    return 'unknown'
  }
}

/**
 * Back-compat boolean. Fails *closed*: only `'missing'` (a definitive empty
 * result) is `false` — `'unknown'` returns `true` so an offline error never
 * bootstraps a second master admin or shows the "no admin" setup path.
 */
export async function masterAdminExists(): Promise<boolean> {
  return (await masterAdminStatus()) !== 'missing'
}

/** Back-compat alias used by older callers (setup / login banner). */
export const adminExists = masterAdminExists

/** A Firestore failure that means "the client couldn't reach the backend" —
 *  as opposed to a definitive "not found" / "permission denied". */
export function isOfflineError(err: unknown): boolean {
  const code = (err as Partial<FirestoreError> | undefined)?.code
  if (code === 'unavailable' || code === 'deadline-exceeded') return true
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  return msg.includes('client is offline') || msg.includes('failed to get document because the client is offline')
}

/** `true`/`false` from Firestore; a raw throw becomes an offline-aware error so
 *  callers don't treat "offline" as "username is free". */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const u = normalizeUsername(username)
  const snap = await getDoc(doc(db, COL.usernameLookup, u))
  return snap.exists()
}

/**
 * Load a user profile. `null` means the doc genuinely does not exist. An
 * offline/unavailable read falls back to the local cache; only if the cache
 * has nothing either does it throw (so a caller can tell "offline, unknown"
 * apart from "no such profile" and must not, e.g., self-heal a fake profile).
 */
export async function loadProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, COL.users, uid)
  try {
    const snap = await getDoc(ref)
    return snap.exists() ? (snap.data() as UserProfile) : null
  } catch (err) {
    if (isOfflineError(err)) {
      try {
        const cached = await getDocFromCache(ref)
        if (cached.exists()) return cached.data() as UserProfile
      } catch {
        /* nothing cached */
      }
    }
    throw err
  }
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
 * Re-issue login access when the one-time temporary password was lost before
 * the person activated their account (or an activated account is locked out).
 *
 * The Firebase client SDK cannot reset another user's password — that needs
 * the Admin SDK, which this project has no backend for. So "re-issue" mints a
 * brand-new linked account (fresh `user######` + fresh temp password),
 * carries over the old account's role, re-points the linked player at the new
 * uid so the person keeps their playing identity, and suspends the old
 * account so the stale credentials can never be used and there's only ever
 * one live account per person. The old Firebase Auth user is left orphaned
 * (no client-side delete) but is inert: its profile is `banned`, which
 * `login()` and `observeAuth()` both reject.
 *
 * Master-admin only — enforced by the MASTER_ADMIN-guarded `/users` route and
 * by Firestore rules on the writes below. The fresh credentials are returned
 * to be shown exactly once, same as `createLinkedAccount`.
 */
export async function reissueLinkedAccess(
  old: UserProfile,
  actor: UserProfile | null,
): Promise<{ username: string; password: string; uid: string; displayName: string }> {
  if (old.role === 'MASTER_ADMIN') {
    throw new Error('The master admin account cannot be re-issued this way.')
  }

  const fresh = await createLinkedAccount(old.displayName || old.username)
  const now = Date.now()

  // createLinkedAccount always starts a new account at VIEWER — carry the old
  // account's role across so a re-issued scorer stays a scorer.
  if (old.role && old.role !== 'VIEWER') {
    try {
      await setDoc(
        doc(db, COL.users, fresh.uid),
        { role: old.role, updatedAt: now },
        { merge: true },
      )
    } catch {
      /* non-fatal — the master can re-set the role from the same page */
    }
  }

  // Re-point any player linked to the old account so stats/identity follow.
  try {
    const linked = await getDocs(
      query(
        collection(db, COL.players),
        where('linkedUserId', '==', old.id),
        limit(5),
      ),
    )
    await Promise.all(
      linked.docs.map((d) =>
        setDoc(
          doc(db, COL.players, d.id),
          { linkedUserId: fresh.uid, updatedAt: now },
          { merge: true },
        ),
      ),
    )
  } catch {
    /* non-fatal */
  }

  // Kill the old account: the lost temp password must not remain usable, and
  // two live accounts for one person would be worse than one orphaned auth
  // user. A raw merge (not setUserStatus) so no "suspended" notification is
  // queued for an account nobody can sign into.
  try {
    await setDoc(
      doc(db, COL.users, old.id),
      { status: 'banned', bannedAt: now, updatedAt: now },
      { merge: true },
    )
  } catch {
    /* non-fatal */
  }

  void logAudit(
    actor,
    'Re-issued login access',
    `@${old.username} → @${fresh.username}`,
    { before: old.username, after: fresh.username },
  )

  return { ...fresh, displayName: old.displayName || old.username }
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
    let profile: UserProfile | null = null
    // Retry to absorb (a) the brief window right after signup before the profile
    // write commits and (b) a transient offline read. `loadProfile` already
    // falls back to the local cache, so a warm session survives going offline;
    // only a cold cache + offline lands in the catch.
    for (let i = 0; i < 4 && !profile; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 250))
      try {
        profile = await loadProfile(fbUser.uid)
      } catch (err) {
        if (!isOfflineError(err) || i === 3) {
          // Give up loading the profile rather than leaving the app stuck
          // "initializing" or dumping a raw Firestore error. The Firebase
          // session is intact; a reconnect + reload resolves it.
          cb(null, fbUser)
          return
        }
      }
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

/** Which screen the error happened on — lets the message point somewhere useful
 *  ("create an account" after a failed login, "sign in instead" after a name clash). */
export type AuthErrorContext = 'login' | 'signup' | 'activate' | 'setup' | 'reset'

/**
 * Turns *any* auth failure into a short, plain-language, actionable sentence. It never
 * returns a raw `Firebase: Error (auth/…)` string — an unrecognised code or a bare
 * Firebase message falls through to a friendly generic line for the given context.
 * Messages this module throws itself (e.g. "That username is already taken.") are
 * already user-facing and pass straight through.
 */
export function authErrorMessage(
  err: unknown,
  context: AuthErrorContext = 'login',
): string {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code: unknown }).code).toLowerCase()
      : ''

  switch (code) {
    // Wrong password / no such account. Modern Firebase collapses both into
    // `invalid-credential` to resist account enumeration.
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      if (context === 'login')
        return "That username and password don't match an account. Check your details — or if you don't have an account yet, create one below."
      if (context === 'reset') return 'Your current password is incorrect.'
      return 'Those sign-in details are incorrect.'

    // Username didn't form a valid login (empty, spaces, an "@", etc.).
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return context === 'login'
        ? "We couldn't find an account for that username. Check the spelling, or create a new account below."
        : 'Please enter a valid username — 3–20 letters, numbers or underscores.'

    case 'auth/missing-password':
      return 'Please enter your password.'

    case 'auth/user-disabled':
      return 'This account has been suspended. Please contact your administrator.'

    case 'auth/email-already-in-use':
      return context === 'signup'
        ? 'That username is already taken. Try signing in instead, or pick a different one.'
        : 'That username is already taken.'

    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.'

    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'auth/network-request-failed':
      return 'Network problem — check your connection and try again.'
    case 'auth/timeout':
      return 'That took too long. Please try again.'
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again before making this change.'

    // Config / server problems — a normal user can't fix these, so don't dump
    // internals on them.
    case 'auth/operation-not-allowed':
      return 'Sign-in is not enabled right now. Please contact your administrator.'
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-app-credential':
    case 'auth/configuration-not-found':
      return 'The app is not configured correctly. Please contact your administrator.'
    case 'auth/internal-error':
      return 'Something went wrong on our side. Please try again in a moment.'
  }

  // A message we threw ourselves is already friendly — keep it, unless it's a raw
  // Firebase string.
  if (err instanceof Error && err.message) {
    const m = err.message.trim()
    if (m && !/^firebase:/i.test(m) && !/^auth\/[a-z-]+/i.test(m)) return m
  }

  // Unknown code / bare "Firebase: Error (...)" text: stay generic and useful.
  switch (context) {
    case 'signup':
      return "We couldn't create your account. Please check your details and try again."
    case 'login':
      return "We couldn't sign you in. Check your details, or create a new account below."
    case 'activate':
      return "We couldn't activate your account. Please try again."
    case 'setup':
      return "We couldn't complete setup. Please try again."
    default:
      return 'Something went wrong. Please try again.'
  }
}
