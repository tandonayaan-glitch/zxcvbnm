import type { Match } from '@/types'

export type FormOutcome = 'W' | 'L' | 'T' | 'N'

export interface TeamMatchResult {
  matchId: string
  outcome: FormOutcome
  opponentShort: string
  date: number
  summary: string
}

/** Result of a single match from one team's perspective. */
export function teamOutcome(match: Match, teamId: string): FormOutcome {
  const r = match.result
  if (!r) return 'N'
  if (r.outcome === 'tie') return 'T'
  if (r.outcome === 'win') return r.winnerTeamId === teamId ? 'W' : 'L'
  return 'N' // no_result / abandoned
}

/** Completed matches for a team, newest first, tagged with W/L/T/N. */
export function teamResults(matches: Match[], teamId: string): TeamMatchResult[] {
  return matches
    .filter(
      (m) =>
        (m.teamA.id === teamId || m.teamB.id === teamId) &&
        m.status === 'completed',
    )
    .sort(
      (a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt),
    )
    .map((m) => ({
      matchId: m.id,
      outcome: teamOutcome(m, teamId),
      opponentShort: m.teamA.id === teamId ? m.teamB.shortName : m.teamA.shortName,
      date: m.completedAt ?? m.scheduledAt ?? m.createdAt,
      summary: m.result?.summary ?? '',
    }))
}

export interface TeamRecord {
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  /** Win % over decided matches (excludes no-results). */
  winPct: number
}

export function teamRecord(results: TeamMatchResult[]): TeamRecord {
  const won = results.filter((r) => r.outcome === 'W').length
  const lost = results.filter((r) => r.outcome === 'L').length
  const tied = results.filter((r) => r.outcome === 'T').length
  const noResult = results.filter((r) => r.outcome === 'N').length
  const decided = won + lost + tied
  return {
    played: results.length,
    won,
    lost,
    tied,
    noResult,
    winPct: decided > 0 ? Math.round((won / decided) * 100) : 0,
  }
}
