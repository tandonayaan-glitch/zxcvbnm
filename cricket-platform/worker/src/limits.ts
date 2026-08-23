/**
 * Every image-storage limit CricketHub enforces, in one place. Change values here only —
 * nothing else in this Worker (or the frontend usage display) should hardcode a byte number.
 */
export const LIMITS = {
  /** Max bytes a single uploaded image may be. Mirrors the old Firebase Storage rule's cap
   *  (`isValidImage()` in storage.rules) so per-file behavior doesn't change. */
  MAX_IMAGE_BYTES: 5 * 1024 * 1024, // 5MB

  /** Max total bytes one user's images may occupy across every folder combined. */
  MAX_BYTES_PER_USER: 100 * 1024 * 1024, // 100MB

  /** Max total bytes ALL users' images may occupy platform-wide. Kept below R2's actual
   *  10GB-month Standard-storage free-tier ceiling (verified against Cloudflare's current
   *  R2 pricing docs) so ordinary usage never gets close to the point where R2 itself would
   *  start billing. */
  MAX_BYTES_GLOBAL: 9.9 * 1024 * 1024 * 1024, // 9.9GB

  ACCEPTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
} as const

export type AcceptedImageType = (typeof LIMITS.ACCEPTED_IMAGE_TYPES)[number]

export function isAcceptedImageType(contentType: string): contentType is AcceptedImageType {
  return (LIMITS.ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType)
}

/** Folders a client is allowed to upload/list/delete under — closes the door on an
 *  arbitrary top-level prefix a buggy or malicious caller might otherwise request.
 *  Matches storage.rules' existing folder list exactly (tournamentDocuments excluded —
 *  documents stay on Firebase Storage, this Worker only ever serves images). */
export const KNOWN_FOLDERS = ['players', 'teams', 'clubs', 'tournaments', 'users', 'matches'] as const

export function isKnownFolderKey(key: string): boolean {
  return KNOWN_FOLDERS.some((f) => key === f || key.startsWith(`${f}/`))
}
