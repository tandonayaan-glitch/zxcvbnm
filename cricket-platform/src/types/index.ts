/* ==================================================================
 * CricketHub — domain types
 * Single source of truth for the data model shared across services,
 * the scoring engine, the stats engine and the UI.
 * ================================================================== */

/* ----------------------------- Auth ----------------------------- */

export type Role =
  | 'MASTER_ADMIN'
  | 'ADMIN'
  | 'SCORER'
  | 'VIEWER'
  | 'TEAM_MANAGER'
  | 'TOURNAMENT_MANAGER'

export type UserStatus = 'active' | 'banned' | 'pending_registration'

export interface UserProfile {
  id: string // Firebase Auth uid
  username: string // unique, lowercase
  displayName: string
  role: Role
  status: UserStatus
  bio?: string
  photoURL?: string | null
  email?: string
  bannedAt?: number | null
  createdAt: number
  updatedAt: number
}

/** Doc id in `usernameLookup` is the lowercased username. */
export interface UsernameLookup {
  uid: string
  username: string
  createdAt: number
}

/* ---------------------------- Players ---------------------------- */

export type PlayerRole =
  | 'batter'
  | 'bowler'
  | 'all_rounder'
  | 'wicket_keeper'

export type BattingStyle = 'right_hand' | 'left_hand'

export type BowlingStyle =
  | 'right_arm_fast'
  | 'right_arm_medium'
  | 'right_arm_offspin'
  | 'right_arm_legspin'
  | 'left_arm_fast'
  | 'left_arm_medium'
  | 'left_arm_orthodox'
  | 'left_arm_chinaman'
  | 'none'

export interface Player {
  id: string
  fullName: string
  displayName: string
  shortName?: string
  role: PlayerRole
  battingStyle: BattingStyle
  bowlingStyle: BowlingStyle
  teamIds: string[]
  photoURL?: string | null
  active: boolean
  /** Linked user account (auto-created login), if one was set up for this player. */
  linkedUserId?: string | null
  ownerId?: string // managing admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
  /** Soft-deleted (Trash): hidden from lists, restorable until permanently purged. */
  deletedAt?: number | null
  deletedBy?: string | null
}

/* ------------------------- Clubs & Seasons ------------------------- */

/** Top-level organisation that owns teams and runs tournaments/seasons. */
export interface Club {
  id: string
  name: string
  shortName?: string
  logoURL?: string | null
  description?: string
  homeVenue?: string
  ownerId?: string // managing admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
  /** Soft-deleted (Trash): hidden from lists, restorable until permanently purged. */
  deletedAt?: number | null
  deletedBy?: string | null
}

export type SeasonStatus = 'upcoming' | 'ongoing' | 'completed'

/** A time-boxed period (e.g. a year or a series) that groups tournaments. */
export interface Season {
  id: string
  name: string // e.g. "2026", "Summer 2026"
  /** Optional — a season can be club-scoped or platform-wide. */
  clubId?: string | null
  status: SeasonStatus
  startDate?: number | null
  endDate?: number | null
  description?: string
  ownerId?: string // managing admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
  /** Soft-deleted (Trash): hidden from lists, restorable until permanently purged. */
  deletedAt?: number | null
  deletedBy?: string | null
}

/* ----------------------------- Teams ----------------------------- */

export interface Team {
  id: string
  name: string
  shortName: string // 3-4 letter abbreviation
  primaryColor: string
  secondaryColor: string
  logoURL?: string | null
  playerIds: string[]
  captainId?: string | null
  viceCaptainId?: string | null
  homeVenue?: string
  /** Optional — clubs are opt-in, existing teams have no club. */
  clubId?: string | null
  ownerId?: string // managing admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
  /** Soft-deleted (Trash): hidden from lists, restorable until permanently purged. */
  deletedAt?: number | null
  deletedBy?: string | null
}

/* -------------------------- Tournaments -------------------------- */

export type TournamentFormat = 'league' | 'knockout' | 'group_knockout'
export type TournamentStatus = 'upcoming' | 'ongoing' | 'completed'

/** Where a match sits in a knockout tournament (null / 'group' = not in the bracket). */
export type KnockoutStage =
  | 'group'
  | 'round_16'
  | 'quarter_final'
  | 'semi_final'
  | 'eliminator'
  | 'qualifier'
  | 'third_place'
  | 'final'

