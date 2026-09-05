/* ==================================================================
 * Automatic Match Report — a deterministic post-match summary assembled
 * entirely from this match's own real data: the scoring engine's innings
 * state, the existing insights/win-probability/expected-score modules, and
 * the highlights extractor. No AI, no invented narrative — every sentence
 * traces back to a number already on the scorecard.
 * ================================================================== */
import { matchInsights, type InningsInsights } from './insights'
import { matchTopPerformers, type MatchBatter, type MatchBowler } from './matchPerformers'
import { extractMatchHighlights, type Highlight } from './highlights'
import { chaseWinProbability } from './winProbability'
import { projectFirstInningsScore } from './expectedScore'
import { resolvePowerplayOvers } from './matchRules'
import type { Delivery, Match } from '@/types'

export interface WinProbabilityPoint {
  over: number
  winProbability: number // for the chasing team, 0-100
}

export interface WinProbabilitySwing {
  fromOver: number
  toOver: number
  fromProbability: number
  toProbability: number
  /** Signed: positive = swung toward the chasing team. */
  delta: number
}

export interface ExpectedVsActual {
  inningsIndex: number
  /** Projected final total, extrapolated from the powerplay's trajectory alone. */
  projectedFromPowerplay: number
  actual: number
  delta: number
}

export interface UnderperformerEntry {
  playerId: string
  runs: number
  balls: number
  note: string
}

export interface FieldingContribution {
  playerId: string
  catches: number
  runOuts: number
  stumpings: number
}

export interface InningsReport {
  inningsIndex: number
  battingTeamId: string
  totalRuns: number
  wickets: number
  legalBalls: number
  /** Plain-English bullet points — boundary/dot rates, powerplay, best partnership/spell. */
  summary: string[]
}

export interface MatchReport {
  matchId: string
  resultSummary: string
  expectedVsActual?: ExpectedVsActual
  winProbabilityTrajectory: WinProbabilityPoint[]
  biggestSwing?: WinProbabilitySwing
  topPerformers: { batter?: MatchBatter; bowler?: MatchBowler }
  underperformers: UnderperformerEntry[]
  fielding: FieldingContribution[]
  inningsReports: InningsReport[]
  /** Top 8 highlights by significance — the same extractor `Highlights` uses, so the report and
   *  the highlights view are always consistent with each other. */
  keyMoments: Highlight[]
}

function squadSize(match: Match, battingTeamId: string): number {
  const size = battingTeamId === match.teamA.id ? match.squadA.length : match.squadB.length
  return size || 11
}

function computeWinProbabilityTrajectory(match: Match, deliveries: Delivery[], inningsIndex: number): WinProbabilityPoint[] {
  const inn = match.innings[inningsIndex]
  if (!inn || inn.target == null) return []
  const totalBalls = match.oversPerInnings * match.ballsPerOver
  const maxWickets = Math.max(1, squadSize(match, inn.battingTeamId) - 1)
  const ordered = deliveries
    .filter((d) => d.inningsIndex === inningsIndex)
    .sort((a, b) => a.sequence - b.sequence)

  let runs = 0
  let legalBalls = 0
  let wickets = 0
  const points: WinProbabilityPoint[] = []
  let lastOverRecorded = -1
  for (const d of ordered) {
    runs += d.totalRuns
    if (d.isLegal) legalBalls += 1
    if (d.wicket) wickets += 1
    if (d.isLegal && d.ballInOver === match.ballsPerOver && d.overNumber !== lastOverRecorded) {
      lastOverRecorded = d.overNumber
      const runsNeeded = Math.max(0, inn.target - runs)
      const ballsRemaining = Math.max(0, totalBalls - legalBalls)
      const wicketsRemaining = Math.max(0, maxWickets - wickets)
      points.push({
        over: d.overNumber + 1,
        winProbability: chaseWinProbability({ runsNeeded, ballsRemaining, wicketsRemaining, ballsPerOver: match.ballsPerOver }),
      })
    }
  }
  return points
}

function biggestSwing(points: WinProbabilityPoint[]): WinProbabilitySwing | undefined {
  let best: WinProbabilitySwing | undefined
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].winProbability - points[i - 1].winProbability
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = {
        fromOver: points[i - 1].over,
        toOver: points[i].over,
        fromProbability: points[i - 1].winProbability,
        toProbability: points[i].winProbability,
        delta,
      }
    }
  }
  return best
}

/** Compares the first innings' actual total against a projection made from its own powerplay
 *  trajectory alone — a fair "how did the back half of the innings go" comparison, since
 *  comparing the final total to a projection made from the full innings would be trivially
 *  equal. Only computed for a non-chasing (first) innings; a chase is better read through win
 *  probability, not expected score. */
