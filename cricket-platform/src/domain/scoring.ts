/* ==================================================================
 * Scoring engine — pure, deterministic match logic.
 *
 * The engine owns one innings at a time. Given the current InningsState,
 * a BallInput and some options, `applyBall` returns the next InningsState
 * plus the persisted Delivery record. No Firebase, no React.
 * ================================================================== */
import type {
  BallInput,
  BatterCard,
  BowlerCard,
  Delivery,
  ExtrasBreakdown,
  InningsState,
  RecentBall,
  WicketEvent,
  WicketType,
} from '@/types'
import { ballsToOvers } from '@/lib/format'

export function emptyExtras(): ExtrasBreakdown {
  return { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 }
}

export interface NewInningsArgs {
  index: number
  battingTeamId: string
  bowlingTeamId: string
  target?: number | null
}

export function newInnings(args: NewInningsArgs): InningsState {
  return {
    index: args.index,
    battingTeamId: args.battingTeamId,
    bowlingTeamId: args.bowlingTeamId,
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,
    extras: emptyExtras(),
    battingCard: [],
    bowlingCard: [],
    fallOfWickets: [],
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    lastBowlerId: null,
    recentBalls: [],
    target: args.target ?? null,
    isComplete: false,
    closeReason: 'none',
    partnershipRuns: 0,
    partnershipBalls: 0,
    overRunsCharged: 0,
  }
}

/* --------------------------- card helpers --------------------------- */

function ensureBatter(
  state: InningsState,
  playerId: string,
): BatterCard {
  let card = state.battingCard.find((b) => b.playerId === playerId)
  if (!card) {
    card = {
      playerId,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      battingOrder: state.battingCard.length + 1,
    }
    state.battingCard.push(card)
  }
  return card
}

function ensureBowler(state: InningsState, playerId: string): BowlerCard {
  let card = state.bowlingCard.find((b) => b.playerId === playerId)
  if (!card) {
    card = {
      playerId,
      legalBalls: 0,
      runsConceded: 0,
      wickets: 0,
      maidens: 0,
      wides: 0,
      noBalls: 0,
    }
    state.bowlingCard.push(card)
  }
  return card
}

const BOWLER_CREDIT: Record<WicketType, boolean> = {
  bowled: true,
  caught: true,
  lbw: true,
  stumped: true,
  hit_wicket: true,
  run_out: false,
  retired_out: false,
  retired_hurt: false,
  other: false,
}

export function wicketCountsAsDismissal(type: WicketType): boolean {
  return type !== 'retired_hurt'
}

/* ------------------------------ options ------------------------------ */

export interface ApplyBallOpts {
  ballsPerOver: number
  maxOvers: number
  battingSquadSize: number
  /** Required when a wicket falls and the innings continues. */
  incomingBatterId?: string | null
  sequence: number
  scorerId?: string | null
}

export interface ApplyBallResult {
  state: InningsState
  delivery: Delivery
}

function clone(state: InningsState): InningsState {
  return {
    ...state,
    extras: { ...state.extras },
    battingCard: state.battingCard.map((b) => ({ ...b })),
    bowlingCard: state.bowlingCard.map((b) => ({ ...b })),
    fallOfWickets: state.fallOfWickets.map((f) => ({ ...f })),
    recentBalls: [...state.recentBalls],
  }
}

/** Token + kind for the recent-balls strip. */
function tokenFor(d: {
  runsOffBat: number
  extraType: Delivery['extraType']
  extraRuns: number
  totalRuns: number
  wicket: WicketEvent | null
}): RecentBall {
  if (d.wicket && wicketCountsAsDismissal(d.wicket.type)) {
    return { token: 'W', kind: 'wicket' }
  }
  if (d.extraType === 'wide') return { token: `Wd${d.extraRuns - 1 || ''}`, kind: 'extra' }
  if (d.extraType === 'no_ball')
    return { token: `Nb${d.runsOffBat || ''}`, kind: 'extra' }
  if (d.extraType === 'bye') return { token: `${d.totalRuns}b`, kind: 'extra' }
  if (d.extraType === 'leg_bye') return { token: `${d.totalRuns}lb`, kind: 'extra' }
  if (d.runsOffBat === 0) return { token: '•', kind: 'dot' }
  if (d.runsOffBat === 4 || d.runsOffBat === 6)
    return { token: String(d.runsOffBat), kind: 'boundary' }
  return { token: String(d.runsOffBat), kind: 'run' }
}

