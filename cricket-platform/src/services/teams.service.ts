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
import type { Team } from '@/types'

const teamsCol = () => collection(db, COL.teams)

export type TeamInput = Omit<Team, 'id' | 'createdAt' | 'updatedAt'>

export async function listTeams(): Promise<Team[]> {
  const snap = await getDocs(query(teamsCol(), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Team)
}

export async function getTeam(id: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, COL.teams, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null
}

export async function getTeamsByIds(ids: string[]): Promise<Team[]> {
  const unique = [...new Set(ids)].filter(Boolean)
  const results = await Promise.all(unique.map((id) => getTeam(id)))
  return results.filter((t): t is Team => t !== null)
}

export async function createTeam(input: TeamInput): Promise<string> {
  const now = Date.now()
  const ref = doc(teamsCol())
  const data: Team = { ...input, id: ref.id, createdAt: now, updatedAt: now }
  await setDoc(ref, pruneUndefined(data))
  return ref.id
}

export async function updateTeam(
  id: string,
  patch: Partial<TeamInput>,
): Promise<void> {
  await updateDoc(
    doc(db, COL.teams, id),
    pruneUndefined({ ...patch, updatedAt: Date.now() }),
  )
}

export async function deleteTeam(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.teams, id))
}

export async function addPlayerToTeam(teamId: string, playerId: string) {
  await updateDoc(doc(db, COL.teams, teamId), {
    playerIds: arrayUnion(playerId),
    updatedAt: Date.now(),
  })
  await updateDoc(doc(db, COL.players, playerId), {
    teamIds: arrayUnion(teamId),
    updatedAt: Date.now(),
  })
}

export async function removePlayerFromTeam(teamId: string, playerId: string) {
  await updateDoc(doc(db, COL.teams, teamId), {
    playerIds: arrayRemove(playerId),
    updatedAt: Date.now(),
  })
  await updateDoc(doc(db, COL.players, playerId), {
    teamIds: arrayRemove(teamId),
    updatedAt: Date.now(),
  })
}
