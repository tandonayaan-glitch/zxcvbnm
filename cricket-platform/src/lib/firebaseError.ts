/**
 * Turns a thrown error into a message worth showing a user. Firebase (Firestore,
 * Storage, and the odd raw `FirebaseError`) throw text that is either cryptic
 * ("Missing or insufficient permissions."), internal ("FIRESTORE ... INTERNAL
 * ASSERTION"), or code-shaped ("storage/unauthorized") — none of which tells a
 * person what happened or what to do. Auth errors have their own richer mapping
 * in `auth.service.ts` (`authErrorMessage`); this covers everything else.
 */

/** Best-effort extraction of a Firebase-style error code from any thrown value. */
function errorCode(err: unknown): string {
  if (typeof err === 'object' && err && 'code' in err) {
    return String((err as { code: unknown }).code).toLowerCase()
  }
  return ''
}

const CODE_MESSAGES: Record<string, string> = {
  // Firestore
  'permission-denied': "You don't have permission to do that.",
  unauthenticated: 'Please sign in and try again.',
  unavailable: "Can't reach the server right now — check your connection and try again.",
  'deadline-exceeded': 'That took too long. Please try again.',
  cancelled: 'That request was cancelled. Please try again.',
  'not-found': "That item no longer exists — it may have been deleted.",
  'already-exists': 'That already exists.',
  'failed-precondition':
    "That can't be done right now — reload the page and try again.",
  aborted: 'Something else changed that at the same time. Reload and try again.',
  'resource-exhausted': 'The app is busy right now. Please wait a moment and try again.',
  'invalid-argument': "Some of that information wasn't valid. Please check it and try again.",
  internal: 'Something went wrong on our side. Please try again in a moment.',
  'data-loss': 'Something went wrong on our side. Please try again in a moment.',
  // Storage
  'storage/unauthorized': "You don't have permission to upload or change that file.",
  'storage/canceled': 'That upload was cancelled.',
  'storage/retry-limit-exceeded':
    'The upload kept failing — check your connection and try again.',
  'storage/quota-exceeded': 'There is no storage space left for that upload.',
  'storage/unauthenticated': 'Please sign in and try again.',
  'storage/object-not-found': "That file no longer exists.",
  'storage/invalid-checksum': 'The upload got corrupted in transit. Please try again.',
  'storage/server-file-wrong-size': 'The upload got corrupted in transit. Please try again.',
}

/** True if a string still looks like raw SDK output rather than a sentence. */
function looksRaw(msg: string): boolean {
  return (
    /^firebase:/i.test(msg) ||
    /^(auth|firestore|storage|functions|app)\//i.test(msg) ||
    /INTERNAL ASSERTION|FIRESTORE \(|Missing or insufficient permissions/i.test(msg) ||
    /\bRST_STREAM\b|\bgRPC\b|HTTP\/2/i.test(msg)
  )
}

/**
 * Plain-language message for any non-auth failure. Never returns raw
 * `FirebaseError` / gRPC / "insufficient permissions" text — an unrecognised
 * code or a raw-looking message falls through to `fallback`.
 */
export function firebaseErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const code = errorCode(err)
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]

  if (err instanceof Error && err.message) {
    const m = err.message.trim()
    if (m && !looksRaw(m)) return m
  }
  return fallback
}

/**
 * Back-compat name kept for existing call sites. `permission-denied` gets the
 * given `deniedMessage`; everything else routes through `firebaseErrorMessage`
 * so a role-gated action never fails silently or cryptically.
 */
export function permissionAwareMessage(
  err: unknown,
  deniedMessage = "You don't have permission to do that.",
): string {
  if (errorCode(err) === 'permission-denied') return deniedMessage
  return firebaseErrorMessage(err)
}
