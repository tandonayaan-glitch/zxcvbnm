import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL } from '@/lib/collections'
import { trackedWrite } from '@/store/writeQueueStore'
import { notify } from './notifications.service'
import { logActivity } from './activity.service'
import { getPlayersByIds } from './players.service'
import { detectMilestones, type MilestoneType } from '@/domain/milestones'
import {
  applyBall,
  newInnings,
  rebuildInnings,
  type ApplyBallOpts,
} from '@/domain/scoring'
import type {
  BallInput,
  Delivery,
  InningsState,
  Match,
  MatchResult,
} from '@/types'

const MILESTONE_LABEL: Record<MilestoneType, (value: number) => string> = {
  century: (v) => `scored a century (${v} runs)`,
  half_century: (v) => `scored a half-century (${v} runs)`,
  five_wicket_haul: (v) => `took a five-wicket haul (${v}/-)`,
}

/** Notify whoever scored/owns the match that it's finished — deduped if the same person.
 *  Also detects batting/bowling milestones from the final innings state and logs/notifies
 *  those. `innings` should be the just-updated innings array when the caller has one locally
 *  (it may not yet be reflected on `match.innings`); falls back to `match.innings` otherwise. */
async function notifyMatchDone(match: Match, result: MatchResult, innings?: InningsState[]) {
  const recipients = new Set([match.scorerId, match.ownerId].filter((id): id is string => !!id))
  for (const uid of recipients) {
    void notify(uid, 'match', 'Match completed', `${match.teamA.name} vs ${match.teamB.name}: ${result.summary}`, `/match/${match.id}`)
  }
  void logActivity(
    'match_completed',
    `${match.teamA.name} vs ${match.teamB.name}: ${result.summary}`,
    { refId: match.id },
  )

  const milestones = detectMilestones({ ...match, innings: innings ?? match.innings })
  if (milestones.length === 0) return
  try {
    const players = await getPlayersByIds(milestones.map((m) => m.playerId))
    const nameOf = (id: string) => players.find((p) => p.id === id)?.displayName ?? 'A player'
    for (const m of milestones) {
      const name = nameOf(m.playerId)
      void logActivity(m.type, `${name} ${MILESTONE_LABEL[m.type](m.value)}`, {
        actorId: m.playerId,
        refId: match.id,
      })
      const player = players.find((p) => p.id === m.playerId)
      if (player?.linkedUserId) {
        void notify(
          player.linkedUserId,
          'player',
          m.type === 'five_wicket_haul' ? 'Five-wicket haul!' : 'Milestone reached!',
          `You ${MILESTONE_LABEL[m.type](m.value)} in ${match.teamA.name} vs ${match.teamB.name}.`,
          `/match/${match.id}`,
        )
      }
    }
  } catch (e) {
    console.error('milestone detection failed', e)
  }
}

/* -------------------------- helpers -------------------------- */

function deliveriesCol(matchId: string) {
  return collection(db, COL.matches, matchId, COL.deliveries)
}

function deliveryId(inningsIndex: number, sequence: number): string {
  return `i${inningsIndex}-${String(sequence).padStart(5, '0')}`
}

/** Which team bats first, resolved from explicit field or the toss. */
export function battingFirstTeamId(match: Match): string {
  if (match.battingFirstTeamId) return match.battingFirstTeamId
  if (match.toss) {
    const other =
      match.toss.wonByTeamId === match.teamA.id ? match.teamB.id : match.teamA.id
    return match.toss.decision === 'bat' ? match.toss.wonByTeamId : other
  }
  return match.teamA.id
}

export function squadFor(match: Match, teamId: string): string[] {
  return teamId === match.teamA.id ? match.squadA : match.squadB
}

/**
 * The wicket count the engine treats as "all out" for this team, plus one
 * (i.e. the `battingSquadSize` the engine subtracts one from). Reads the
 * configured `maxWickets`/`lastManStanding` rules when set; falls back to the
 * literal squad length for matches created before these fields existed, which
 * reproduces the exact prior behaviour.
 */
