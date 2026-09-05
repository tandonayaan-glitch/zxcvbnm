/* ==================================================================
 * Deterministic Highlights — every wicket, boundary, milestone, big over,
 * standout partnership, and computed turning point in a match, ranked by a
 * documented "significance" score for filtering/sorting. Pure, no I/O.
 *
 * This is data-based, not AI-generated: every highlight traces back to a
 * specific ball or a specific existing analytics function
 * (`insights.ts`/`milestones.ts`). It works with or without video — when a
 * clip/broadcast recording exists for the match, `deliveryId` is enough for
 * the caller to look up the matching video timestamp (ball-to-video, already
 * built in the media/broadcast engine); without one, the highlight still
 * stands alone as a scorecard-backed fact.
 * ================================================================== */
import { matchInsights } from './insights'
import { detectMilestones } from './milestones'
import { phaseForOver } from './phaseAnalysis'
import { resolvePowerplayOvers } from './matchRules'
import type { Delivery, Match } from '@/types'

export type HighlightType =
  | 'wicket'
  | 'six'
  | 'four'
  | 'milestone'
  | 'big_over'
  | 'partnership'
  | 'turning_point'

export interface Highlight {
  /** Deterministic — same match + same event always produces the same id, so a client can
   *  de-duplicate or re-derive without persisting anything. */
  id: string
  matchId: string
  inningsIndex: number
  type: HighlightType
  title: string
  description: string
  displayOver: string
  playerIds: string[]
  /** 0-100, higher = more significant. See the per-type weights below — a fixed, documented
   *  scale, not a learned ranking. */
  significance: number
  /** The specific ball this highlight is anchored to, when there is one (wickets/boundaries) —
   *  the join key for ball-to-video lookup. Absent for innings-level highlights (partnerships,
   *  turning points spanning a whole over). */
  deliveryId?: string
}

const WEIGHT = {
  wicketBase: 40,
  wicketDeathBonus: 15,
  wicketChaseBonus: 10,
  sixBase: 30,
  sixDeathBonus: 10,
  fourBase: 15,
  fourDeathBonus: 5,
  milestoneFifty: 50,
  milestoneHundred: 70,
  milestoneFiveWkt: 60,
  bigOverBase: 35,
  bigOverPerRun: 2, // added per run above 12 in the over
  partnershipBase: 25,
  partnershipPerTenRuns: 3,
  turningPoint: 45,
} as const

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Every wicket and boundary, scored per-ball from the raw delivery log. */
function ballLevelHighlights(match: Match, deliveries: Delivery[], inningsIndex: number): Highlight[] {
  const inn = match.innings[inningsIndex]
  if (!inn) return []
  const totalOvers = match.oversPerInnings
  const powerplayOvers = resolvePowerplayOvers(match)
  const isChase = inn.target != null
  const battingShort = inn.battingTeamId === match.teamA.id ? match.teamA.shortName : match.teamB.shortName
  const out: Highlight[] = []

  for (const d of deliveries) {
    if (d.inningsIndex !== inningsIndex) continue
    const phase = phaseForOver(d.overNumber, totalOvers, powerplayOvers)

    if (d.wicket) {
      let sig = WEIGHT.wicketBase
      if (phase === 'death') sig += WEIGHT.wicketDeathBonus
      if (isChase) sig += WEIGHT.wicketChaseBonus
      out.push({
        id: `${match.id}-w-${d.id}`,
        matchId: match.id,
        inningsIndex,
        type: 'wicket',
        title: `Wicket — ${d.wicket.text}`,
        description: `${battingShort} lose a wicket at ${d.displayOver}: ${d.wicket.text}.`,
        displayOver: d.displayOver,
        playerIds: [d.wicket.outBatterId, ...(d.wicket.fielderId ? [d.wicket.fielderId] : []), d.bowlerId],
        significance: clamp100(sig),
        deliveryId: d.id,
      })
      continue
    }
    if (!d.extraType && d.runsOffBat === 6) {
      let sig = WEIGHT.sixBase
      if (phase === 'death') sig += WEIGHT.sixDeathBonus
      out.push({
        id: `${match.id}-6-${d.id}`,
        matchId: match.id,
        inningsIndex,
        type: 'six',
        title: 'Six',
        description: `Six at ${d.displayOver}.`,
        displayOver: d.displayOver,
        playerIds: [d.strikerId, d.bowlerId],
        significance: clamp100(sig),
        deliveryId: d.id,
      })
    } else if (!d.extraType && d.runsOffBat === 4) {
      let sig = WEIGHT.fourBase
      if (phase === 'death') sig += WEIGHT.fourDeathBonus
      out.push({
        id: `${match.id}-4-${d.id}`,
        matchId: match.id,
        inningsIndex,
        type: 'four',
        title: 'Four',
        description: `Four at ${d.displayOver}.`,
        displayOver: d.displayOver,
        playerIds: [d.strikerId, d.bowlerId],
        significance: clamp100(sig),
        deliveryId: d.id,
      })
    }
  }
  return out
}

