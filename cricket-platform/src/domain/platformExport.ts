/* ==================================================================
 * Platform backup export — a full JSON snapshot of the platform's core
 * data, for the master-admin Platform Tools page. Pure serialiser; data
 * gathering (Firestore reads) lives in services/admin.service.ts.
 * ================================================================== */
import type { Player, Team, Tournament, Match, Delivery, Role, UserStatus } from '@/types'

export interface BackupUser {
  id: string
  username: string
  displayName: string
  role: Role
  status: UserStatus
  createdAt: number
}

export interface PlatformBackup {
  exportedAt: number
  players: Player[]
  teams: Team[]
  tournaments: Tournament[]
  matches: Match[]
  /** Ball-by-ball deliveries, keyed by match id (only for matches with innings). */
  deliveriesByMatch: Record<string, Delivery[]>
  users: BackupUser[]
}

export function platformBackupToJSON(data: PlatformBackup): string {
  return JSON.stringify(data, null, 2)
}