function effectiveSquadSize(match: Match, teamId: string): number {
  const base = match.maxWickets != null ? match.maxWickets + 1 : squadFor(match, teamId).length
  return base + (match.lastManStanding ? 1 : 0)
}

function optsFor(match: Match, battingTeamId: string): Omit<ApplyBallOpts, 'sequence' | 'incomingBatterId' | 'scorerId'> {
  return {
    ballsPerOver: match.ballsPerOver,
    maxOvers: match.oversPerInnings,
    battingSquadSize: effectiveSquadSize(match, battingTeamId),
  }
}

/* -------------------------- lifecycle -------------------------- */

export async function startMatch(match: Match): Promise<void> {
  const battingId = battingFirstTeamId(match)
  const bowlingId =
    battingId === match.teamA.id ? match.teamB.id : match.teamA.id
  const innings0 = newInnings({
    index: 0,
    battingTeamId: battingId,
    bowlingTeamId: bowlingId,
    target: null,
  })
  await updateDoc(doc(db, COL.matches, match.id), {
    status: 'live',
    innings: [innings0],
    currentInnings: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  })
  await logActivity('match_started', `${match.teamA.name} vs ${match.teamB.name} began`, {
    refId: match.id,
  })
}

export async function setOpeners(
  match: Match,
  args: { strikerId: string; nonStrikerId: string; bowlerId: string },
): Promise<void> {
  const innings = [...match.innings]
  const cur = { ...innings[match.currentInnings] }
  cur.strikerId = args.strikerId
  cur.nonStrikerId = args.nonStrikerId
  cur.bowlerId = args.bowlerId
  innings[match.currentInnings] = cur
  await persistInnings(match.id, innings)
}

export async function setBowler(match: Match, bowlerId: string): Promise<void> {
  const innings = [...match.innings]
  const cur = { ...innings[match.currentInnings], bowlerId }
  innings[match.currentInnings] = cur
  await persistInnings(match.id, innings)
}

/** Fill whichever of striker / non-striker is empty (new batter after a wicket). */
export async function setIncomingBatter(
  match: Match,
  batterId: string,
): Promise<void> {
  const innings = [...match.innings]
  const cur = { ...innings[match.currentInnings] }
  if (!cur.strikerId) cur.strikerId = batterId
  else if (!cur.nonStrikerId) cur.nonStrikerId = batterId
  else cur.strikerId = batterId
  // ensure the batter has a card so order is preserved
  if (!cur.battingCard.some((b) => b.playerId === batterId)) {
    cur.battingCard = [
      ...cur.battingCard,
      {
        playerId: batterId,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        battingOrder: cur.battingCard.length + 1,
      },
    ]
  }
  innings[match.currentInnings] = cur
  await persistInnings(match.id, innings)
}

/** Manually set striker/non-striker (corrections). */
export async function setBatters(
  match: Match,
  args: { strikerId: string; nonStrikerId: string | null },
): Promise<void> {
  const innings = [...match.innings]
  const cur = {
    ...innings[match.currentInnings],
    strikerId: args.strikerId,
    nonStrikerId: args.nonStrikerId,
  }
  innings[match.currentInnings] = cur
  await persistInnings(match.id, innings)
}

async function persistInnings(matchId: string, innings: InningsState[]) {
  await updateDoc(doc(db, COL.matches, matchId), {
    innings,
    updatedAt: Date.now(),
  })
}

/* -------------------------- scoring -------------------------- */

export interface RecordBallArgs {
  incomingBatterId?: string | null
  sequence: number
  scorerId?: string | null
}