function computeExpectedVsActual(match: Match, deliveries: Delivery[], inningsIndex: number): ExpectedVsActual | undefined {
  const inn = match.innings[inningsIndex]
  if (!inn || inn.target != null) return undefined
  const powerplayOvers = resolvePowerplayOvers(match)
  if (powerplayOvers <= 0) return undefined
  const totalBalls = match.oversPerInnings * match.ballsPerOver
  const powerplayBallsLimit = powerplayOvers * match.ballsPerOver
  const maxWickets = Math.max(1, squadSize(match, inn.battingTeamId) - 1)

  let runsAtPP = 0
  let legalBallsAtPP = 0
  let wicketsAtPP = 0
  for (const d of deliveries.filter((x) => x.inningsIndex === inningsIndex).sort((a, b) => a.sequence - b.sequence)) {
    if (legalBallsAtPP >= powerplayBallsLimit) break
    runsAtPP += d.totalRuns
    if (d.isLegal) legalBallsAtPP += 1
    if (d.wicket) wicketsAtPP += 1
  }
  if (legalBallsAtPP === 0) return undefined

  const projected = projectFirstInningsScore({
    currentRuns: runsAtPP,
    ballsBowled: legalBallsAtPP,
    ballsRemaining: Math.max(0, totalBalls - legalBallsAtPP),
    wicketsRemaining: Math.max(0, maxWickets - wicketsAtPP),
    ballsPerOver: match.ballsPerOver,
  })
  return {
    inningsIndex,
    projectedFromPowerplay: projected,
    actual: inn.totalRuns,
    delta: inn.totalRuns - projected,
  }
}

/** A specialist batter (top 6 in the order) dismissed for under 10 runs having faced at least 5
 *  balls — a real start that didn't convert. Deliberately narrow and explainable, not a vague
 *  "bad performance" judgment. */
function findUnderperformers(match: Match): UnderperformerEntry[] {
  const out: UnderperformerEntry[] = []
  for (const inn of match.innings) {
    for (const b of inn.battingCard) {
      if (b.battingOrder <= 6 && b.out && b.runs < 10 && b.balls >= 5) {
        out.push({
          playerId: b.playerId,
          runs: b.runs,
          balls: b.balls,
          note: `Out for ${b.runs} off ${b.balls} balls — a start that didn't convert.`,
        })
      }
    }
  }
  return out
}

function tallyFielding(match: Match): FieldingContribution[] {
  const map = new Map<string, FieldingContribution>()
  const bump = (id: string, key: 'catches' | 'runOuts' | 'stumpings') => {
    const row = map.get(id) ?? { playerId: id, catches: 0, runOuts: 0, stumpings: 0 }
    row[key] += 1
    map.set(id, row)
  }
  for (const inn of match.innings) {
    for (const b of inn.battingCard) {
      if (!b.fielderId) continue
      if (b.dismissalType === 'caught') bump(b.fielderId, 'catches')
      else if (b.dismissalType === 'run_out') bump(b.fielderId, 'runOuts')
      else if (b.dismissalType === 'stumped') bump(b.fielderId, 'stumpings')
    }
  }
  return [...map.values()].sort(
    (a, b) => b.catches + b.runOuts + b.stumpings - (a.catches + a.runOuts + a.stumpings),
  )
}

function inningsSummarySentences(ins: InningsInsights): string[] {
  const out: string[] = []
  out.push(
    `${ins.boundaryPct.toFixed(0)}% of runs came in boundaries (${ins.fours} fours, ${ins.sixes} sixes); ${ins.dotPct.toFixed(0)}% of balls were dots.`,
  )
  if (ins.powerplayOvers > 0) {
    out.push(`${ins.powerplayRuns} runs came in the powerplay (${ins.powerplayOvers} overs).`)
  }
  if (ins.bestPartnership) {
    out.push(`Best partnership: ${ins.bestPartnership.runs} runs off ${ins.bestPartnership.balls} balls.`)
  }
  if (ins.bestSpell) {
    out.push(
      `Tightest spell: ${ins.bestSpell.overs} overs for ${ins.bestSpell.runs} runs${ins.bestSpell.wickets > 0 ? ` (${ins.bestSpell.wickets} wkt${ins.bestSpell.wickets === 1 ? '' : 's'})` : ''}, economy ${ins.bestSpell.economy.toFixed(2)}.`,
    )
  }
  return out
}

export function buildMatchReport(match: Match, deliveries: Delivery[]): MatchReport {
  const insightsList = matchInsights(match, deliveries)
  const chaseInningsIndex = match.innings.findIndex((i) => i.target != null)
  const trajectory = chaseInningsIndex >= 0 ? computeWinProbabilityTrajectory(match, deliveries, chaseInningsIndex) : []
  const firstInningsIndex = match.innings.findIndex((i) => i.target == null)
  const expectedVsActual =
    firstInningsIndex >= 0 ? computeExpectedVsActual(match, deliveries, firstInningsIndex) : undefined

  return {
    matchId: match.id,
    resultSummary: match.result?.summary ?? 'Result not yet available.',
    expectedVsActual,
    winProbabilityTrajectory: trajectory,
    biggestSwing: biggestSwing(trajectory),
    topPerformers: matchTopPerformers(match),
    underperformers: findUnderperformers(match),
    fielding: tallyFielding(match),
    inningsReports: insightsList.map((ins) => ({
      inningsIndex: ins.inningsIndex,
      battingTeamId: ins.battingTeamId,
      totalRuns: ins.totalRuns,
      wickets: match.innings[ins.inningsIndex]?.wickets ?? 0,
      legalBalls: ins.legalBalls,
      summary: inningsSummarySentences(ins),
    })),
    keyMoments: extractMatchHighlights(match, deliveries).slice(0, 8),
  }
}
