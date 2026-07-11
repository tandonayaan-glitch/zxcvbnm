import { missingFirebaseEnv } from '@/lib/firebase'

export function FirebaseNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 p-4">
      <div className="max-w-lg rounded-2xl bg-white dark:bg-ink-900 p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">
          Connect Firebase to get started
        </h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          CricketHub needs a Firebase project (Authentication + Firestore). Add
          your config to a <code className="rounded bg-ink-100 dark:bg-ink-800 px-1">.env.local</code>{' '}
          file in the project root and restart the dev server.
        </p>
        {missingFirebaseEnv.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <div className="font-semibold">Missing variables:</div>
            <ul className="mt-1 list-inside list-disc font-mono text-xs">
              {missingFirebaseEnv.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        )}
        <pre className="mt-4 overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs text-ink-100">
{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`}
        </pre>
        <p className="mt-4 text-xs text-ink-500 dark:text-ink-400">
          In the Firebase console, enable{' '}
          <b>Authentication → Email/Password</b> and create a{' '}
          <b>Firestore database</b>. See <code>README.md</code> for full steps
          and security rules.
        </p>
      </div>
    </div>
  )
}
