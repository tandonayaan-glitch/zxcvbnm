export interface Env {
  MEDIA_BUCKET: R2Bucket
  FIREBASE_PROJECT_ID: string
  R2_PUBLIC_BASE_URL: string
  ALLOWED_ORIGINS: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  /** Optional — the AI Engine (Phase 18) is fully wired end-to-end but genuinely disabled
   *  without this. Absent in every environment today; when unset, /ai always responds with
   *  `{ status: 'not_configured' }` rather than attempting a call. Never hardcode a value here. */
  AI_PROVIDER_API_KEY?: string
  /** Which provider AI_PROVIDER_API_KEY belongs to, e.g. 'anthropic' — lets the handler pick the
   *  right request shape once a key exists, without a code change to switch providers. */
  AI_PROVIDER?: string
}

export type Role = 'MASTER_ADMIN' | 'ADMIN' | 'SCORER' | 'VIEWER' | 'TEAM_MANAGER' | 'TOURNAMENT_MANAGER'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
