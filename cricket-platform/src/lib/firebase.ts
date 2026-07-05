/* ==================================================================
 * Central Firebase initialisation.
 *  - Single app instance (guards against duplicate init / HMR).
 *  - Validates required env vars up-front with a clear error.
 *  - Exports typed `auth`, `db`, `storage` singletons.
 * ================================================================== */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

interface FirebaseEnv {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

const REQUIRED_KEYS: Array<keyof FirebaseEnv> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]

function readEnv(): FirebaseEnv {
  const env = import.meta.env
  return {
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
  }
}

const config = readEnv()

/** Names of env vars that are still blank — used for the setup screen. */
export const missingFirebaseEnv: string[] = REQUIRED_KEYS.filter(
  (k) => !config[k] || config[k].trim() === '',
).map((k) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`)

export const isFirebaseConfigured = missingFirebaseEnv.length === 0

/**
 * The internal domain used to turn a username into a synthetic email so we
 * can use Firebase Auth (email/password) under a username/password UX.
 */
export const AUTH_EMAIL_DOMAIN: string =
  import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'crickethub.local'

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`
}

/**
 * Initialise eagerly only when configured. The app shell renders a friendly
 * setup screen when `isFirebaseConfigured` is false, so service code (which
 * only ever calls these inside functions) is never reached unconfigured.
 * We intentionally avoid a Proxy here — Firebase's modular SDK does internal
 * instance checks that a Proxy would break.
 */
let app: FirebaseApp | undefined
let authInstance: Auth
let dbInstance: Firestore
let storageInstance: FirebaseStorage

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(config)
  authInstance = getAuth(app)
  // Offline-first: IndexedDB persistent cache queues writes while offline and
  // syncs them (in order) on reconnect — this is what powers offline scoring.
  // Falls back to in-memory cache if the browser blocks IndexedDB.
  try {
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch {
    dbInstance = getFirestore(app)
  }
  storageInstance = getStorage(app)
} else {
  // Unconfigured: leave as undefined-cast singletons. Access is gated by the
  // setup screen, so these are never used until real config is provided.
  authInstance = undefined as unknown as Auth
  dbInstance = undefined as unknown as Firestore
  storageInstance = undefined as unknown as FirebaseStorage
}

export const auth = authInstance
export const db = dbInstance
export const storage = storageInstance
export { app }
