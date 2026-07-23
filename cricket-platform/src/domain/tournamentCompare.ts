import type { Match } from '@/types'

export interface TournamentCompareStats {
  teams: number
  matches: number
  completedMatches: number
  runsScored: number
  wicketsTaken: number
}

/** Rolls up every match played within one tournament. */
export function aggregateTournamentStats(
  tournamentId: string,
  matches: Match[],
): TournamentCompareStats {
  const tMatches = matches.filter((m) => m.tournamentId === tournamentId)

  const teamIds = new Set<string>()
  let completedMatches = 0
  let runsScored = 0
  let wicketsTaken = 0
  for (const m of tMatches) {
    teamIds.add(m.teamA.id)
    teamIds.add(m.teamB.id)
    if (m.status === 'completed') completedMatches++
    for (const inn of m.innings) {
      runsScored += inn.totalRuns
      wicketsTaken += inn.wickets
    }
  }

  return {
    teams: teamIds.size,
    matches: tMatches.length,
    completedMatches,
    runsScored,
    wicketsTaken,
  }
}