/**
 * Apply a single ball. Assumes striker/nonStriker/bowler are set on `prev`.
 */
export function applyBall(
  prev: InningsState,
  input: BallInput,
  opts: ApplyBallOpts,
): ApplyBallResult {
  const s = clone(prev)
  const { ballsPerOver, maxOvers, battingSquadSize } = opts

  const strikerId = s.strikerId
  const nonStrikerId = s.nonStrikerId
  const bowlerId = s.bowlerId
  if (!strikerId || !nonStrikerId || !bowlerId) {
    throw new Error('Striker, non-striker and bowler must be set before scoring.')
  }

  const runs = Math.max(0, input.runs | 0)
  const extra = input.extra

  // --- resolve run accounting -------------------------------------
  let runsOffBat = 0
  let extraRuns = 0
  let totalRuns = 0
  let isLegal = true
  let chargedToBowler = 0

  if (!extra) {
    runsOffBat = runs
    totalRuns = runs
    isLegal = true
    chargedToBowler = runs
  } else if (extra === 'wide') {
    extraRuns = 1 + runs
    totalRuns = 1 + runs
    isLegal = false
    chargedToBowler = 1 + runs
  } else if (extra === 'no_ball') {
    runsOffBat = runs
    extraRuns = 1
    totalRuns = 1 + runs
    isLegal = false
    chargedToBowler = 1 + runs
  } else if (extra === 'bye') {
    extraRuns = runs
    totalRuns = runs
    isLegal = true
    chargedToBowler = 0
  } else if (extra === 'leg_bye') {
    extraRuns = runs
    totalRuns = runs
    isLegal = true
    chargedToBowler = 0
  }

  // --- team total & extras ----------------------------------------
  s.totalRuns += totalRuns
  if (extra === 'wide') s.extras.wides += 1 + runs
  else if (extra === 'no_ball') s.extras.noBalls += 1
  else if (extra === 'bye') s.extras.byes += runs
  else if (extra === 'leg_bye') s.extras.legByes += runs
  s.extras.total =
    s.extras.wides +
    s.extras.noBalls +
    s.extras.byes +
    s.extras.legByes +
    s.extras.penalty

  // --- batter card -------------------------------------------------
  const striker = ensureBatter(s, strikerId)
  striker.runs += runsOffBat
  // Batter faces the ball unless it's a wide.
  if (extra !== 'wide') striker.balls += 1
  if (!extra && runsOffBat === 4) striker.fours += 1
  if (!extra && runsOffBat === 6) striker.sixes += 1

  // --- bowler card -------------------------------------------------
  const bowler = ensureBowler(s, bowlerId)
  if (isLegal) bowler.legalBalls += 1
  bowler.runsConceded += chargedToBowler
  if (extra === 'wide') bowler.wides += 1 + runs
  if (extra === 'no_ball') bowler.noBalls += 1

  // --- partnership -------------------------------------------------
  s.partnershipRuns += totalRuns
  if (isLegal) s.partnershipBalls += 1

  // --- over tally for maidens -------------------------------------
  s.overRunsCharged += chargedToBowler

  // --- legal ball / over progression ------------------------------
  const overNumberBefore = Math.floor(prev.legalBalls / ballsPerOver)
  const ballInOver = (prev.legalBalls % ballsPerOver) + 1
  if (isLegal) s.legalBalls += 1

  // --- wicket ------------------------------------------------------
  let wicketEvent: WicketEvent | null = null
  if (input.wicket) {
    const type = input.wicket.type
    const counts = wicketCountsAsDismissal(type)
    const creditToBowler = BOWLER_CREDIT[type] && isLegalForWicketCredit(extra)
    wicketEvent = {
      type,
      outBatterId: input.wicket.outBatterId,
      fielderId: input.wicket.fielderId ?? null,
      creditToBowler,
      text: dismissalText(type),
    }
    const outCard = ensureBatter(s, input.wicket.outBatterId)
    outCard.out = true
    outCard.dismissalType = type
    outCard.dismissalText = dismissalText(type)
    outCard.bowlerId = creditToBowler ? bowlerId : null
    outCard.fielderId = input.wicket.fielderId ?? null

    if (creditToBowler) bowler.wickets += 1

    if (counts) {
      s.wickets += 1
      s.fallOfWickets.push({
        wicketNumber: s.wickets,
        score: s.totalRuns,
        displayOver: ballsToOvers(s.legalBalls, ballsPerOver),
        batterOutId: input.wicket.outBatterId,
      })
    }
    s.partnershipRuns = 0
    s.partnershipBalls = 0
  }

  // --- strike rotation (runs ran by batters) ----------------------
  const ranOdd = oddRunsRan(extra, runsOffBat, runs)
  if (ranOdd) swapStrike(s)

  // --- replace dismissed batter with incoming ---------------------
  if (wicketEvent) {
    const outId = wicketEvent.outBatterId
    const incoming = opts.incomingBatterId ?? null
    const allOut = s.wickets >= battingSquadSize - 1
    if (incoming && !allOut) {
      ensureBatter(s, incoming)
      if (s.strikerId === outId) s.strikerId = incoming
      else if (s.nonStrikerId === outId) s.nonStrikerId = incoming
      else s.strikerId = incoming
    } else if (s.strikerId === outId) {
      s.strikerId = null
    } else if (s.nonStrikerId === outId) {
      s.nonStrikerId = null
    }
  }

  // --- over completion --------------------------------------------
  const overJustCompleted =
    isLegal && s.legalBalls % ballsPerOver === 0 && s.legalBalls > 0
  if (overJustCompleted) {
    if (s.overRunsCharged === 0) {
      const b = ensureBowler(s, bowlerId)
      b.maidens += 1
    }
    s.overRunsCharged = 0
    s.lastBowlerId = bowlerId
    s.bowlerId = null // UI must choose next over's bowler
    swapStrike(s)
  }

  // --- recent balls -----------------------------------------------
  const rb = tokenFor({ runsOffBat, extraType: extra ?? null, extraRuns, totalRuns, wicket: wicketEvent })
  s.recentBalls = [...s.recentBalls, rb].slice(-12)

  // --- innings end conditions -------------------------------------
  evaluateInningsEnd(s, opts)

  // --- delivery record --------------------------------------------
  const delivery: Delivery = {
    id: '', // assigned by service
    inningsIndex: s.index,
    sequence: opts.sequence,
    overNumber: overNumberBefore,
    ballInOver,
    displayOver: `${overNumberBefore}.${ballInOver}`,
    strikerId,
    nonStrikerId,
    bowlerId,
    runsOffBat,
    extraType: extra ?? null,
    extraRuns,
    totalRuns,
    isLegal,
    wicket: wicketEvent,
    commentary: '',
    createdAt: Date.now(),
    scorerId: opts.scorerId ?? null,
  }

  return { state: s, delivery }
}

