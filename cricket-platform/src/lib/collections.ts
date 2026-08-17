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
  invitations: 'invitations',
  // Internal linkage doc consumed only by firestore.rules (users/{uid}'s self-role-elevation
  // check on invitation accept) — never read directly by any UI. See RESTRICTIONS.md for why
  // this exists: Firestore rules can't query "is there a pending invitation for this uid" by
  // field value, only by exact doc path, so this mirrors {role, expiresAt} at invitedUid.
  invitationRoleGrants: 'invitationRoleGrants',
  teamInvitations: 'teamInvitations', // invites an existing user to join a team's roster as a player
  // Mirrors invitationRoleGrants' role for team invitations: firestore.rules can't query "is
  // there a pending team invitation for this uid," only check an exact doc path, so this
  // records {teamId, expiresAt} at invitedUid — the narrow, unforgeable exception that lets the
  // invitee create/update their own linked Player doc and append to the team's playerIds.
  teamInvitationGrants: 'teamInvitationGrants',
  comments: 'comments', // flat spectator comments, scoped to a matchId
  reactions: 'reactions', // subcollection under matches/{id}; one doc per reacting user
  announcements: 'announcements', // scoped by tournamentId
  // Doc id == uid, one per user (mirrors userPrefs). `provider` is always 'mock' today — this
  // project has no real billing integration yet, see billing.types.ts.
  subscriptions: 'subscriptions',
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
