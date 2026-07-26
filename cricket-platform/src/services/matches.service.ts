import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { defaultScorecardConfig } from '@/lib/defaults'
import { logActivity } from './activity.service'
import type {
  Match,
  MatchTeamRef,
  ScorecardConfig,
  TossInfo,
} from '@/types'

const matchesCol = () => collection(db, COL.matches)

export interface CreateMatchInput {
  title: string
  tournamentId?: string | null
  tournamentName?: string | null
  format: Match['format']
  oversPerInnings: number
  ballsPerOver: number
  teamA: MatchTeamRef
  teamB: MatchTeamRef
  squadA: string[]
  squadB: string[]
  toss?: TossInfo | null
  battingFirstTeamId?: string | null
  venue?: string
  scheduledAt?: number | null
  scorerId?: string | null
  isPublic: boolean
  scorecardConfig?: ScorecardConfig
  createdBy: string
  ownerId?: string
}

export async function createMatch(input: CreateMatchInput): Promise<string> {
  const ref = doc(matchesCol())
  const now = Date.now()
  const data: Match = {
    id: ref.id,
    title: input.title,
    tournamentId: input.tournamentId ?? null,
    tournamentName: input.tournamentName ?? null,
    format: input.format,
    oversPerInnings: input.oversPerInnings,
    ballsPerOver: input.ballsPerOver,
    teamA: input.teamA,
    teamB: input.teamB,
    squadA: input.squadA,
    squadB: input.squadB,
    toss: input.toss ?? null,
    battingFirstTeamId: input.battingFirstTeamId ?? null,
    venue: input.venue ?? '',
    scheduledAt: input.scheduledAt ?? null,
    scorerId: input.scorerId ?? null,
    status: 'setup',
    innings: [],
    currentInnings: 0,
    result: null,
    playerOfTheMatchId: null,
    scorecardConfig: input.scorecardConfig ?? defaultScorecardConfig(),
    isPublic: input.isPublic,
    createdBy: input.createdBy,
    ownerId: input.ownerId ?? input.createdBy,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  }
  await setDoc(ref, pruneUndefined(data))
  await logActivity(
    'match_created',
    `${data.teamA.name} vs ${data.teamB.name} was scheduled`,
    { refId: ref.id },
  )
  return ref.id
}

export async function getMatch(id: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, COL.matches, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Match) : null
}

export async function updateMatch(
  id: string,
  patch: Partial<Match>,
): Promise<void> {
  await updateDoc(
    doc(db, COL.matches, id),
    pruneUndefined({ ...patch, updatedAt: Date.now() }),
  )
}

/** All matches, newest first (admin list, sorted client-side to avoid index needs). */
export async function listAllMatches(): Promise<Match[]> {
  const snap = await getDocs(query(matchesCol(), orderBy('createdAt', 'desc')))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Match)
    .filter((m) => !m.deletedAt)
}

/** Real-time subscription to a single match document. */
export function subscribeMatch(
  id: string,
  cb: (match: Match | null) => void,
): () => void {
  return onSnapshot(
    doc(db, COL.matches, id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Match) : null),
    () => cb(null),
  )
}

/** Real-time subscription to live (and innings-break) public matches. */
export function subscribeLiveMatches(
  cb: (matches: Match[]) => void,
): () => void {
  const q = query(matchesCol(), where('status', 'in', ['live', 'innings_break']))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)),
    () => cb([]),
  )
}
