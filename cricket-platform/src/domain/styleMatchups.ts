/* ==================================================================
 * Style matchups — how a batter fares against pace vs spin, and how a
 * bowler fares against right- vs left-handers. Pure, no I/O.
 *
 * The classification joins each delivery to the *bowler's* declared
 * `Player.bowlingStyle` (and, for the hand split, the *striker's*
 * `Player.battingStyle`). A bowler with `bowlingStyle: 'none'` or a
 * style string the app doesn't recognise contributes to an `unknown`
 * bucket that is reported separately, never silently folded into pace
 * or spin — same "absent means excluded, never guessed" rule the rest
 * of the analytics layer follows.
 * ================================================================== */
import type { Delivery } from '@/types'

export type BowlerKind = 'pace' | 'spin' | 'unknown'

/** Coarse pace/spin bucket from a `Player.bowlingStyle`. Tolerant of the enum's
 *  members *and* the near-synonyms that turn up in real data (`offbreak` for
 *  `offspin`, `legbreak` for `legspin`, `seam` for medium, etc.) — anything that
 *  still doesn't match is `unknown`, not a guess. */
export function classifyBowlingStyle(style: string | null | undefined): BowlerKind {
  const s = (style ?? '').toLowerCase()
  if (!s || s === 'none') return 'unknown'
  if (/spin|break|orthodox|chinaman|googly|slow/.test(s)) return 'spin'
  if (/fast|medium|pace|seam|quick/.test(s)) return 'pace'
  return 'unknown'
}

export interface StyleSplit {
  runs: number
  /** Legal balls faced (a wide is bowled but never faced — matches `scoring.ts`). */
  balls: number
  dismissals: number
  dots: number
  fours: number
  sixes: number
  /** runs / balls * 100, rounded to 1dp; 0 when no balls faced. */
  strikeRate: number
  /** runs / dismissals to 1dp, or null when never dismissed (an average is undefined, not ∞). */
  average: number | null
  boundaryPct: number
  dotPct: number
}

function emptySplit(): StyleSplit {
  return {
    runs: 0, balls: 0, dismissals: 0, dots: 0, fours: 0, sixes: 0,
    strikeRate: 0, average: null, boundaryPct: 0, dotPct: 0,
  }
}

function finalise(s: StyleSplit): StyleSplit {
  s.strikeRate = s.balls > 0 ? Math.round((s.runs / s.balls) * 1000) / 10 : 0
  s.average = s.dismissals > 0 ? Math.round((s.runs / s.dismissals) * 10) / 10 : null
  s.boundaryPct = s.balls > 0 ? Math.round(((s.fours + s.sixes) / s.balls) * 1000) / 10 : 0
  s.dotPct = s.balls > 0 ? Math.round((s.dots / s.balls) * 1000) / 10 : 0
  return s
}

export interface BatterStyleMatchup {
  pace: StyleSplit
  spin: StyleSplit
  unknown: StyleSplit
  /** True once at least one of pace/spin has a faced ball — the UI uses this to
   *  decide between showing the split and showing an honest "not enough data". */
  hasClassifiedData: boolean
}

/** A batter's record split by the bowler's pace/spin classification, across
 *  whatever deliveries the caller supplies (typically every ball they've faced). */
export function batterVsPaceSpin(
  deliveries: Delivery[],
  bowlerStyleById: Map<string, string | null | undefined>,
  batterId: string,
): BatterStyleMatchup {
  const buckets: Record<BowlerKind, StyleSplit> = {
    pace: emptySplit(), spin: emptySplit(), unknown: emptySplit(),
  }
  for (const d of deliveries) {
    if (d.strikerId !== batterId) continue
    const kind = classifyBowlingStyle(bowlerStyleById.get(d.bowlerId))
    const b = buckets[kind]
    b.runs += d.runsOffBat
    if (d.extraType !== 'wide') b.balls += 1
    if (!d.extraType && d.runsOffBat === 4) b.fours += 1
    if (!d.extraType && d.runsOffBat === 6) b.sixes += 1
    if (d.totalRuns === 0) b.dots += 1
    if (d.wicket && d.wicket.outBatterId === batterId) b.dismissals += 1
  }
  return {
    pace: finalise(buckets.pace),
    spin: finalise(buckets.spin),
    unknown: finalise(buckets.unknown),
    hasClassifiedData: buckets.pace.balls > 0 || buckets.spin.balls > 0,
  }
}

export interface BowlerHandSplit {
  runsConceded: number
  balls: number
  wickets: number
  economy: number
  strikeRate: number | null
}

function emptyHand(): BowlerHandSplit {
  return { runsConceded: 0, balls: 0, wickets: 0, economy: 0, strikeRate: null }
}

function finaliseHand(h: BowlerHandSplit): BowlerHandSplit {
  h.economy = h.balls > 0 ? Math.round((h.runsConceded / h.balls) * 6 * 100) / 100 : 0
  h.strikeRate = h.wickets > 0 ? Math.round((h.balls / h.wickets) * 10) / 10 : null
  return h
}

export interface BowlerVsHand {
  vsRight: BowlerHandSplit
  vsLeft: BowlerHandSplit
  hasData: boolean
}

/** A bowler's record split by the *striker's* batting hand. `runsConceded` counts
 *  runs off the bat plus wides/no-balls (the runs charged to a bowler's analysis),
 *  matching how `stats.ts` attributes economy. */
export function bowlerVsBattingHand(
  deliveries: Delivery[],
  batterHandById: Map<string, string | null | undefined>,
  bowlerId: string,
): BowlerVsHand {
  const vsRight = emptyHand()
  const vsLeft = emptyHand()
  for (const d of deliveries) {
    if (d.bowlerId !== bowlerId) continue
    const hand = (batterHandById.get(d.strikerId) ?? '').toLowerCase()
    const bucket = hand === 'left_hand' ? vsLeft : hand === 'right_hand' ? vsRight : null
    if (!bucket) continue
    bucket.runsConceded += d.runsOffBat
    if (d.extraType === 'wide' || d.extraType === 'no_ball') bucket.runsConceded += d.extraRuns
    if (d.extraType !== 'wide' && d.extraType !== 'no_ball') bucket.balls += 1
    if (d.wicket && d.wicket.creditToBowler) bucket.wickets += 1
  }
  return {
    vsRight: finaliseHand(vsRight),
    vsLeft: finaliseHand(vsLeft),
    hasData: vsRight.balls > 0 || vsLeft.balls > 0,
  }
}