export type SponsorTier = 'title' | 'gold' | 'silver' | 'partner'

export interface Sponsor {
  name: string
  logoURL?: string | null
  url?: string
  tier: SponsorTier
}

export interface Tournament {
  id: string
  name: string
  shortName?: string
  format: TournamentFormat
  status: TournamentStatus
  teamIds: string[]
  oversPerInnings: number
  venue?: string
  startDate?: number | null
  endDate?: number | null
  description?: string
  bannerURL?: string | null
  /** Optional — clubs/seasons are opt-in, existing tournaments have neither. */
  clubId?: string | null
  seasonId?: string | null
  /** Team id -> group label ("A", "B"…), only meaningful for group_knockout. */
  teamGroups?: Record<string, string>
  /** How many teams advance from each group; only meaningful for group_knockout. */
  qualifiersPerGroup?: number
  /** Match-rule defaults new matches in this tournament pre-fill from (Match Setup
   *  Wizard's Match Rules step). All optional — unset means the wizard's own defaults apply. */
  defaultMaxWickets?: number
  defaultTeamSize?: number
  /** Auto-powerplay convention for longer formats (>20 overs) that the wizard's
   *  overs-based tiers don't cover; see domain/matchRules.ts. */
  defaultPowerplayOvers?: number
  /** Optional sponsor showcase, shown on the public tournament page. */
  sponsors?: Sponsor[]
  ownerId?: string // owning admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
  /** Soft-deleted (Trash): hidden from lists, restorable until permanently purged. */
  deletedAt?: number | null
  deletedBy?: string | null
}

/** Cached points-table row for a tournament. */
export interface StandingsRow {
  teamId: string
  teamName: string
  teamShort: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  runsFor: number
  ballsFor: number
  runsAgainst: number
  ballsAgainst: number
  nrr: number
}

/* ---------------------------- Matches ---------------------------- */

export type MatchFormat = 'T20' | 'ODI' | 'T10' | 'THE_HUNDRED' | 'CUSTOM'
export type MatchStatus = 'setup' | 'live' | 'innings_break' | 'completed' | 'abandoned'
export type TossDecision = 'bat' | 'bowl'

export interface MatchTeamRef {
  id: string
  name: string
  shortName: string
  color?: string
}

export interface TossInfo {
  wonByTeamId: string
  decision: TossDecision
}

export interface MatchResult {
  outcome: 'win' | 'tie' | 'no_result' | 'abandoned'
  winnerTeamId?: string | null
  winnerName?: string | null
  margin?: string // e.g. "24 runs" or "5 wickets"
  summary: string // full human readable result line
}

/* -------- Scoring: extras, wickets, deliveries, innings -------- */

export type ExtraType = 'wide' | 'no_ball' | 'bye' | 'leg_bye'

export type WicketType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'retired_out'
  | 'retired_hurt'
  | 'other'

export interface WicketEvent {
  type: WicketType
  outBatterId: string
  fielderId?: string | null
  /** When the non-striker is run out, etc. — credit to bowler? */
  creditToBowler: boolean
  text: string // "c Smith b Jones"
}

/** Raw input produced by the scoring UI for a single ball. */
export interface BallInput {
  runs: number // runs ran / boundary value tapped
  extra?: ExtraType
  wicket?: {
    type: WicketType
    outBatterId: string
    fielderId?: string | null
  }
}

/** Persisted ball-by-ball event (matches/{id}/deliveries). */
export interface Delivery {
  id: string
  inningsIndex: number
  sequence: number // monotonic within innings
  overNumber: number // 0-based completed overs at the time
  ballInOver: number // legal-ball index within this over (1..ballsPerOver)
  displayOver: string // "5.3"
  strikerId: string
  nonStrikerId: string
  bowlerId: string
  runsOffBat: number
  extraType: ExtraType | null
  extraRuns: number
  totalRuns: number
  isLegal: boolean
  wicket: WicketEvent | null
  commentary: string
  createdAt: number
  scorerId?: string | null
}

/** 1-8 wagon-wheel shot-placement zones, clockwise from straight-down-the-ground. */
export type ShotZone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type BowlingLine = 'wide_off' | 'outside_off' | 'stump' | 'leg' | 'wide_leg'
export type BowlingLength = 'full_toss' | 'yorker' | 'full' | 'good' | 'short' | 'bouncer'

