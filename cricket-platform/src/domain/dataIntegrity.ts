import type { IntegrityIssue, Match, Team, Tournament } from '@/types'

export interface IntegrityScanInput {
  teams: Team[]
  tournaments: Tournament[]
  matches: Match[]
  /** Every id that exists at all (active + trashed) — trashed docs are hidden, not broken. */
  playerIds: Set<string>
  teamIds: Set<string>
  clubIds: Set<string>
  seasonIds: Set<string>
  playerStatsIds: string[]
  teamStatsIds: string[]
}

/**
 * Pure scan over already-fetched data — no I/O here, matching this codebase's domain/services
 * split. `services/dataIntegrity.service.ts` does the fetching and calls this.
 *
 * Only flags references to ids that don't exist *at all* (never existed, or hard-deleted).
 * A reference to a *soft-deleted* (trashed) doc is not a bug — trashed docs still exist and are
 * restorable, and this app already treats "referenced player/team doc can vanish, readers fall
 * back gracefully" as a standing convention (see CLAUDE.md). Match-level references are reported
 * as informational only, never auto-repaired — rewriting historical scorecards is exactly the
 * kind of destructive "fix" this tool must not perform.
 */
export function findIntegrityIssues(input: IntegrityScanInput): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []

  for (const team of input.teams) {
    for (const playerId of team.playerIds) {
      if (!input.playerIds.has(playerId)) {
        issues.push({
          id: `orphaned_roster_entry:${team.id}:${playerId}`,
          type: 'orphaned_roster_entry',
          severity: 'repairable',
          entityType: 'team',
          entityId: team.id,
          label: team.name,
          description: `Roster includes a player id ("${playerId}") that no longer exists.`,
        })
      }
    }
    if (team.captainId && !team.playerIds.includes(team.captainId)) {
      issues.push({
        id: `broken_captain_ref:${team.id}:captain`,
        type: 'broken_captain_ref',
        severity: 'repairable',
        entityType: 'team',
        entityId: team.id,
        label: team.name,
        description: 'Captain is not (or no longer) in the roster.',
      })
    }
    if (team.viceCaptainId && !team.playerIds.includes(team.viceCaptainId)) {
      issues.push({
        id: `broken_captain_ref:${team.id}:vice_captain`,
        type: 'broken_captain_ref',
        severity: 'repairable',
        entityType: 'team',
        entityId: team.id,
        label: team.name,
        description: 'Vice-captain is not (or no longer) in the roster.',
      })
    }
    if (team.clubId && !input.clubIds.has(team.clubId)) {
      issues.push({
        id: `broken_club_ref:team:${team.id}`,
        type: 'broken_club_ref',
        severity: 'repairable',
        entityType: 'team',
        entityId: team.id,
        label: team.name,
        description: 'Linked club no longer exists.',
      })
    }
  }

  for (const tournament of input.tournaments) {
    for (const teamId of tournament.teamIds) {
      if (!input.teamIds.has(teamId)) {
        issues.push({
          id: `orphaned_tournament_team:${tournament.id}:${teamId}`,
          type: 'orphaned_tournament_team',
          severity: 'repairable',
          entityType: 'tournament',
          entityId: tournament.id,
          label: tournament.name,
          description: `Includes a team id ("${teamId}") that no longer exists.`,
        })
      }
    }
    if (tournament.clubId && !input.clubIds.has(tournament.clubId)) {
      issues.push({
        id: `broken_club_ref:tournament:${tournament.id}`,
        type: 'broken_club_ref',
        severity: 'repairable',
        entityType: 'tournament',
        entityId: tournament.id,
        label: tournament.name,
        description: 'Linked club no longer exists.',
      })
    }
    if (tournament.seasonId && !input.seasonIds.has(tournament.seasonId)) {
      issues.push({
        id: `broken_season_ref:${tournament.id}`,
        type: 'broken_season_ref',
        severity: 'repairable',
        entityType: 'tournament',
        entityId: tournament.id,
        label: tournament.name,
        description: 'Linked season no longer exists.',
      })
    }
  }

  for (const id of input.playerStatsIds) {
    if (!input.playerIds.has(id)) {
      issues.push({
        id: `orphaned_player_stats:${id}`,
        type: 'orphaned_player_stats',
        severity: 'repairable',
        entityType: 'playerStats',
        entityId: id,
        label: id,
        description: 'Cached stats for a player that no longer exists.',
      })
    }
  }
  for (const id of input.teamStatsIds) {
    if (!input.teamIds.has(id)) {
      issues.push({
        id: `orphaned_team_stats:${id}`,
        type: 'orphaned_team_stats',
        severity: 'repairable',
        entityType: 'teamStats',
        entityId: id,
        label: id,
        description: 'Cached stats for a team that no longer exists.',
      })
    }
  }

  for (const match of input.matches) {
    const missing = new Set(
      [...match.squadA, ...match.squadB].filter((id) => !input.playerIds.has(id)),
    )
    for (const playerId of missing) {
      issues.push({
        id: `dangling_match_squad_ref:${match.id}:${playerId}`,
        type: 'dangling_match_squad_ref',
        severity: 'informational',
        entityType: 'match',
        entityId: match.id,
        label: `${match.teamA.shortName} vs ${match.teamB.shortName}`,
        description: `Squad includes a player id ("${playerId}") that no longer exists — scorecard is unaffected, this is historical data.`,
      })
    }
  }

  return issues
}
