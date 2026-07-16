import type { Match, Team } from '@/types'
import { aggregateTeamStats } from './stats'

export interface ClubCompareStats {
  teams: number
  matches: number
  won: number
  lost: number
  tied: number
  winPct: number
  runsScored: number
  wicketsTaken: number
}

/** Sums each of a club's teams' `TeamStats` (from `aggregateTeamStats`) into one club-level row. */
export function aggregateClubStats(
  clubId: string,
  teams: Team[],
  matches: Match[],
): ClubCompareStats {
  const teamStats = aggregateTeamStats(matches)
  const clubTeams = teams.filter((t) => t.clubId === clubId)

  let matchesCount = 0
  let won = 0
  let lost = 0
  let tied = 0
  let runsScored = 0
  let wicketsTaken = 0
  for (const t of clubTeams) {
    const s = teamStats.get(t.id)
    if (!s) continue
    matchesCount += s.matches
    won += s.won
    lost += s.lost
    tied += s.tied
    runsScored += s.runsScored
    wicketsTaken += s.wicketsTaken
  }
  const decided = won + lost + tied

  return {
    teams: clubTeams.length,
    matches: matchesCount,
    won,
    lost,
    tied,
    winPct: decided > 0 ? Math.round((won / decided) * 100) : 0,
    runsScored,
    wicketsTaken,
  }
}
