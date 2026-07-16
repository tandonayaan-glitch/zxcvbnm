import { collection, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { findIntegrityIssues } from '@/domain/dataIntegrity'
import { logAudit } from './audit.service'
import type { IntegrityIssue, Match, Team, Tournament, UserProfile } from '@/types'

async function idsOf(colName: string): Promise<string[]> {
  const snap = await getDocs(collection(db, colName))
  return snap.docs.map((d) => d.id)
}

/** Fetches every collection integrity checks depend on and runs the pure scan. Deliberately reads
 *  full (trashed-inclusive) sets for existence checks — a reference to a *trashed* doc is not
 *  broken, only a reference to one that never existed or was hard-deleted. */
export async function scanDataIntegrity(): Promise<IntegrityIssue[]> {
  const [teamsSnap, tournamentsSnap, matchesSnap, playerIds, clubIds, seasonIds, playerStatsIds, teamStatsIds] =
    await Promise.all([
      getDocs(collection(db, COL.teams)),
      getDocs(collection(db, COL.tournaments)),
      getDocs(collection(db, COL.matches)),
      idsOf(COL.players),
      idsOf(COL.clubs),
      idsOf(COL.seasons),
      idsOf(COL.playerStats),
      idsOf(COL.teamStats),
    ])

  const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team)
  const tournaments = tournamentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament)
  const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)

  return findIntegrityIssues({
    teams,
    tournaments,
    matches,
    playerIds: new Set(playerIds),
    teamIds: new Set(teamsSnap.docs.map((d) => d.id)),
    clubIds: new Set(clubIds),
    seasonIds: new Set(seasonIds),
    playerStatsIds,
    teamStatsIds,
  })
}

/** Applies the one safe fix for a `repairable` issue. Informational issues (match-level) have no
 *  repair path — rewriting historical scorecards is exactly what this tool must never do. */
export async function repairIssue(issue: IntegrityIssue, actor: UserProfile | null): Promise<void> {
  const parts = issue.id.split(':')

  switch (issue.type) {
    case 'orphaned_roster_entry': {
      const [, teamId, playerId] = parts
      const snap = await getDocs(collection(db, COL.teams))
      const team = snap.docs.find((d) => d.id === teamId)
      if (!team) return
      const playerIds = (team.data().playerIds as string[]).filter((id) => id !== playerId)
      await updateDoc(doc(db, COL.teams, teamId), { playerIds, updatedAt: Date.now() })
      break
    }
    case 'broken_captain_ref': {
      const [, teamId, which] = parts
      const field = which === 'captain' ? 'captainId' : 'viceCaptainId'
      await updateDoc(doc(db, COL.teams, teamId), { [field]: null, updatedAt: Date.now() })
      break
    }
    case 'orphaned_tournament_team': {
      const [, tournamentId, teamId] = parts
      const snap = await getDocs(collection(db, COL.tournaments))
      const tournament = snap.docs.find((d) => d.id === tournamentId)
      if (!tournament) return
      const teamIds = (tournament.data().teamIds as string[]).filter((id) => id !== teamId)
      await updateDoc(doc(db, COL.tournaments, tournamentId), { teamIds, updatedAt: Date.now() })
      break
    }
    case 'broken_club_ref': {
      const col = issue.entityType === 'team' ? COL.teams : COL.tournaments
      await updateDoc(doc(db, col, issue.entityId), { clubId: null, updatedAt: Date.now() })
      break
    }
    case 'broken_season_ref': {
      await updateDoc(doc(db, COL.tournaments, issue.entityId), { seasonId: null, updatedAt: Date.now() })
      break
    }
    case 'orphaned_player_stats': {
      await deleteDoc(doc(db, COL.playerStats, issue.entityId))
      break
    }
    case 'orphaned_team_stats': {
      await deleteDoc(doc(db, COL.teamStats, issue.entityId))
      break
    }
    case 'dangling_match_squad_ref':
      return // informational only — never auto-repaired
  }

  await logAudit(actor, 'dataIntegrity.repair', `${issue.type} on ${issue.entityType} "${issue.label}"`)
}