/**
 * Optional per-ball shot-placement / line-length tag, keyed by delivery id.
 * Deliberately NOT part of `Delivery` or `BallInput` — the scoring engine
 * (`domain/scoring.ts`) is treated as verified/reliable and isn't touched by
 * new features; this is a sibling doc the scoring UI writes to separately,
 * after `recordBall()` already returned, so it can never affect scoring
 * logic even if it's missing, malformed, or added long after the fact.
 */
export interface BallMeta {
  id: string // == Delivery.id
  zone?: ShotZone
  line?: BowlingLine
  length?: BowlingLength
  /** Free-text scorer note on this delivery — e.g. "given out, review requested". */
  note?: string
  /** Flagged for review (e.g. a wicket decision under dispute). Purely informational —
   *  doesn't gate or trigger anything on its own. */
  reviewed?: boolean
  /** Ball-to-video link: seconds elapsed since the match's live recording started, captured
   *  automatically at scoring time from a live `Broadcast.startedAt` — never hand-entered, so
   *  this is always a real offset into a real recording or absent entirely. */
  videoTimestampSec?: number
  createdAt: number
}

export interface ExtrasBreakdown {
  wides: number
  noBalls: number
  byes: number
  legByes: number
  penalty: number
  total: number
}

export interface BatterCard {
  playerId: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissalText?: string
  dismissalType?: WicketType
  bowlerId?: string | null
  fielderId?: string | null
  battingOrder: number
}

export interface BowlerCard {
  playerId: string
  legalBalls: number
  runsConceded: number
  wickets: number
  maidens: number
  wides: number
  noBalls: number
}

export interface FallOfWicket {
  wicketNumber: number
  score: number
  displayOver: string
  batterOutId: string
}

export interface RecentBall {
  token: string // "1", "4", "6", "W", "Wd", "Nb", "•", "2lb"
  kind: 'run' | 'boundary' | 'wicket' | 'extra' | 'dot'
}

export type InningsCloseReason =
  | 'all_out'
  | 'overs'
  | 'target'
  | 'declared'
  | 'none'

export interface InningsState {
  index: number
  battingTeamId: string
  bowlingTeamId: string
  totalRuns: number
  wickets: number
  legalBalls: number
  extras: ExtrasBreakdown
  battingCard: BatterCard[]
  bowlingCard: BowlerCard[]
  fallOfWickets: FallOfWicket[]
  strikerId: string | null
  nonStrikerId: string | null
  bowlerId: string | null
  lastBowlerId: string | null
  recentBalls: RecentBall[]
  target: number | null
  isComplete: boolean
  closeReason: InningsCloseReason
  // partnership for the current pair (since last wicket)
  partnershipRuns: number
  partnershipBalls: number
  // transient: runs charged to the current bowler in the current over (maidens)
  overRunsCharged: number
}

/* ------------------------- Scorecard config ------------------------- */

export type ScorecardSection =
  | 'result'
  | 'summary'
  | 'batting'
  | 'extras'
  | 'bowling'
  | 'fallOfWickets'
  | 'partnership'
  | 'overSummary'
  | 'ballByBall'

export interface ScorecardConfig {
  showResultBanner: boolean
  showMatchSummary: boolean
  showBatting: boolean
  showBowling: boolean
  showExtras: boolean
  showFallOfWickets: boolean
  showPartnership: boolean
  showRunRate: boolean
  showRequiredRate: boolean
  showOverSummary: boolean
  showBallByBall: boolean
  showTeamColors: boolean
  sectionOrder: ScorecardSection[]
  publicVisible: boolean
}