/** Milestones, big overs, standout partnerships, and the innings' own computed turning point —
 *  none of these are anchored to one ball, so no `deliveryId`. */
function inningsLevelHighlights(match: Match, deliveries: Delivery[], inningsIndex: number): Highlight[] {
  const out: Highlight[] = []
  const insightsList = matchInsights(match, deliveries)
  const insights = insightsList.find((i) => i.inningsIndex === inningsIndex)
  if (!insights) return out

  for (const m of detectMilestones(match).filter((ms) => ms.inningsIndex === inningsIndex)) {
    out.push({
      id: `${match.id}-ms-${inningsIndex}-${m.playerId}-${m.type}`,
      matchId: match.id,
      inningsIndex,
      type: 'milestone',
      title: m.type === 'century' ? 'Century' : m.type === 'half_century' ? 'Half-century' : 'Five-wicket haul',
      description:
        m.type === 'five_wicket_haul'
          ? `${m.value}-wicket haul.`
          : `${m.value} runs.`,
      displayOver: '',
      playerIds: [m.playerId],
      significance: clamp100(
        m.type === 'century' ? WEIGHT.milestoneHundred : m.type === 'half_century' ? WEIGHT.milestoneFifty : WEIGHT.milestoneFiveWkt,
      ),
    })
  }

  if (insights.biggestOver && insights.biggestOver.runs >= 12) {
    out.push({
      id: `${match.id}-bo-${inningsIndex}`,
      matchId: match.id,
      inningsIndex,
      type: 'big_over',
      title: `Over ${insights.biggestOver.over}: ${insights.biggestOver.runs} runs`,
      description: `${insights.biggestOver.runs} runs off over ${insights.biggestOver.over}${insights.biggestOver.wickets > 0 ? ` (${insights.biggestOver.wickets} wkt${insights.biggestOver.wickets === 1 ? '' : 's'})` : ''}.`,
      displayOver: String(insights.biggestOver.over),
      playerIds: [insights.biggestOver.bowlerId],
      significance: clamp100(WEIGHT.bigOverBase + (insights.biggestOver.runs - 12) * WEIGHT.bigOverPerRun),
    })
  }

  if (insights.bestPartnership && insights.bestPartnership.runs >= 30) {
    const p = insights.bestPartnership
    out.push({
      id: `${match.id}-pt-${inningsIndex}`,
      matchId: match.id,
      inningsIndex,
      type: 'partnership',
      title: `${p.runs}-run partnership`,
      description: `${p.runs} runs off ${p.balls} balls between the two batters at the crease.`,
      displayOver: '',
      playerIds: [p.batterA, p.batterB],
      significance: clamp100(WEIGHT.partnershipBase + (p.runs / 10) * WEIGHT.partnershipPerTenRuns),
    })
  }

  if (insights.turningPoint) {
    const tp = insights.turningPoint
    out.push({
      id: `${match.id}-tp-${inningsIndex}`,
      matchId: match.id,
      inningsIndex,
      type: 'turning_point',
      title: `Turning point — over ${tp.over}`,
      description:
        tp.delta >= 0
          ? `A ${tp.runs}-run over swung the momentum, over ${tp.over}.`
          : `A costly over for the batting side, over ${tp.over} (${tp.runs} runs, momentum shift).`,
      displayOver: String(tp.over),
      playerIds: [tp.bowlerId],
      significance: clamp100(WEIGHT.turningPoint),
    })
  }

  return out
}

/** Every highlight across every innings of the match, sorted most significant first. Filter the
 *  result by `type`/`inningsIndex` for a specific view (e.g. "just wickets", "just this innings"). */
export function extractMatchHighlights(match: Match, deliveries: Delivery[]): Highlight[] {
  const all: Highlight[] = []
  for (let i = 0; i < match.innings.length; i++) {
    all.push(...ballLevelHighlights(match, deliveries, i))
    all.push(...inningsLevelHighlights(match, deliveries, i))
  }
  return all.sort((a, b) => b.significance - a.significance)
}
