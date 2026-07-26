import { doc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import {
  aggregatePlayerStats,
  aggregateTeamStats,
  playerPerformances,
  computeStandings,
} from '@/domain/stats'
import { listAllMatches } from './matches.service'
import { listTeams } from './teams.service'
import { saveStandingsRow, getTournament } from './tournaments.service'
import type { PlayerStats, TeamStats, PlayerMatchPerformance } from '@/types'

/**
 * Full recompute: scan every completed match, rewrite cached player & team
 * stats. Cheap enough for a club platform and avoids incremental drift.
 * Called after a match completes and from a manual "refresh stats" action.
 */
export async function recomputeAllStats(): Promise<void> {
  const matches = await listAllMatches()
  const playerStats = aggregatePlayerStats(matches)
  const teamStats = aggregateTeamStats(matches)

  const batch = writeBatch(db)
  for (const [id, s] of playerStats) {
    batch.set(doc(db, COL.playerStats, id), s)
  }
  for (const [id, s] of teamStats) {
    batch.set(doc(db, COL.teamStats, id), s)
  }
  await batch.commit()
}

/** Recompute and persist a tournament's standings rows. */
export async function recomputeTournamentStandings(
  tournamentId: string,
): Promise<void> {
  const [tournament, teams, matches] = await Promise.all([
    getTournament(tournamentId),
    listTeams(),
    listAllMatches(),
  ])
  if (!tournament) return
  const tMatches = matches.filter((m) => m.tournamentId === tournamentId)
  const rows = computeStandings(tournament.teamIds, teams, tMatches)
  await Promise.all(rows.map((r) => saveStandingsRow(tournamentId, r)))
}

/** Read cached player stats; fall back to a live compute if absent. */
export async function getPlayerStats(
  playerId: string,
): Promise<PlayerStats | null> {
  const snap = await getDoc(doc(db, COL.playerStats, playerId))
  if (snap.exists()) return snap.data() as PlayerStats
  // fallback compute
  const matches = await listAllMatches()
  const map = aggregatePlayerStats(matches)
  return map.get(playerId) ?? null
}

export async function getTeamStats(teamId: string): Promise<TeamStats | null> {
  const snap = await getDoc(doc(db, COL.teamStats, teamId))
  if (snap.exists()) return snap.data() as TeamStats
  const matches = await listAllMatches()
  const map = aggregateTeamStats(matches)
  return map.get(teamId) ?? null
}

export async function getPlayerPerformances(
  playerId: string,
): Promise<PlayerMatchPerformance[]> {
  const matches = await listAllMatches()
  return playerPerformances(playerId, matches)
}

