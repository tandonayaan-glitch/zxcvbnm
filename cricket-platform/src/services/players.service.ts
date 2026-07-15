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
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { logActivity } from './activity.service'
import type { Player } from '@/types'

const playersCol = () => collection(db, COL.players)

export type PlayerInput = Omit<Player, 'id' | 'createdAt' | 'updatedAt'>

export async function listPlayers(): Promise<Player[]> {
  const snap = await getDocs(query(playersCol(), orderBy('fullName')))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as Player)
    .filter((p) => !p.deletedAt)
}

export async function getPlayer(id: string): Promise<Player | null> {
  const snap = await getDoc(doc(db, COL.players, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Player) : null
}

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  const unique = [...new Set(ids)].filter(Boolean)
  const results = await Promise.all(unique.map((id) => getPlayer(id)))
  return results.filter((p): p is Player => p !== null)
}

export async function createPlayer(input: PlayerInput): Promise<string> {
  const now = Date.now()
  const ref = doc(playersCol())
  const data: Player = { ...input, id: ref.id, createdAt: now, updatedAt: now }
  await setDoc(ref, pruneUndefined(data))
  await logActivity('player_created', `${data.fullName} joined the platform`, {
    refId: ref.id,
  })
  return ref.id
}

export async function updatePlayer(
  id: string,
  patch: Partial<PlayerInput>,
): Promise<void> {
  await updateDoc(
    doc(db, COL.players, id),
    pruneUndefined({ ...patch, updatedAt: Date.now() }),
  )
}

export async function deletePlayer(id: string): Promise<void> {
  await deleteDoc(doc(db, COL.players, id))
}

export async function setPlayerActive(id: string, active: boolean) {
  await updatePlayer(id, { active })
}
