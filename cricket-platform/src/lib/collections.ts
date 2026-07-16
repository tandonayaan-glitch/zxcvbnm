/* Firestore collection names + small id helper. Keep all names in one place. */
export const COL = {
  users: 'users',
  usernameLookup: 'usernameLookup',
  players: 'players',
  teams: 'teams',
  clubs: 'clubs',
  seasons: 'seasons',
  tournaments: 'tournaments',
  matches: 'matches',
  deliveries: 'deliveries', // subcollection under matches/{id}
  playerStats: 'playerStats',
  teamStats: 'teamStats',
  standings: 'standings', // subcollection under tournaments/{id}
  activity: 'activity',
  settings: 'settings',
  adminRequests: 'adminRequests',
  auditLogs: 'auditLogs',
  userPrefs: 'userPrefs', // per-user appearance/accessibility prefs (cross-device)
  recoveryAttempts: 'recoveryAttempts', // audit trail for /recover quiz attempts
  ballMeta: 'ballMeta', // subcollection under matches/{id}; optional shot-zone/line-length tags
  notifications: 'notifications', // per-user notification center entries
  clientErrors: 'clientErrors', // runtime errors caught by ErrorBoundary, for admin diagnostics
  entityVersions: 'entityVersions', // pre-edit snapshots of players/teams/clubs/tournaments/matches
  featureFlags: 'featureFlags',
} as const

export const SETTINGS_DOC = 'app'

/** Loose unique-ish id for client-generated docs (deliveries etc.). */
export function genId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

/**
 * Firestore rejects `undefined` field values. Strip them before any write so
 * optional/blank form fields don't blow up setDoc/updateDoc. Use `null` if you
 * actually need to clear a field.
 */
export function pruneUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as T
}