export interface Match {
  id: string
  title: string
  tournamentId?: string | null
  tournamentName?: string | null
  format: MatchFormat
  oversPerInnings: number
  ballsPerOver: number
  teamA: MatchTeamRef
  teamB: MatchTeamRef
  squadA: string[] // playing XI playerIds
  squadB: string[]
  toss?: TossInfo | null
  battingFirstTeamId?: string | null
  /** Number of wickets that ends an innings (engine's all-out threshold minus one).
   *  Undefined on older matches — falls back to the literal squad length, exactly
   *  as before this field existed. */
  maxWickets?: number
  /** Expected playing-XI size; informational and drives the `maxWickets` default
   *  in the setup wizard, not read by the scoring engine. */
  teamSize?: number
  /** 'auto' derives `powerplayOvers` from the overs/tournament convention; 'manual'
   *  means the scorer set it explicitly. Undefined on older matches. */
  powerplayMode?: 'auto' | 'manual'
  /** Explicit powerplay length in overs. Undefined on older matches — analytics
   *  fall back to the existing per-format heuristic (see domain/insights.ts). */
  powerplayOvers?: number
  /** When true, the innings continues with a lone not-out batter (all-out
   *  threshold extends by one wicket) instead of ending at the standard count. */
  lastManStanding?: boolean
  /** Whether "retired hurt" is offered as a wicket type in the scoring UI.
   *  Undefined/true preserves existing behaviour for older matches. */
  retiredHurtEnabled?: boolean
  /** Whether tied matches are followed by a Super Over per the match/tournament rules. */
  superOverEnabled?: boolean
  /** Links this match to its Super Over (set on the original, tied match) or back to the
   *  original match it was started from (set on the Super Over match itself) — a Super
   *  Over is a normal, separate `Match` document scored through the same unmodified
   *  engine, not a special mode of this one. */
  linkedMatchId?: string | null
  venue?: string
  scheduledAt?: number | null
  scorerId?: string | null
  status: MatchStatus
  innings: InningsState[]
  currentInnings: number
  result?: MatchResult | null
  /** Knockout-bracket stage for tournaments with a knockout phase. */
  stage?: KnockoutStage | null
  playerOfTheMatchId?: string | null
  scorecardConfig: ScorecardConfig
  isPublic: boolean
  createdBy: string
  ownerId?: string // managing admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
  startedAt?: number | null
  completedAt?: number | null
  /** Soft-archived: hidden from the default Matches list/count but not deleted. */
  archived?: boolean
  /** Soft-deleted (Trash): hidden everywhere (incl. Archived tab), restorable until purged. */
  deletedAt?: number | null
  deletedBy?: string | null
}

/* --------------------------- Stats engine --------------------------- */

export interface PlayerStats {
  playerId: string
  matches: number
  // batting
  inningsBatted: number
  notOuts: number
  runs: number
  ballsFaced: number
  highScore: number
  highScoreNotOut: boolean
  fours: number
  sixes: number
  thirties: number
  fifties: number
  hundreds: number
  // bowling
  inningsBowled: number
  ballsBowled: number
  runsConceded: number
  wickets: number
  maidens: number
  bestBowlingWkts: number
  bestBowlingRuns: number
  fiveWktHauls: number
  // fielding
  catches: number
  runOuts: number
  stumpings: number
  updatedAt: number
}

export interface PlayerMatchPerformance {
  matchId: string
  matchTitle: string
  date: number
  opponent: string
  batting?: {
    runs: number
    balls: number
    fours: number
    sixes: number
    out: boolean
    dismissalText?: string
  }
  bowling?: {
    overs: string
    maidens: number
    runs: number
    wickets: number
  }
}

export interface TeamStats {
  teamId: string
  matches: number
  won: number
  lost: number
  tied: number
  noResult: number
  runsScored: number
  wicketsTaken: number
  recentForm: ('W' | 'L' | 'T' | 'N')[]
  updatedAt: number
}

/* ----------------------------- Activity ----------------------------- */

export interface ActivityLog {
  id: string
  type:
    | 'match_created'
    | 'match_started'
    | 'match_completed'
    | 'player_created'
    | 'team_created'
    | 'tournament_created'
    | 'club_created'
    | 'century'
    | 'half_century'
    | 'five_wicket_haul'
  message: string
  actorId?: string
  /** The created/affected entity's own id — lets a feed scope to one team/player/tournament/club. */
  refId?: string
  createdAt: number
}

/* -------------------------- Notifications -------------------------- */

export type NotificationCategory =
  | 'match'
  | 'tournament'
  | 'player'
  | 'admin'
  | 'account'
  | 'security'

/** In-app notification for one recipient. Written directly by whichever client
 * action triggers it (this app has no backend to dispatch these centrally). */