/** Apply one ball: persist delivery + updated innings in a single batch. */
export async function recordBall(
  match: Match,
  input: BallInput,
  args: RecordBallArgs,
): Promise<{ delivery: Delivery; innings: InningsState }> {
  const idx = match.currentInnings
  const prev = match.innings[idx]
  const baseOpts = optsFor(match, prev.battingTeamId)

  const { state, delivery } = applyBall(prev, input, {
    ...baseOpts,
    incomingBatterId: args.incomingBatterId ?? null,
    sequence: args.sequence,
    scorerId: args.scorerId ?? null,
  })
  delivery.id = deliveryId(idx, args.sequence)

  const innings = [...match.innings]
  innings[idx] = state

  const batch = writeBatch(db)
  batch.set(doc(deliveriesCol(match.id), delivery.id), delivery)

  // Innings / match status transitions.
  const patch: Partial<Match> = { innings, updatedAt: Date.now() }
  if (state.isComplete) {
    if (idx === 0) {
      patch.status = 'innings_break'
    } else {
      patch.status = 'completed'
      patch.completedAt = Date.now()
      patch.result = computeResult(match, innings)
    }
  }
  batch.update(doc(db, COL.matches, match.id), patch as Record<string, unknown>)
  await trackedWrite(`Ball ${args.sequence}`, batch.commit())

  if (patch.status === 'completed' && patch.result) void notifyMatchDone(match, patch.result, innings)

  return { delivery, innings: state }
}

/** Start the second innings (after the innings break). */
export async function startSecondInnings(match: Match): Promise<void> {
  const first = match.innings[0]
  const battingId = first.bowlingTeamId
  const bowlingId = first.battingTeamId
  const innings1 = newInnings({
    index: 1,
    battingTeamId: battingId,
    bowlingTeamId: bowlingId,
    target: first.totalRuns + 1,
  })
  const innings = [match.innings[0], innings1]
  await updateDoc(doc(db, COL.matches, match.id), {
    innings,
    currentInnings: 1,
    status: 'live',
    updatedAt: Date.now(),
  })
}

/** Undo the last delivery by deleting it and replaying the rest. */
export async function undoLastBall(match: Match): Promise<void> {
  const idx = match.currentInnings
  const all = await getDeliveries(match.id)
  const inThis = all.filter((d) => d.inningsIndex === idx)
  if (inThis.length === 0) return
  const last = inThis[inThis.length - 1]
  const remaining = inThis.slice(0, -1)

  const prev = match.innings[idx]
  const rebuilt = rebuildInnings(
    {
      index: idx,
      battingTeamId: prev.battingTeamId,
      bowlingTeamId: prev.bowlingTeamId,
      target: prev.target,
    },
    remaining,
    optsFor(match, prev.battingTeamId),
  )

  const innings = [...match.innings]
  innings[idx] = rebuilt

  const batch = writeBatch(db)
  batch.delete(doc(deliveriesCol(match.id), last.id))
  const patch: Partial<Match> = {
    innings,
    updatedAt: Date.now(),
    // Undoing a ball can only re-open a closed innings/match.
    status: 'live',
    result: null,
    completedAt: null,
  }
  batch.update(doc(db, COL.matches, match.id), patch as Record<string, unknown>)
  await trackedWrite('Undo last ball', batch.commit())
}

/** Force-close the current innings (e.g. declaration / retire all). */
export async function endInnings(match: Match): Promise<void> {
  const idx = match.currentInnings
  const innings = [...match.innings]
  const cur = { ...innings[idx], isComplete: true, closeReason: 'declared' as const }
  innings[idx] = cur
  const patch: Partial<Match> = { innings, updatedAt: Date.now() }
  if (idx === 0) patch.status = 'innings_break'
  else {
    patch.status = 'completed'
    patch.completedAt = Date.now()
    patch.result = computeResult(match, innings)
  }
  await updateDoc(doc(db, COL.matches, match.id), patch as Record<string, unknown>)
  if (patch.status === 'completed' && patch.result) void notifyMatchDone(match, patch.result, innings)
}

export async function completeMatch(
  match: Match,
  result?: MatchResult,
): Promise<void> {
  const finalResult = result ?? computeResult(match, match.innings)
  await updateDoc(doc(db, COL.matches, match.id), {
    status: 'completed',
    completedAt: Date.now(),
    result: finalResult,
    updatedAt: Date.now(),
  })
  void notifyMatchDone(match, finalResult)
}