function isLegalForWicketCredit(extra: BallInput['extra']): boolean {
  // No credit on a wide; bowled/caught off a no-ball can't happen (ball is
  // dead for those), but run-outs can. We simply deny bowler credit on extras.
  return !extra || extra === 'bye' || extra === 'leg_bye'
}

function oddRunsRan(
  extra: BallInput['extra'],
  runsOffBat: number,
  runs: number,
): boolean {
  if (!extra) return runsOffBat % 2 === 1
  if (extra === 'no_ball') return runsOffBat % 2 === 1
  // wide / bye / leg_bye: the batters ran `runs`
  return runs % 2 === 1
}

function swapStrike(s: InningsState): void {
  const t = s.strikerId
  s.strikerId = s.nonStrikerId
  s.nonStrikerId = t
}

function evaluateInningsEnd(s: InningsState, opts: ApplyBallOpts): void {
  if (s.isComplete) return
  const allOut = s.wickets >= opts.battingSquadSize - 1
  const oversDone = s.legalBalls >= opts.maxOvers * opts.ballsPerOver
  const chased = s.target != null && s.totalRuns >= s.target
  if (chased) {
    s.isComplete = true
    s.closeReason = 'target'
  } else if (allOut) {
    s.isComplete = true
    s.closeReason = 'all_out'
  } else if (oversDone) {
    s.isComplete = true
    s.closeReason = 'overs'
  }
}

