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

export type UserStatus = 'active' | 'banned'

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
  ownerId?: string // managing admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
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
  ownerId?: string // managing admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
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
  ownerId?: string // owning admin (uid); master admin sees all
  createdAt: number
  updatedAt: number
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
  message: string
  actorId?: string
  refId?: string
  createdAt: number
}

/* ----------------------------- Settings ----------------------------- */

/** An audit-log record of a privileged / administrative action. */
export interface AuditLog {
  id: string
  action: string
  details?: string
  actorId: string
  actorName: string
  actorRole: Role
  createdAt: number
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

export interface AppSettings {
  appName: string
  defaultScorecardConfig: ScorecardConfig
  defaultPublicMatches: boolean
  defaultOvers: number
  updatedAt: number
}
