/* ==================================================================
 * Career Intelligence — ties together existing, already-verified analytics
 * (form, consistency, performance score, phase performance) into one
 * player-level view. Pure, no I/O; every number here is computed from data
 * the platform already has, nothing new is invented.
 * ================================================================== */
import { computeBattingConsistency, type ConsistencyRow } from './consistency'
import { phaseForOver, type Phase } from './phaseAnalysis'
import { resolvePowerplayOvers } from './matchRules'
import type { Delivery, Match, PlayerMatchPerformance } from '@/types'

export interface FormTrend {
  recentAverage: number
  priorAverage: number
  recentInnings: number
  priorInnings: number
  /** 'improving'/'regressing' require at least 2 innings in BOTH windows and a >=15% swing —
   *  anything smaller is reported as 'stable' rather than reading noise as a real trend. */
  direction: 'improving' | 'regressing' | 'stable'
}

/** Compares the most recent `windowSize` batting innings against the `windowSize` before that,
 *  from a `playerPerformances()`-sorted (most-recent-first) list. Returns null when there isn't
 *  enough history in both windows to say anything meaningful. */
export function computeFormTrend(perfs: PlayerMatchPerformance[], windowSize = 5): FormTrend | null {
  const battingRuns = perfs.filter((p) => p.batting).map((p) => p.batting!.runs)
  if (battingRuns.length < windowSize + 2) return null

  const recent = battingRuns.slice(0, windowSize)
  const prior = battingRuns.slice(windowSize, windowSize * 2)
  if (prior.length < 2) return null

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const recentAverage = avg(recent)
  const priorAverage = avg(prior)
  const swing = priorAverage > 0 ? (recentAverage - priorAverage) / priorAverage : 0

  return {
    recentAverage: Math.round(recentAverage * 10) / 10,
    priorAverage: Math.round(priorAverage * 10) / 10,
    recentInnings: recent.length,
    priorInnings: prior.length,
    direction: swing >= 0.15 ? 'improving' : swing <= -0.15 ? 'regressing' : 'stable',
  }
}

/** This player's own consistency row, if they qualify (min-innings threshold enforced inside
 *  `computeBattingConsistency`) — filtered from the platform-wide computation rather than
 *  duplicating the stats logic for one player. */
export function playerConsistency(matches: Match[], playerId: string): ConsistencyRow | null {
  return computeBattingConsistency(matches).find((r) => r.playerId === playerId) ?? null
}

export interface PhasePerformanceLine {
  phase: Phase
  runs: number
  balls: number
  dismissals: number
  strikeRate: number
}

/** One match's deliveries, paired with the match doc they belong to — needed because phase
 *  boundaries (powerplay/death over counts) depend on that specific match's own format/overs,
 *  which is lost once deliveries from multiple matches are flattened into one array. */
export interface MatchDeliveries {
  match: Match
  deliveries: Delivery[]
}

/** Career-wide batting phase split — strongest/weakest phase — computed match-by-match so each
 *  match's own powerplay/death-over boundaries apply correctly, then summed. Requires the
 *  caller to have fetched full delivery logs for every match this player batted in (an
 *  expensive, lazy-loaded fetch — see PlayerPage's existing `analysisOpened` pattern for the
 *  established convention this follows). */
export function careerPhasePerformance(pairs: MatchDeliveries[], playerId: string): PhasePerformanceLine[] {
  const buckets = new Map<Phase, { runs: number; balls: number; dismissals: number }>()
  for (const { match, deliveries } of pairs) {
    const totalOvers = match.oversPerInnings
    const powerplayOvers = resolvePowerplayOvers(match)
    for (const d of deliveries) {
      if (d.strikerId !== playerId) continue
      const phase = phaseForOver(d.overNumber, totalOvers, powerplayOvers)
      const b = buckets.get(phase) ?? { runs: 0, balls: 0, dismissals: 0 }
      b.runs += d.runsOffBat
      if (d.extraType !== 'wide') b.balls += 1
      if (d.wicket && d.wicket.outBatterId === playerId) b.dismissals += 1
      buckets.set(phase, b)
    }
  }
  return (['powerplay', 'middle', 'death'] as Phase[])
    .filter((p) => buckets.has(p))
    .map((phase) => {
      const b = buckets.get(phase)!
      return {
        phase,
        runs: b.runs,
        balls: b.balls,
        dismissals: b.dismissals,
        strikeRate: b.balls > 0 ? Math.round((b.runs / b.balls) * 1000) / 10 : 0,
      }
    })
}

/** The best and worst phase by strike rate, among phases with at least `minBalls` faced — too
 *  small a sample (e.g. 3 balls in the death overs, ever) isn't a real signal either way. */
export function strongestAndWeakestPhase(
  lines: PhasePerformanceLine[],
  minBalls = 12,
): { strongest?: PhasePerformanceLine; weakest?: PhasePerformanceLine } {
  const qualified = lines.filter((l) => l.balls >= minBalls)
  if (qualified.length < 2) return {}
  const sorted = [...qualified].sort((a, b) => b.strikeRate - a.strikeRate)
  return { strongest: sorted[0], weakest: sorted[sorted.length - 1] }
}
