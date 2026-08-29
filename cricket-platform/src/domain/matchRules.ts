/** Pure helpers for the Match Setup Wizard's "Match Rules" step and live scoring. No I/O. */
import type { InningsState, Match } from '@/types'

export const DEFAULT_TEAM_SIZE = 11

/**
 * Auto powerplay length in overs, following common conventions:
 * 5 overs → 1, 6–10 → 2, 11–20 → 6. Beyond 20 overs there's no single
 * convention, so the tournament's configured default is used when present,
 * falling back to a 10-over ODI-style powerplay otherwise.
 */
export function computeAutoPowerplayOvers(
  totalOvers: number,
  tournamentDefault?: number,
): number {
  if (totalOvers <= 5) return Math.min(1, totalOvers)
  if (totalOvers <= 10) return Math.min(2, totalOvers)
  if (totalOvers <= 20) return Math.min(6, totalOvers)
  return Math.min(tournamentDefault ?? 10, totalOvers)
}

/** Standard all-out threshold for a given playing-XI size (one fewer than the squad). */
export function defaultMaxWickets(teamSize: number): number {
  return Math.max(1, teamSize - 1)
}

/**
 * The number of powerplay overs actually in force for a match, resolving the two setup modes:
 *  - 'manual' / explicit — whatever `powerplayOvers` was saved (0 disables it entirely).
 *  - 'auto' with a missing value (older matches) — derived from the format's total overs.
 * Always clamped to the innings length, and never negative.
 */
export function resolvePowerplayOvers(match: Match): number {
  const total = match.oversPerInnings
  const explicit = match.powerplayOvers
  if (explicit != null) return Math.max(0, Math.min(explicit, total))
  if (match.powerplayMode === 'auto') {
    return computeAutoPowerplayOvers(total)
  }
  return 0
}

export type PowerplayPhase = 'active' | 'complete' | 'none'

export interface PowerplayState {
  /** Whether a powerplay is configured for this match at all (overs > 0). */
  enabled: boolean
  mode: 'auto' | 'manual'
  /** Powerplay length, in overs. */
  totalOvers: number
  phase: PowerplayPhase
  /** Completed overs so far this innings (uncapped). */
  oversBowled: number
  /** Powerplay overs still to come (0 once complete). */
  oversRemaining: number
  /** Legal balls bowled within the powerplay window so far (for a progress indicator). */
  ballsBowledInPowerplay: number
  /** Total legal balls the powerplay spans. */
  ballsInPowerplay: number
}

/**
 * Live powerplay state for the innings currently being scored, derived purely from the ball
 * count — the scorer never activates or ends it by hand. Boundaries advance automatically as
 * overs complete because `innings.legalBalls` is the only input that changes. Uses the same
 * "opening overs 1..N" convention as `domain/insights.ts` (`d.overNumber < ppOvers`, 0-based).
 * When no powerplay is configured, `phase` is `'none'` and nothing downstream should react to it.
 */
export function powerplayState(
  match: Match,
  innings: InningsState | undefined,
): PowerplayState {
  const totalOvers = resolvePowerplayOvers(match)
  const mode: 'auto' | 'manual' = match.powerplayMode ?? 'manual'
  const ballsPerOver = Math.max(1, match.ballsPerOver)
  const legalBalls = innings?.legalBalls ?? 0
  const oversBowled = Math.floor(legalBalls / ballsPerOver)
  const enabled = totalOvers > 0
  const ballsInPowerplay = totalOvers * ballsPerOver
  const ballsBowledInPowerplay = Math.min(legalBalls, ballsInPowerplay)

  let phase: PowerplayPhase = 'none'
  if (enabled) phase = oversBowled >= totalOvers ? 'complete' : 'active'

  return {
    enabled,
    mode,
    totalOvers,
    phase,
    oversBowled,
    oversRemaining: Math.max(0, totalOvers - oversBowled),
    ballsBowledInPowerplay,
    ballsInPowerplay,
  }
}
