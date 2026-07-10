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

/** A bowler's tightest stretch of consecutive-for-them overs in an innings. */
export interface BowlingSpell {
  bowlerId: string
  overs: number
  runs: number
  wickets: number
  economy: number
}

/** A single boundary or wicket, in ball order, for the innings timeline strip. */
export interface BoundaryWicketEvent {
  displayOver: string
  kind: 'four' | 'six' | 'wicket'
  /** The batter who hit the boundary, or who got out. */
  playerId: string
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
  /** Best (lowest-economy) 2-4 over stretch by a single bowler. */
  bestSpell?: BowlingSpell
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
  /** Every boundary and wicket, in ball order — for a compact timeline strip. */
  events: BoundaryWicketEvent[]
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

/**
 * The tightest 2–4 over stretch bowled by a single bowler, evaluated over
 * their own overs in bowling order (not necessarily consecutive over
 * numbers, since other bowlers interleave). Requires at least 2 overs from
 * that bowler so it reads as a "spell" rather than duplicating the
 * single-over "biggest over" or the innings-long best-bowling-figures stat.
 */
function findBestSpell(
  overMap: Map<
    number,
    { runs: number; wickets: number; bowlerId: string; legalBalls: number }
  >,
): BowlingSpell | undefined {
  const byBowler = new Map<
    string,
    { runs: number; wickets: number; legalBalls: number }[]
  >()
  for (const [, v] of [...overMap].sort((a, b) => a[0] - b[0])) {
    const arr = byBowler.get(v.bowlerId) ?? []
    arr.push({ runs: v.runs, wickets: v.wickets, legalBalls: v.legalBalls })
    byBowler.set(v.bowlerId, arr)
  }

  let best: BowlingSpell | undefined
  for (const [bowlerId, overs] of byBowler) {
    if (overs.length < 2) continue
    const maxWindow = Math.min(4, overs.length)
    for (let size = 2; size <= maxWindow; size++) {
      for (let start = 0; start + size <= overs.length; start++) {
        let runs = 0
        let wickets = 0
        let legalBalls = 0
        for (let i = start; i < start + size; i++) {
          runs += overs[i].runs
          wickets += overs[i].wickets
          legalBalls += overs[i].legalBalls
        }
        if (legalBalls === 0) continue
        const economy = (runs / legalBalls) * 6
        if (
          !best ||
          economy < best.economy ||
          (economy === best.economy && wickets > best.wickets)
        ) {
          best = { bowlerId, overs: size, runs, wickets, economy }
        }
      }
    }
  }
  return best
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

  // Per-over aggregation for the biggest over (and, grouped by bowler, the
  // best spell).
  const overMap = new Map<
    number,
    { runs: number; wickets: number; bowlerId: string; legalBalls: number }
  >()
  const ppOvers = powerplayOverCount(match)

  let totalRuns = 0
  let legalBalls = 0
  let fours = 0
  let sixes = 0
  let boundaryRuns = 0
  let dotBalls = 0
  let powerplayRuns = 0
  const events: BoundaryWicketEvent[] = []

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
      events.push({ displayOver: d.displayOver, kind: 'four', playerId: d.strikerId })
    } else if (d.runsOffBat === 6) {
      sixes += 1
      boundaryRuns += 6
      events.push({ displayOver: d.displayOver, kind: 'six', playerId: d.strikerId })
    }
    if (d.isLegal && d.totalRuns === 0 && !isCountedWicket(d)) dotBalls += 1
    if (d.overNumber < ppOvers) powerplayRuns += d.totalRuns

    const o = overMap.get(d.overNumber) ?? {
      runs: 0,
      wickets: 0,
      bowlerId: d.bowlerId,
      legalBalls: 0,
    }
    o.runs += d.totalRuns
    if (isCountedWicket(d)) o.wickets += 1
    if (d.isLegal) o.legalBalls += 1
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
      events.push({
        displayOver: d.displayOver,
        kind: 'wicket',
        playerId: d.wicket!.outBatterId,
      })
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

  const bestSpell = findBestSpell(overMap)

  return {
    inningsIndex,
    battingTeamId: inn?.battingTeamId ?? '',
    battingShort,
    totalRuns,
    legalBalls,
    biggestOver,
    bestPartnership,
    bestSpell,
    fours,
    sixes,
    boundaryRuns,
    boundaryPct: totalRuns > 0 ? Math.round((boundaryRuns / totalRuns) * 100) : 0,
    dotBalls,
    dotPct: legalBalls > 0 ? Math.round((dotBalls / legalBalls) * 100) : 0,
    powerplayRuns,
    powerplayOvers: ppOvers,
    events,
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
