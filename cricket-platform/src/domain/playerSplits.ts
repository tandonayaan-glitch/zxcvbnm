/* ==================================================================
 * Player tournament splits — the same career aggregation, but bucketed
 * by the tournament each match belongs to. Reuses aggregatePlayerStats
 * so a split row is identical in meaning to the career figures. Pure;
 * reads the tournament name denormalised on each match, so it survives a
 * deleted Tournament doc.
 * ================================================================== */
import type { Match, PlayerStats } from '@/types'
import { aggregatePlayerStats } from './stats'

export interface TournamentSplit {
  /** null for matches that aren't part of any tournament. */
  tournamentId: string | null
  tournamentName: string
  stats: PlayerStats
}

const NO_TOURNAMENT = '__none__'

export function playerTournamentSplits(
  playerId: string,
  matches: Match[],
): TournamentSplit[] {
  const groups = new Map<string, { name: string; matches: Match[] }>()
  for (const m of matches) {
    if (m.status !== 'completed') continue
    if (!m.squadA.includes(playerId) && !m.squadB.includes(playerId)) continue
    const key = m.tournamentId ?? NO_TOURNAMENT
    const name = m.tournamentId
      ? (m.tournamentName ?? 'Tournament')
      : 'Other matches'
    let g = groups.get(key)
    if (!g) {
      g = { name, matches: [] }
      groups.set(key, g)
    }
    g.matches.push(m)
  }

  const out: TournamentSplit[] = []
  for (const [key, g] of groups) {
    const stats = aggregatePlayerStats(g.matches).get(playerId)
    if (!stats) continue
    out.push({
      tournamentId: key === NO_TOURNAMENT ? null : key,
      tournamentName: g.name,
      stats,
    })
  }

  // Most-played first; keep non-tournament matches ("Other") last.
  return out.sort((a, b) => {
    if (!a.tournamentId && b.tournamentId) return 1
    if (a.tournamentId && !b.tournamentId) return -1
    return (
      b.stats.matches - a.stats.matches ||
      a.tournamentName.localeCompare(b.tournamentName)
    )
  })
}

/* ------------------------------------------------------------------
 * Season splits — the same idea, bucketed by season instead. A match
 * only has a tournamentId, not a seasonId directly, so the caller
 * supplies a tournamentId -> seasonId lookup (built from the
 * tournaments collection) plus a seasonId -> name lookup.
 * ------------------------------------------------------------------ */
export interface SeasonSplit {
  /** null for matches whose tournament has no season (or has no tournament). */
  seasonId: string | null
  seasonName: string
  stats: PlayerStats
}

const NO_SEASON = '__none__'

export function playerSeasonSplits(
  playerId: string,
  matches: Match[],
  seasonIdByTournamentId: Map<string, string | null | undefined>,
  seasonNameById: Map<string, string>,
): SeasonSplit[] {
  const groups = new Map<string, { name: string; matches: Match[] }>()
  for (const m of matches) {
    if (m.status !== 'completed') continue
    if (!m.squadA.includes(playerId) && !m.squadB.includes(playerId)) continue
    const seasonId = m.tournamentId
      ? (seasonIdByTournamentId.get(m.tournamentId) ?? null)
      : null
    const key = seasonId ?? NO_SEASON
    const name = seasonId ? (seasonNameById.get(seasonId) ?? 'Season') : 'No season'
    let g = groups.get(key)
    if (!g) {
      g = { name, matches: [] }
      groups.set(key, g)
    }
    g.matches.push(m)
  }

  const out: SeasonSplit[] = []
  for (const [key, g] of groups) {
    const stats = aggregatePlayerStats(g.matches).get(playerId)
    if (!stats) continue
    out.push({
      seasonId: key === NO_SEASON ? null : key,
      seasonName: g.name,
      stats,
    })
  }

  return out.sort((a, b) => {
    if (!a.seasonId && b.seasonId) return 1
    if (a.seasonId && !b.seasonId) return -1
    return (
      b.stats.matches - a.stats.matches ||
      a.seasonName.localeCompare(b.seasonName)
    )
  })
}