export interface AppNotification {
  id: string
  userId: string
  category: NotificationCategory
  title: string
  body: string
  link?: string | null
  read: boolean
  createdAt: number
}

/* ----------------------------- Settings ----------------------------- */

/** An audit-log record of a privileged / administrative action. */
export interface AuditLog {
  id: string
  action: string
  details?: string
  /** Prior/new value, for actions where a single field changed (e.g. a role or status).
   *  Free-form (string, number, or plain object) — kept simple since audit entries cover many
   *  unrelated action types. Omitted for actions with no single before/after value. */
  before?: string | number | boolean | null
  after?: string | number | boolean | null
  /** Client `navigator.userAgent` at the time of the action. IP address is deliberately not
   *  captured — this is a client-only app with no backend to observe the real request IP. */
  userAgent?: string
  actorId: string
  actorName: string
  actorRole: Role
  createdAt: number
}

/** Audit trail entry for a /recover account-recovery attempt. */
export interface RecoveryAttempt {
  id: string
  playerId?: string
  playerName: string
  outcome: 'quiz_passed' | 'quiz_failed' | 'no_quiz_available' | 'rate_limited'
  usernameRevealed: boolean
  createdAt: number
}

/** A runtime error caught by `ErrorBoundary`, logged best-effort for admin diagnostics. */
export interface ClientErrorLog {
  id: string
  referenceId: string
  message: string
  stack?: string
  route: string
  userId?: string | null
  userAgent: string
  createdAt: number
}

export type VersionedEntity = 'player' | 'team' | 'club' | 'tournament' | 'match'

/**
 * A snapshot of an entity's fields immediately *before* an edit was applied — so "restore"
 * means "write this snapshot back over the current doc." Field names, not full before/after
 * values, are stored in `changedFields` for a scannable summary; the full previous state lives
 * in `snapshot` for the actual restore.
 */
export interface EntityVersion {
  id: string
  entityType: VersionedEntity
  entityId: string
  snapshot: Record<string, unknown>
  changedFields: string[]
  editedBy?: string | null
  editedByName?: string | null
  reason?: string | null
  createdAt: number
}

/**
 * A togglable feature flag. `enabled` is the master on/off (flip to `false` for an emergency
 * disable). When `enabled`, `rolloutPercent` gates a deterministic percentage of users in (100 =
 * everyone); `betaOnly` further restricts it to users who've opted into beta features
 * (`Prefs.betaFeatures`), for staged testing before a wider rollout.
 */
