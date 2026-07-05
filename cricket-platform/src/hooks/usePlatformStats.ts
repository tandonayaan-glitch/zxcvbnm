import { useMemo } from 'react'
import { useAsync } from './useAsync'
import { listAllMatches } from '@/services/matches.service'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import {
  aggregatePlayerStats,
  aggregateTeamStats,
  buildLeaderboards,
} from '@/domain/stats'
import type { Match, Player, Team } from '@/types'

/**
 * Loads matches + players + teams once and derives platform-wide stats and
 * leaderboards. Used by the Stats page, Players dashboard and home widgets.
 */
export function usePlatformStats() {
  const matches = useAsync(listAllMatches, [])
  const players = useAsync(listPlayers, [])
  const teams = useAsync(listTeams, [])

  const loading = matches.loading || players.loading || teams.loading

  const playerMap = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p] as [string, Player])),
    [players.data],
  )
  const teamMap = useMemo(
    () => new Map((teams.data ?? []).map((t) => [t.id, t] as [string, Team])),
    [teams.data],
  )
  const playerStats = useMemo(
    () => aggregatePlayerStats(matches.data ?? []),
    [matches.data],
  )
  const teamStats = useMemo(
    () => aggregateTeamStats(matches.data ?? []),
    [matches.data],
  )
  const leaderboards = useMemo(
    () => buildLeaderboards(playerStats),
    [playerStats],
  )

  return {
    loading,
    matches: (matches.data ?? []) as Match[],
    players: (players.data ?? []) as Player[],
    teams: (teams.data ?? []) as Team[],
    playerMap,
    teamMap,
    playerStats,
    teamStats,
    leaderboards,
    refetch: () => {
      matches.refetch()
      players.refetch()
      teams.refetch()
    },
  }
}
