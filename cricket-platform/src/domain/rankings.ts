/* ==================================================================
 * Rankings engine — pure. Builds filterable player/team rankings from real
 * completed-match data, reusing the platform's existing, verified
 * aggregation (`domain/stats.ts`) rather than a second scoring model.
 *
 * Location filtering uses `Player.location`, a plain optional string players
 * set themselves — a player with no location set is simply excluded from a
 * location-filtered view rather than guessed at.
 * ================================================================== */
import { aggregatePlayerStats, buildLeaderboards, type Leaderboard } from './stats'
import type { Match, Player, MatchFormat } from '@/types'

export interface RankingFilters {
  format?: MatchFormat | 'all'
  tournamentId?: string | 'all'
  seasonTournamentIds?: string[] // tournaments belonging to a chosen season, or undefined = no season filter
  location?: string | 'all'
}

/** Narrows completed matches by format/tournament/season, and (via a player-id set) by location —
 *  the location filter has to apply after stats are aggregated per player, so it isn't done here;
 *  see `filterLeaderboardsByLocation`. */
export function filterMatchesForRankings(matches: Match[], filters: RankingFilters): Match[] {
  return matches.filter((m) => {
    if (m.status !== 'completed') return false
    if (filters.format && filters.format !== 'all' && m.format !== filters.format) return false
    if (filters.tournamentId && filters.tournamentId !== 'all' && m.tournamentId !== filters.tournamentId) return false
    if (filters.seasonTournamentIds && !filters.seasonTournamentIds.includes(m.tournamentId ?? '')) return false
    return true
  })
}

export function buildRankings(matches: Match[], filters: RankingFilters, limit = 25): Leaderboard[] {
  const filtered = filterMatchesForRankings(matches, filters)
  const stats = aggregatePlayerStats(filtered)
  return buildLeaderboards(stats, limit)
}

/** Restricts an already-built set of leaderboards to players whose `Player.location` matches
 *  (case-insensitive substring) — applied as a UI-layer filter over rows rather than reworking
 *  `buildLeaderboards`, since location lives on `Player`, not in the match/ball data those
 *  functions read. */
export function filterLeaderboardsByLocation(
  boards: Leaderboard[],
  players: Player[],
  location: string,
): Leaderboard[] {
  if (!location || location === 'all') return boards
  const q = location.toLowerCase()
  const allowedIds = new Set(
    players.filter((p) => (p.location ?? '').toLowerCase().includes(q)).map((p) => p.id),
  )
  return boards
    .map((b) => ({ ...b, rows: b.rows.filter((r) => allowedIds.has(r.playerId)) }))
    .filter((b) => b.rows.length > 0)
}

/** Distinct, real location strings players have actually entered — never a hardcoded city list. */
export function knownLocations(players: Player[]): string[] {
  const set = new Set<string>()
  for (const p of players) {
    if (p.location?.trim()) set.add(p.location.trim())
  }
  return [...set].sort()
}

export interface ScorerLeaderRow {
  uid: string
  matchesScored: number
  completedMatchesScored: number
}

/** Real, derived-only scorer leaderboard: counts of matches each account has actually been
 *  assigned as `scorerId`/`createdBy` on, across every match this viewer can see. No separate
 *  "activity score" is invented — just the two real counts. */
export function buildScorerLeaderboard(matches: Match[]): ScorerLeaderRow[] {
  const counts = new Map<string, ScorerLeaderRow>()
  for (const m of matches) {
    const uid = m.scorerId ?? m.createdBy
    if (!uid) continue
    const row = counts.get(uid) ?? { uid, matchesScored: 0, completedMatchesScored: 0 }
    row.matchesScored += 1
    if (m.status === 'completed') row.completedMatchesScored += 1
    counts.set(uid, row)
  }
  return [...counts.values()].sort((a, b) => b.completedMatchesScored - a.completedMatchesScored)
}
