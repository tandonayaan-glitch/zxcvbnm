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

  /** Max bytes a single uploaded video may be. Capped well under Cloudflare Workers' request
   *  body ceiling (100MB on the plan this project runs) rather than at some "ideal" size — a
   *  live match recording longer/higher-bitrate than this cap simply can't upload through this
   *  pipeline yet without a real media provider (Cloudflare Stream/Mux) doing chunked or
   *  server-side ingest, which this project has no account for. Documented, not silently
   *  truncated: upload.ts returns a clear 413 when a recording exceeds this. */
  MAX_VIDEO_BYTES: 90 * 1024 * 1024, // 90MB

  /** Separate from the image per-user/global caps — video shouldn't cannibalize the small
   *  100MB image allowance. */
  MAX_VIDEO_BYTES_PER_USER: 500 * 1024 * 1024, // 500MB
  MAX_VIDEO_BYTES_GLOBAL: 20 * 1024 * 1024 * 1024, // 20GB

  ACCEPTED_VIDEO_TYPES: ['video/webm', 'video/mp4'] as const,
} as const

export type AcceptedImageType = (typeof LIMITS.ACCEPTED_IMAGE_TYPES)[number]

export function isAcceptedImageType(contentType: string): contentType is AcceptedImageType {
  return (LIMITS.ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType)
}

export function isAcceptedVideoType(contentType: string): boolean {
  // `video/webm;codecs=vp9,opus` etc. — match on the base MIME type only.
  const base = contentType.split(';')[0]?.trim()
  return (LIMITS.ACCEPTED_VIDEO_TYPES as readonly string[]).includes(base ?? '')
}

/** Folders a client is allowed to upload/list/delete under — closes the door on an
 *  arbitrary top-level prefix a buggy or malicious caller might otherwise request.
 *  Matches storage.rules' existing folder list exactly (tournamentDocuments excluded —
 *  documents stay on Firebase Storage, this Worker only ever serves images). */
export const KNOWN_FOLDERS = ['players', 'teams', 'clubs', 'tournaments', 'users', 'matches'] as const

export function isKnownFolderKey(key: string): boolean {
  return KNOWN_FOLDERS.some((f) => key === f || key.startsWith(`${f}/`))
}

/** Video uploads are restricted to `matches/{id}/videos/...` — the only place this project
 *  has a video concept at all (match recordings/uploads). */
export function isVideoFolderKey(key: string): boolean {
  return /^matches\/[^/]+\/videos\//.test(key)
}