export interface FeatureFlag {
  id: string // == key
  key: string
  name: string
  description?: string
  enabled: boolean
  rolloutPercent: number // 0-100
  betaOnly: boolean
  updatedAt: number
  updatedBy?: string | null
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'

/**
 * An invitation offering an existing user a role (Scorer/Team Manager/Tournament Manager/Admin),
 * requiring their explicit accept rather than an admin forcing the change immediately
 * (`users.service.ts` `setUserRoleNotified()` still exists for that direct path). This app can't
 * send real email, so "sending" an invitation means sharing its `/invite/{code}` link — doc id
 * and `code` are the same value.
 */
export interface Invitation {
  id: string // == code
  code: string
  role: Role
  invitedUid: string
  invitedUsername: string
  message?: string
  status: InvitationStatus
  createdBy: string
  createdByName: string
  createdAt: number
  expiresAt: number
  respondedAt?: number | null
}

export type TeamInvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'

/**
 * Invites an existing registered user to join a specific team's roster as a player — distinct
 * from the role-granting `Invitation` above (which offers Scorer/Manager/Admin access). Accepting
 * either links to the invitee's existing linked `Player` doc or creates a new one for them, then
 * adds it to the team's `playerIds`. Kept as its own collection/service rather than folding into
 * `Invitation` to avoid any risk to that already-verified role-grant flow.
 */
export interface TeamInvitation {
  id: string // == code
  code: string
  teamId: string
  teamName: string
  invitedUid: string
  invitedUsername: string
  message?: string
  status: TeamInvitationStatus
  createdBy: string
  createdByName: string
  createdAt: number
  expiresAt: number
  respondedAt?: number | null
}

export const REACTION_EMOJIS = ['🔥', '👏', '😮', '💔'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

/** One user's tap-reactions on a match — doc id is the reacting user's uid, subcollection
 *  under `matches/{id}/reactions`. Aggregate counts are computed client-side from the full list
 *  (low cardinality per match) rather than maintained as separate counters. */
export interface MatchReaction {
  id: string // == userId
  matchId: string
  userId: string
  emojis: ReactionEmoji[]
  updatedAt: number
}

/** A spectator comment on a match — flat (not threaded), matches the platform's
 *  amateur/semi-pro scope rather than a full discussion-thread system. */
export interface MatchComment {
  id: string
  matchId: string
  authorId: string
  authorName: string
  authorPhotoURL?: string | null
  text: string
  createdAt: number
}

/** A tournament-scoped announcement post, shown on the public tournament page. */
export interface Announcement {
  id: string
  tournamentId: string
  title: string
  body: string
  pinned: boolean
  createdBy: string
  createdByName: string
  createdAt: number
  ownerId?: string // copied from the tournament's ownerId at creation, for owner-scoped rules
}

/** A user's request to be granted ADMIN access (to run a tournament). */
export interface AdminRequest {
  id: string
  uid: string
  username: string
  displayName: string
  tournamentName: string
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
  decidedAt?: number | null
  decidedBy?: string | null
}

/** Site-wide maintenance gate. When `enabled`, every signed-in/public visitor except the master
 *  admin sees a maintenance screen instead of the app. */
export interface MaintenanceConfig {
  enabled: boolean
  message: string
  /** Optional ETA shown on the maintenance screen; purely informational, nothing waits on it. */
  estimatedEndAt: number | null
}

export interface AppSettings {
  appName: string
  defaultScorecardConfig: ScorecardConfig
  defaultPublicMatches: boolean
  defaultOvers: number
  /** Days a soft-deleted item stays in Trash before "Purge expired" removes it for good. */
  trashRetentionDays: number
  maintenance: MaintenanceConfig
  updatedAt: number
}

/* -------------------------- Data integrity -------------------------- */

export type IntegrityIssueType =
  | 'orphaned_roster_entry' // team.playerIds references a player that no longer exists at all
  | 'broken_captain_ref' // team.captainId/viceCaptainId points outside its own roster
  | 'orphaned_tournament_team' // tournament.teamIds references a team that no longer exists at all
  | 'broken_club_ref' // team/tournament.clubId points to a club that no longer exists at all
  | 'broken_season_ref' // tournament.seasonId points to a season that no longer exists at all
  | 'orphaned_player_stats' // playerStats/{id} with no matching player doc at all
  | 'orphaned_team_stats' // teamStats/{id} with no matching team doc at all
  | 'dangling_match_squad_ref' // match squad references a player that no longer exists at all (informational — match data is never auto-rewritten)

/** One detected data-integrity problem, found by `domain/dataIntegrity.ts`. */
export interface IntegrityIssue {
  /** Stable key so the same issue re-scans to the same id (`type:entityId[:extra]`). */
  id: string
  type: IntegrityIssueType
  /** `repairable` issues have a safe one-click fix; `informational` ones are reported only —
   *  typically because "fixing" them would mean rewriting historical match/scoring data. */
  severity: 'repairable' | 'informational'
  entityType: 'team' | 'tournament' | 'match' | 'playerStats' | 'teamStats'
  entityId: string
  label: string
  description: string
}

/* -------------------------- Subscriptions / entitlements (ROADMAP_V5 Phase C) --------------------
 * Architecture only — no real payment provider is connected yet (see billing.types.ts). Every
 * subscription in this codebase today has provider: 'mock', created by MockBillingProvider's
 * simulated checkout, never a real charge. */

export type PlanTier = 'free' | 'premium'

export type SubscriptionStatus =
  | 'none' // never subscribed — the implicit default, most users never get a Subscription doc at all
  | 'active'
  | 'canceled' // canceled but the doc is kept for history; effectiveTier() still reads 'free'
  | 'past_due' // a real provider would set this on a failed renewal charge; unused by the mock

/** Which billing backend wrote this doc.
 *  - 'mock'   — MockBillingProvider's simulated checkout (the only "purchase" path today).
 *  - 'manual' — a master-admin comp grant written straight to Firestore (Users & Roles → plan),
 *               bypassing billing entirely. Persisted; distinguished so admin UI can show the
 *               access came from an admin action, not a payment.
 *  - 'comp'   — the master admin's own role-derived premium. Synthetic, NEVER written to
 *               Firestore (see `masterAdminSubscription()`); only ever appears in memory.
 *  Real providers (Stripe, Razorpay, …) are a later, separate decision; see billing.types.ts. */
export type BillingProviderId = 'mock' | 'manual' | 'comp'

/** Doc id == uid, one per user, in the `subscriptions` collection (mirrors `userPrefs`). */
export interface Subscription {
  uid: string
  tier: PlanTier
  status: SubscriptionStatus
  provider: BillingProviderId
  providerCustomerId?: string
  providerSubscriptionId?: string
  currentPeriodEnd?: number | null
  cancelAtPeriodEnd?: boolean
  createdAt: number
  updatedAt: number
}

/** A gateable feature's registration. The `key` is what call sites pass to `hasEntitlement()`/
 *  `<PremiumGate>`; `tier` is the minimum plan required. See `domain/entitlements.ts`'s
 *  `PREMIUM_FEATURES` for the actual registry. */
export interface PremiumFeatureDef {
  key: string
  name: string
  /** Customer-facing copy — rendered verbatim in `<PremiumGate>`'s upsell card. Never put a
   *  file path, component name, or other implementation detail here; that belongs in a `//`
   *  comment on the registry entry instead, which can't leak into the UI. */
  description: string
  tier: Exclude<PlanTier, 'free'>
}

/* ==================================================================
 * Media/Broadcast engine — live streaming, live recording, replay,
 * uploaded match videos, clips, ball-to-video.
 *
 * Architecture (see CHANGELOG for the full writeup): the browser camera
 * streams peer-to-peer over WebRTC directly to each connected spectator's
 * browser, using Firestore only as the signaling channel (SDP offer/answer +
 * ICE candidates) — there is no media server. This is genuinely live video,
 * not a simulation, but it means: (a) it's a mesh, not a broadcast — the
 * scorer's own device uploads one stream per connected viewer, which is
 * fine for a spectator count in the tens, not thousands; (b) the live
 * stream only exists while the broadcaster's tab stays open+connected —
 * there is no server-side relay to fall back to without a paid media
 * provider (Cloudflare Stream / WHIP-WHEP SFU etc.), which this project
 * has no account for. The recording is captured client-side (MediaRecorder
 * on the broadcaster's own outgoing stream) and uploaded once the broadcast
 * ends, so it keeps recording through viewers coming and going — but it is
 * NOT independent of the broadcaster's own device stalling before upload.
 * ================================================================== */

export type BroadcastStatus =
  | 'not_started'
  | 'starting'
  | 'live'
  | 'reconnecting'
  | 'paused'
  | 'ending'
  | 'ended'
  | 'failed'

export type RecordingStatus =
  | 'not_started'
  | 'starting'
  | 'recording'
  | 'finalizing'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'deleted'

/** One broadcaster-controlled live session for a match. Doc id == matchId (one live broadcast
 *  at a time per match). WebRTC signaling for each viewer lives in the `viewers` subcollection. */
export interface Broadcast {
  matchId: string
  status: BroadcastStatus
  broadcasterUid: string
  broadcasterName: string
  startedAt?: number | null
  endedAt?: number | null
  /** Count of viewer signaling docs currently connected — best-effort, derived from live
   *  peer-connection state, never shown as a precise "analytics" figure. */
  viewerCount: number
  recording: {
    status: RecordingStatus
    /** Set once the finished recording has been uploaded and a MatchVideo doc created. */
    videoId?: string | null
    startedAt?: number | null
    endedAt?: number | null
    /** Seconds — only set once the recording Blob exists (finalizing/processing/ready). */
    durationSec?: number | null
    error?: string | null
  }
  error?: string | null
  updatedAt: number
}

/** One signaling handshake between the broadcaster and a single connecting viewer.
 *  Subcollection: `broadcasts/{matchId}/viewers/{viewerConnId}`. ICE candidates are exchanged
 *  through the nested `broadcasterCandidates`/`viewerCandidates` subcollections. */
export interface BroadcastViewerConn {
  id: string
  viewerUid?: string | null
  offer: { type: string; sdp: string }
  answer?: { type: string; sdp: string } | null
  createdAt: number
  connectedAt?: number | null
}

export type VideoKind = 'live_recording' | 'uploaded'
export type VideoVisibility = 'public' | 'unlisted' | 'private'

/** A playable video attached to a match — either finalized from a live broadcast's recording,
 *  or directly uploaded after the fact. Never references a video whose file doesn't exist:
 *  status stays out of 'ready' until the upload has actually completed. */
export interface MatchVideo {
  id: string
  matchId: string
  kind: VideoKind
  status: RecordingStatus
  url?: string | null
  thumbnailURL?: string | null
  durationSec?: number | null
  visibility: VideoVisibility
  broadcastId?: string | null // == matchId of the Broadcast this was recorded from, if any
  title?: string
  createdBy: string
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

/** A saved time-range bookmark into a `MatchVideo` — plays back by seeking the source video,
 *  not a separately rendered/transcoded file (no server-side video processing exists in this
 *  project without a paid provider, so this never fakes a "rendering" step). */
export interface Clip {
  id: string
  matchId: string
  videoId: string
  title: string
  startSec: number
  endSec: number
  /** Ball-to-video link: the delivery this clip was created from, if any. */
  deliveryId?: string | null
  createdBy: string
  createdAt: number
}

/* ==================================================================
 * Discovery + Looking For + Community engine
 * ================================================================== */

export type LookingForKind =
  | 'player'
  | 'team'
  | 'opponent'
  | 'umpire'
  | 'scorer'

export type LookingForStatus = 'open' | 'closed' | 'expired'

/** A single "Looking For X" post — one unified shape for every kind listed above rather than
 *  five separate collections, per the platform brief's explicit "don't build five unrelated
 *  systems" instruction. */
export interface LookingForPost {
  id: string
  kind: LookingForKind
  title: string
  description: string
  location?: string
  format?: MatchFormat | 'any'
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'any'
  date?: number | null
  teamId?: string | null
  teamName?: string | null
  tournamentId?: string | null
  tournamentName?: string | null
  status: LookingForStatus
  createdBy: string
  createdByName: string
  expiresAt: number
  responseCount: number
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export type LookingForResponseStatus = 'pending' | 'accepted' | 'declined'

/** One respondent's interest in a `LookingForPost`. */
export interface LookingForResponse {
  id: string
  postId: string
  responderId: string
  responderName: string
  message?: string
  status: LookingForResponseStatus
  createdAt: number
}

export type FollowTargetType = 'player' | 'team' | 'club' | 'tournament'

/** One user following one entity. Doc id is `${followerUid}_${targetType}_${targetId}` so a
 *  duplicate follow is naturally idempotent (setDoc with that id, no query needed to check). */
export interface Follow {
  id: string
  followerId: string
  targetType: FollowTargetType
  targetId: string
  createdAt: number
}

export type PostKind = 'text' | 'match' | 'achievement' | 'announcement' | 'poll'

export interface PollOption {
  id: string
  text: string
  votes: number
}

/** One community feed post. Kept flat (no nested comment threads beyond the existing
 *  match-scoped `comments` collection) to match the amateur/semi-pro scope of this platform. */
export interface CommunityPost {
  id: string
  kind: PostKind
  authorId: string
  authorName: string
  authorPhotoURL?: string | null
  text: string
  imageURL?: string | null
  /** Set when kind == 'match' — links the post back to the match it's about. */
  matchId?: string | null
  matchTitle?: string | null
  pollOptions?: PollOption[]
  /** Doc id of each user who voted, when kind == 'poll' — prevents double-voting. */
  pollVoterIds?: string[]
  likeCount: number
  commentCount: number
  createdBy: string
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

/** One user's like on a `CommunityPost`. Doc id == `${postId}_${userId}`, same idempotent
 *  pattern as `Follow`. */
export interface PostLike {
  id: string
  postId: string
  userId: string
  createdAt: number
}

export type ReportTargetType = 'post' | 'comment' | 'user' | 'looking_for'

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned'

/** A user-submitted report against another piece of content, for master-admin moderation. */
export interface ContentReport {
  id: string
  targetType: ReportTargetType
  targetId: string
  reason: string
  reporterId: string
  status: ReportStatus
  createdAt: number
  reviewedAt?: number | null
  reviewedBy?: string | null
}