export async function abandonMatch(match: Match): Promise<void> {
  const result: MatchResult = {
    outcome: 'abandoned',
    summary: 'Match abandoned — no result',
  }
  await updateDoc(doc(db, COL.matches, match.id), {
    status: 'abandoned',
    completedAt: Date.now(),
    result,
    updatedAt: Date.now(),
  })
  void notifyMatchDone(match, result)
}

/**
 * Reverse an abandoned match back to live (e.g. a mis-tap on "Abandon match").
 * Deliberately scoped to `status === 'abandoned'` only — reopening a
 * genuinely `completed` match with a real scored result is a different,
 * riskier operation (stats/standings may already reflect its final state)
 * and is out of scope here. `abandonMatch()` never touches `innings`/
 * deliveries, so the innings state is exactly as it was at the moment of
 * abandonment and scoring can resume from there unchanged.
 */
export async function reopenMatch(match: Match): Promise<void> {
  if (match.status !== 'abandoned') {
    throw new Error('Only an abandoned match can be reopened.')
  }
  await updateDoc(doc(db, COL.matches, match.id), {
    status: 'live',
    result: null,
    completedAt: null,
    updatedAt: Date.now(),
  })
}

export async function setPlayerOfTheMatch(matchId: string, playerId: string | null) {
  await updateDoc(doc(db, COL.matches, matchId), {
    playerOfTheMatchId: playerId,
    updatedAt: Date.now(),
  })
}

/* -------------------------- result -------------------------- */

export function teamName(match: Match, teamId: string): string {
  return teamId === match.teamA.id ? match.teamA.name : match.teamB.name
}

export function computeResult(
  match: Match,
  innings: InningsState[],
): MatchResult {
  if (innings.length < 2) {
    return { outcome: 'no_result', summary: 'No result' }
  }
  const first = innings[0]
  const second = innings[1]
  const firstTeam = first.battingTeamId
  const secondTeam = second.battingTeamId
  const score1 = first.totalRuns
  const score2 = second.totalRuns

  if (score2 >= (second.target ?? score1 + 1)) {
    const squadSize = effectiveSquadSize(match, secondTeam)
    const wktsLeft = squadSize - 1 - second.wickets
    return {
      outcome: 'win',
      winnerTeamId: secondTeam,
      winnerName: teamName(match, secondTeam),
      margin: `${wktsLeft} wicket${wktsLeft === 1 ? '' : 's'}`,
      summary: `${teamName(match, secondTeam)} won by ${wktsLeft} wicket${
        wktsLeft === 1 ? '' : 's'
      }`,
    }
  }
  if (score2 === score1) {
    return { outcome: 'tie', summary: 'Match tied' }
  }
  const margin = score1 - score2
  return {
    outcome: 'win',
    winnerTeamId: firstTeam,
    winnerName: teamName(match, firstTeam),
    margin: `${margin} run${margin === 1 ? '' : 's'}`,
    summary: `${teamName(match, firstTeam)} won by ${margin} run${
      margin === 1 ? '' : 's'
    }`,
  }
}

/* -------------------------- deliveries -------------------------- */

export async function getDeliveries(matchId: string): Promise<Delivery[]> {
  const snap = await getDocs(query(deliveriesCol(matchId), orderBy('sequence')))
  return snap.docs.map((d) => d.data() as Delivery)
}

export function subscribeDeliveries(
  matchId: string,
  cb: (deliveries: Delivery[]) => void,
): () => void {
  return onSnapshot(
    query(deliveriesCol(matchId), orderBy('sequence')),
    (snap) => cb(snap.docs.map((d) => d.data() as Delivery)),
    () => cb([]),
  )
}

/** Delete a match plus its deliveries (admin cleanup). */
export async function purgeMatch(matchId: string): Promise<void> {
  const [deliveriesSnap, ballMetaSnap] = await Promise.all([
    getDocs(deliveriesCol(matchId)),
    getDocs(collection(db, COL.matches, matchId, COL.ballMeta)),
  ])
  const batch = writeBatch(db)
  deliveriesSnap.docs.forEach((d) => batch.delete(d.ref))
  ballMetaSnap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  await deleteDoc(doc(db, COL.matches, matchId))
}
