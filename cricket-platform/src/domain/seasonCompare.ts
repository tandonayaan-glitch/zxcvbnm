import type { Match, Tournament } from '@/types'

export interface SeasonCompareStats {
  tournaments: number
  teams: number
  matches: number
  completedMatches: number
  runsScored: number
  wicketsTaken: number
}

/** Rolls up every match played within any tournament that belongs to a season. */
export function aggregateSeasonStats(
  seasonId: string,
  tournaments: Tournament[],
  matches: Match[],
): SeasonCompareStats {
  const seasonTournaments = tournaments.filter((t) => t.seasonId === seasonId)
  const tournamentIds = new Set(seasonTournaments.map((t) => t.id))
  const seasonMatches = matches.filter(
    (m) => !!m.tournamentId && tournamentIds.has(m.tournamentId),
  )

  const teamIds = new Set<string>()
  let completedMatches = 0
  let runsScored = 0
  let wicketsTaken = 0
  for (const m of seasonMatches) {
    teamIds.add(m.teamA.id)
    teamIds.add(m.teamB.id)
    if (m.status === 'completed') completedMatches++
    for (const inn of m.innings) {
      runsScored += inn.totalRuns
      wicketsTaken += inn.wickets
    }
  }

  return {
    tournaments: seasonTournaments.length,
    teams: teamIds.size,
    matches: seasonMatches.length,
    completedMatches,
    runsScored,
    wicketsTaken,
  }
}
