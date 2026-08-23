export interface Env {
  MEDIA_BUCKET: R2Bucket
  FIREBASE_PROJECT_ID: string
  R2_PUBLIC_BASE_URL: string
  ALLOWED_ORIGINS: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
}

export type Role = 'MASTER_ADMIN' | 'ADMIN' | 'SCORER' | 'VIEWER' | 'TEAM_MANAGER' | 'TOURNAMENT_MANAGER'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
