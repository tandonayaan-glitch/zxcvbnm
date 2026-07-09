import {
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listTournaments } from '@/services/tournaments.service'
import { listAllMatches } from '@/services/matches.service'
import { listUsers } from '@/services/users.service'
import { getDeliveries } from '@/services/scoring.service'
import type { Delivery } from '@/types'
import type { PlatformBackup } from '@/domain/platformExport'

async function deleteAll(colName: string): Promise<number> {
  const snap = await getDocs(collection(db, colName))
  if (snap.empty) return 0
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  return snap.size
}

/**
 * Permanently clear all cached leaderboard/stat documents. Match data itself is
 * untouched, so leaderboards can be rebuilt from history with "Recompute".
 * Returns how many docs were removed for the audit trail.
 */
export async function clearLeaderboards(): Promise<{
  playerStats: number
  teamStats: number
  standings: number
}> {
  const playerStats = await deleteAll(COL.playerStats)
  const teamStats = await deleteAll(COL.teamStats)

  // standings live under each tournament
  let standings = 0
  const tSnap = await getDocs(collection(db, COL.tournaments))
  for (const t of tSnap.docs) {
    const sSnap = await getDocs(
      collection(db, COL.tournaments, t.id, COL.standings),
    )
    if (!sSnap.empty) {
      const batch = writeBatch(db)
      sSnap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
      standings += sSnap.size
    }
  }

  return { playerStats, teamStats, standings }
}

/**
 * Read-only full snapshot of the platform's core data (players, teams,
 * tournaments, matches + their ball-by-ball deliveries, and user profiles)
 * for the master-admin backup export. Never mutates anything.
 */
export async function gatherPlatformBackup(): Promise<PlatformBackup> {
  const [players, teams, tournaments, matches, users] = await Promise.all([
    listPlayers(),
    listTeams(),
    listTournaments(),
    listAllMatches(),
    listUsers(),
  ])

  const deliveriesByMatch: Record<string, Delivery[]> = {}
  for (const m of matches) {
    if (m.innings.length > 0) {
      deliveriesByMatch[m.id] = await getDeliveries(m.id)
    }
  }

  return {
    exportedAt: Date.now(),
    players,
    teams,
    tournaments,
    matches,
    deliveriesByMatch,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    })),
  }
}
