import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { logActivity } from './activity.service'
import type { Tournament, StandingsRow } from '@/types'

const tournamentsCol = () => collection(db, COL.tournaments)

export type TournamentInput = Omit<
  Tournament,
  'id' | 'createdAt' | 'updatedAt'
>

export async function listTournaments(): Promise<Tournament[]> {
  const snap = await getDocs(query(tournamentsCol(), orderBy('createdAt', 'desc')))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as Tournament)
    .filter((t) => !t.deletedAt)
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const snap = await getDoc(doc(db, COL.tournaments, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Tournament) : null
}

export async function createTournament(
  input: TournamentInput,
): Promise<string> {
  const now = Date.now()
  const ref = doc(tournamentsCol())
  const data: Tournament = {
    ...input,
    id: ref.id,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, pruneUndefined(data))
  await logActivity('tournament_created', `Tournament "${data.name}" was created`, {
    refId: ref.id,
  })
  return ref.id
}

export async function updateTournament(
  id: string,
  patch: Partial<TournamentInput>,
): Promise<void> {
  await updateDoc(
    doc(db, COL.tournaments, id),
    pruneUndefined({ ...patch, updatedAt: Date.now() }),
  )
}

export async function deleteTournament(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.tournaments, id))
}

export async function addTeamToTournament(tournamentId: string, teamId: string) {
  await updateDoc(doc(db, COL.tournaments, tournamentId), {
    teamIds: arrayUnion(teamId),
    updatedAt: Date.now(),
  })
}

export async function removeTeamFromTournament(
  tournamentId: string,
  teamId: string,
) {
  await updateDoc(doc(db, COL.tournaments, tournamentId), {
    teamIds: arrayRemove(teamId),
    updatedAt: Date.now(),
  })
}

/* ----------------------- Standings (cached) ----------------------- */
const standingsCol = (tid: string) =>
  collection(db, COL.tournaments, tid, COL.standings)

export async function getStandings(tid: string): Promise<StandingsRow[]> {
  const snap = await getDocs(standingsCol(tid))
  const rows = snap.docs.map((d) => d.data() as StandingsRow)
  return sortStandings(rows)
}

export async function saveStandingsRow(tid: string, row: StandingsRow) {
  await setDoc(doc(db, COL.tournaments, tid, COL.standings, row.teamId), row)
}

export function sortStandings(rows: StandingsRow[]): StandingsRow[] {
  return [...rows].sort(
    (a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won,
  )
}