export function dismissalText(type: WicketType): string {
  switch (type) {
    case 'bowled':
      return 'b'
    case 'caught':
      return 'c & b'
    case 'lbw':
      return 'lbw'
    case 'run_out':
      return 'run out'
    case 'stumped':
      return 'st'
    case 'hit_wicket':
      return 'hit wicket'
    case 'retired_out':
      return 'retired out'
    case 'retired_hurt':
      return 'retired hurt'
    default:
      return 'out'
  }
}

/** Reconstruct the "runs tapped" for a stored delivery. */
function runsTapped(d: Delivery): number {
  if (!d.extraType) return d.runsOffBat
  if (d.extraType === 'no_ball') return d.runsOffBat
  if (d.extraType === 'wide') return Math.max(0, d.extraRuns - 1)
  return d.extraRuns // bye / leg_bye
}

/**
 * Replay an ordered list of deliveries to produce the resulting InningsState.
 * Used for reliable undo / recompute: delete the last delivery, replay the
 * rest. Incoming batters after a wicket are inferred from the next delivery.
 */
export function rebuildInnings(
  base: NewInningsArgs,
  deliveries: Delivery[],
  opts: { ballsPerOver: number; maxOvers: number; battingSquadSize: number },
): InningsState {
  const ordered = [...deliveries].sort((a, b) => a.sequence - b.sequence)
  let s = newInnings(base)
  for (let i = 0; i < ordered.length; i++) {
    const d = ordered[i]
    s.strikerId = d.strikerId
    s.nonStrikerId = d.nonStrikerId
    s.bowlerId = d.bowlerId
    const input: BallInput = {
      runs: runsTapped(d),
      extra: d.extraType ?? undefined,
      wicket: d.wicket
        ? {
            type: d.wicket.type,
            outBatterId: d.wicket.outBatterId,
            fielderId: d.wicket.fielderId ?? null,
          }
        : undefined,
    }
    let incoming: string | null = null
    if (d.wicket) {
      const next = ordered[i + 1]
      if (next) {
        const before = new Set([d.strikerId, d.nonStrikerId])
        const cand = [next.strikerId, next.nonStrikerId].find(
          (id) => !before.has(id),
        )
        incoming = cand ?? null
      }
    }
    const res = applyBall(s, input, {
      ...opts,
      incomingBatterId: incoming,
      sequence: d.sequence,
      scorerId: d.scorerId ?? null,
    })
    s = res.state
  }
  return s
}

/* ------------------------ simple selectors ------------------------ */

export function inningsOvers(s: InningsState, ballsPerOver = 6): string {
  return ballsToOvers(s.legalBalls, ballsPerOver)
}

export function ballsRemaining(s: InningsState, opts: { maxOvers: number; ballsPerOver: number }): number {
  return Math.max(0, opts.maxOvers * opts.ballsPerOver - s.legalBalls)
}

export function runsToWin(s: InningsState): number | null {
  if (s.target == null) return null
  return Math.max(0, s.target - s.totalRuns)
}
