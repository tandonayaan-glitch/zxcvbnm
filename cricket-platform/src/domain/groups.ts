/* ==================================================================
 * Group tables — splits a group_knockout tournament's teams into their
 * assigned groups and reuses computeStandings per group. Pure; a team
 * with no group assignment is simply omitted (so partially-configured
 * tournaments degrade gracefully rather than erroring).
 * ================================================================== */
import type { Match, StandingsRow, Team } from '@/types'
import { computeStandings } from './stats'

export interface GroupStandings {
  group: string
  rows: StandingsRow[]
}

export function groupStandings(
  teamGroups: Record<string, string> | undefined,
  teamIds: string[],
  teams: Team[],
  matches: Match[],
): GroupStandings[] {
  if (!teamGroups) return []
  const byGroup = new Map<string, string[]>()
  for (const id of teamIds) {
    const group = teamGroups[id]?.trim()
    if (!group) continue
    const ids = byGroup.get(group) ?? []
    ids.push(id)
    byGroup.set(group, ids)
  }
  return [...byGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, ids]) => ({ group, rows: computeStandings(ids, teams, matches) }))
}
