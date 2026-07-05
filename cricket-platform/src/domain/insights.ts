import type { Delivery, Match } from '@/types'

/** A single completed/open batting partnership within an innings. */
export interface Partnership {
  runs: number
  balls: number
  batterA: string
  batterB: string
  /** 1-based wicket number this partnership ended on (0 = still unbroken). */
  endedOnWicket: number
}

export interface InningsInsights {
  inningsIndex: number
  battingTeamId: string
  battingShort: string
  totalRuns: number
  legalBalls: number
  /** Highest-scoring single over. */
  biggestOver?: { over: number; runs: number; wickets: number; bowlerId: string }
  /** Best (highest-run) partnership of the innings. */
  bestPartnership?: Partnership
  fours: number
  sixes: number
  /** Runs scored in boundaries (4s + 6s off the bat). */
  boundaryRuns: number
  /** Boundary runs as a share of the total (0–100). */
  boundaryPct: number
  /** Legal balls that yielded no runs. */
  dotBalls: number
  dotPct: number
  /** Runs in the opening powerplay and how many overs it spans. */
  powerplayRuns: number
  powerplayOvers: number
}

function powerplayOverCount(match: Match): number {
  const total = match.oversPerInnings
  switch (match.format) {
    case 'T20':
      return Math.min(6, total)
    case 'ODI':
      return Math.min(10, total)
    case 'T10':
      return Math.min(3, total)
    case 'THE_HUNDRED':
      return Math.min(5, total) // ~25 balls
    default:
      return Math.min(Math.max(1, Math.round(total * 0.3)), total)
  }
}

function isCountedWicket(d: Delivery): boolean {
  return !!d.wicket && d.wicket.type !== 'retired_hurt'
}

/** Compute insights for one innings from its raw deliveries. */
export function inningsInsights(
  match: Match,
  deliveries: Delivery[],
  inningsIndex: number,
): InningsInsights {
  const inn = match.innings[inningsIndex]
  const battingShort =
    inn && inn.battingTeamId === match.teamA.id
      ? match.teamA.shortName
      : match.teamB.shortName

  const balls = deliveries
    .filter((d) => d.inningsIndex === inningsIndex)
    .sort((a, b) => a.sequence - b.sequence)

  // Per-over aggregation for the biggest over.
  const overMap = new Map<
    number,
    { runs: number; wickets: number; bowlerId: string }
  >()
  const ppOvers = powerplayOverCount(match)

  let totalRuns = 0
  let legalBalls = 0
  let fours = 0
  let sixes = 0
  let boundaryRuns = 0
  let dotBalls = 0
  let powerplayRuns = 0

  // Partnership tracking.
  const partnerships: Partnership[] = []
  let cur: Partnership | null = null
  let wicketsSoFar = 0

  for (const d of balls) {
    totalRuns += d.totalRuns
    if (d.isLegal) legalBalls += 1
    if (d.runsOffBat === 4) {
      fours += 1
      boundaryRuns += 4
    } else if (d.runsOffBat === 6) {
      sixes += 1
      boundaryRuns += 6
    }
    if (d.isLegal && d.totalRuns === 0 && !isCountedWicket(d)) dotBalls += 1
    if (d.overNumber < ppOvers) powerplayRuns += d.totalRuns

    const o = overMap.get(d.overNumber) ?? {
      runs: 0,
      wickets: 0,
      bowlerId: d.bowlerId,
    }
    o.runs += d.totalRuns
    if (isCountedWicket(d)) o.wickets += 1
    o.bowlerId = d.bowlerId
    overMap.set(d.overNumber, o)

    // Partnership: open a new one on the first ball of the innings or after a wicket.
    if (!cur) {
      cur = {
        runs: 0,
        balls: 0,
        batterA: d.strikerId,
        batterB: d.nonStrikerId,
        endedOnWicket: 0,
      }
    }
    cur.runs += d.totalRuns
    if (d.isLegal) cur.balls += 1
    if (isCountedWicket(d)) {
      wicketsSoFar += 1
      cur.endedOnWicket = wicketsSoFar
      partnerships.push(cur)
      cur = null
    }
  }
  if (cur && (cur.runs > 0 || cur.balls > 0)) partnerships.push(cur)

  let biggestOver:
    | { over: number; runs: number; wickets: number; bowlerId: string }
    | undefined
  for (const [over, v] of overMap) {
    if (!biggestOver || v.runs > biggestOver.runs) {
      biggestOver = { over: over + 1, runs: v.runs, wickets: v.wickets, bowlerId: v.bowlerId }
    }
  }

  const bestPartnership = partnerships.reduce<Partnership | undefined>(
    (best, p) => (!best || p.runs > best.runs ? p : best),
    undefined,
  )

  return {
    inningsIndex,
    battingTeamId: inn?.battingTeamId ?? '',
    battingShort,
    totalRuns,
    legalBalls,
    biggestOver,
    bestPartnership,
    fours,
    sixes,
    boundaryRuns,
    boundaryPct: totalRuns > 0 ? Math.round((boundaryRuns / totalRuns) * 100) : 0,
    dotBalls,
    dotPct: legalBalls > 0 ? Math.round((dotBalls / legalBalls) * 100) : 0,
    powerplayRuns,
    powerplayOvers: ppOvers,
  }
}

/** Insights for every innings that has at least one delivery. */
export function matchInsights(
  match: Match,
  deliveries: Delivery[],
): InningsInsights[] {
  return match.innings
    .map((_, i) => inningsInsights(match, deliveries, i))
    .filter((ins) => ins.legalBalls > 0 || ins.totalRuns > 0)
}
