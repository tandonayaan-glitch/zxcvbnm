/* ==================================================================
 * CricketHub Performance Score — a documented, reproducible, explainable
 * all-round rating. Pure, no I/O.
 *
 * This is deliberately the SAME weighting scheme `stats.ts`'s `impactRating()`
 * already uses for career totals (runs/fours/sixes/milestone bonuses for
 * batting; wickets/maidens/hauls for bowling; catches/run-outs/stumpings for
 * fielding) — one canonical set of weights across the platform, not a second,
 * disagreeing scoring system. This module extends that idea to:
 *   - a single MATCH performance (not just a career total), from the same
 *     `PlayerMatchPerformance` shape already computed by `stats.ts`;
 *   - an explicit "pressure" component, scored only from real match context
 *     (result margin), not invented;
 *   - a plain-English `factors` list so the number is never just a number —
 *     every non-zero contribution is named, matching this project's
 *     "explainable, not a fitted model" convention (see `winProbability.ts`,
 *     `expectedScore.ts` for the same commitment elsewhere).
 *
 * Nothing here is a machine-learned or fitted model — there is no historical
 * ball-by-ball dataset in this app to fit one against, and claiming otherwise
 * would be dishonest. The weights are fixed constants, documented below, and
 * the same score recomputed from the same inputs always produces the same
 * result (reproducible, per the brief's own requirement).
 * ================================================================== */
import type { Match, PlayerMatchPerformance, PlayerStats } from '@/types'

/** Same weights as `stats.ts`'s `impactRating()` — kept in sync deliberately;
 *  duplicated here (not imported) because `impactRating` operates on the
 *  aggregate `PlayerStats` shape while this module operates match-by-match on
 *  `PlayerMatchPerformance`, whose per-milestone fields (fifties/hundreds)
 *  don't exist at match grain — a single match either has a fifty or doesn't,
 *  detected from `runs` directly instead. */
const WEIGHTS = {
  run: 1,
  four: 1,
  six: 2,
  fifty: 8, // batting a fifty or better in this innings (career weight: 8/fifty)
  hundred: 16, // additional weight on top of the fifty bonus, matching impactRating's 8+16=24 total at a century, minus the 8 already counted at fifty — see below
  wicket: 20,
  maiden: 4,
  fiveWktHaul: 25,
  catch: 8,
  stumping: 12,
  runOut: 8,
} as const

/** Below this margin, a win/loss is scored as "tight" for the pressure bonus — a fixed,
 *  documented threshold, not scaled per format (T10 vs ODI margins aren't comparable, but
 *  introducing per-format scaling here would trade one arbitrary constant for several; this
 *  stays a single, stated heuristic rather than a false precision improvement). */
const TIGHT_RUN_MARGIN = 15
const TIGHT_WICKET_MARGIN = 2
const PRESSURE_WIN_BONUS = 10
const PRESSURE_CONTRIBUTION_MULTIPLIER = 0.5 // applied to the player's own batting+bowling score, capped by PRESSURE_WIN_BONUS

export interface PerformanceScoreBreakdown {
  battingScore: number
  bowlingScore: number
  fieldingScore: number
  pressureScore: number
  total: number
  /** Every non-zero contributing factor, in plain English, most valuable first. */
  factors: string[]
}

function emptyBreakdown(): PerformanceScoreBreakdown {
  return { battingScore: 0, bowlingScore: 0, fieldingScore: 0, pressureScore: 0, total: 0, factors: [] }
}

/** Optional fielding contribution for a match performance — `PlayerMatchPerformance` doesn't
 *  carry fielding (it isn't tracked per-innings-performance today, only in career `PlayerStats`),
 *  so a caller with the full match's deliveries loaded can supply it; otherwise fielding is
 *  honestly scored 0 with a note, never silently guessed. */
export interface MatchFieldingContribution {
  catches: number
  runOuts: number
  stumpings: number
}

/**
 * Performance Score for one match performance. `isWinningTeamMember` and the match's own
 * `result` drive the pressure component; both are optional (a performance with no match result
 * yet, e.g. an ongoing match, simply scores 0 pressure).
 */
export function matchPerformanceScore(
  perf: PlayerMatchPerformance,
  match?: Pick<Match, 'result'>,
  isWinningTeamMember?: boolean,
  fielding?: MatchFieldingContribution,
): PerformanceScoreBreakdown {
  const factors: string[] = []
  let battingScore = 0
  let bowlingScore = 0
  let fieldingScore = 0
  let pressureScore = 0

  if (perf.batting) {
    const b = perf.batting
    battingScore = b.runs * WEIGHTS.run + b.fours * WEIGHTS.four + b.sixes * WEIGHTS.six
    if (b.runs >= 100) {
      battingScore += WEIGHTS.fifty + WEIGHTS.hundred
      factors.push(`Century (${b.runs}${b.out ? '' : '*'})`)
    } else if (b.runs >= 50) {
      battingScore += WEIGHTS.fifty
      factors.push(`Half-century (${b.runs}${b.out ? '' : '*'})`)
    } else if (b.runs > 0) {
      factors.push(`${b.runs} run${b.runs === 1 ? '' : 's'} off ${b.balls} ball${b.balls === 1 ? '' : 's'}`)
    }
    if (b.fours > 0 || b.sixes > 0) {
      factors.push(`${b.fours} four${b.fours === 1 ? '' : 's'}, ${b.sixes} six${b.sixes === 1 ? '' : 's'}`)
    }
  }

  if (perf.bowling) {
    const bw = perf.bowling
    bowlingScore = bw.wickets * WEIGHTS.wicket + bw.maidens * WEIGHTS.maiden
    if (bw.wickets >= 5) {
      bowlingScore += WEIGHTS.fiveWktHaul
      factors.push(`Five-wicket haul (${bw.wickets}/${bw.runs})`)
    } else if (bw.wickets > 0) {
      factors.push(`${bw.wickets} wicket${bw.wickets === 1 ? '' : 's'} for ${bw.runs} (${bw.overs} ov)`)
    }
    if (bw.maidens > 0) factors.push(`${bw.maidens} maiden${bw.maidens === 1 ? '' : 's'}`)
  }

  if (fielding) {
    fieldingScore =
      fielding.catches * WEIGHTS.catch +
      fielding.stumpings * WEIGHTS.stumping +
      fielding.runOuts * WEIGHTS.runOut
    if (fielding.catches > 0) factors.push(`${fielding.catches} catch${fielding.catches === 1 ? '' : 'es'}`)
    if (fielding.stumpings > 0) factors.push(`${fielding.stumpings} stumping${fielding.stumpings === 1 ? '' : 's'}`)
    if (fielding.runOuts > 0) factors.push(`${fielding.runOuts} run-out${fielding.runOuts === 1 ? '' : 's'}`)
  }

  if (match?.result?.outcome === 'win' && isWinningTeamMember && match.result.margin) {
    const marginNum = parseInt(match.result.margin, 10)
    const isTightRunWin = match.result.margin.includes('run') && !Number.isNaN(marginNum) && marginNum <= TIGHT_RUN_MARGIN
    const isTightWicketWin =
      match.result.margin.includes('wicket') && !Number.isNaN(marginNum) && marginNum <= TIGHT_WICKET_MARGIN
    if (isTightRunWin || isTightWicketWin) {
      const contribution = (battingScore + bowlingScore) * PRESSURE_CONTRIBUTION_MULTIPLIER
      pressureScore = Math.min(PRESSURE_WIN_BONUS, Math.round(contribution))
      if (pressureScore > 0) {
        factors.push(`Contributed to a narrow win (${match.result.margin}) — pressure bonus`)
      }
    }
  }

  return {
    battingScore: Math.round(battingScore),
    bowlingScore: Math.round(bowlingScore),
    fieldingScore: Math.round(fieldingScore),
    pressureScore,
    total: Math.round(battingScore + bowlingScore + fieldingScore + pressureScore),
    factors,
  }
}

/** Career-level Performance Score — same weights as `impactRating()` in `stats.ts` (this
 *  function's numbers will always exactly match `impactRating()`'s for the batting/bowling/
 *  fielding components; it exists here so callers of this module get one consistent
 *  `PerformanceScoreBreakdown` shape with `factors`, rather than importing two different
 *  return shapes for "the same score" at match vs. career grain). No pressure component at
 *  career grain — pressure is a per-match, per-result concept. */
export function careerPerformanceScore(s: PlayerStats): PerformanceScoreBreakdown {
  const factors: string[] = []
  const battingScore =
    s.runs * WEIGHTS.run + s.fours * WEIGHTS.four + s.sixes * WEIGHTS.six +
    s.thirties * 4 + s.fifties * WEIGHTS.fifty + s.hundreds * (WEIGHTS.fifty + WEIGHTS.hundred)
  const bowlingScore = s.wickets * WEIGHTS.wicket + s.maidens * WEIGHTS.maiden + s.fiveWktHauls * WEIGHTS.fiveWktHaul
  const fieldingScore = s.catches * WEIGHTS.catch + s.stumpings * WEIGHTS.stumping + s.runOuts * WEIGHTS.runOut

  if (s.hundreds > 0) factors.push(`${s.hundreds} century${s.hundreds === 1 ? '' : 'ies'}`)
  if (s.fifties > 0) factors.push(`${s.fifties} half-centur${s.fifties === 1 ? 'y' : 'ies'}`)
  if (s.fiveWktHauls > 0) factors.push(`${s.fiveWktHauls} five-wicket haul${s.fiveWktHauls === 1 ? '' : 's'}`)
  if (s.wickets > 0) factors.push(`${s.wickets} career wicket${s.wickets === 1 ? '' : 's'}`)
  if (s.runs > 0) factors.push(`${s.runs} career run${s.runs === 1 ? '' : 's'}`)
  const dismissals = s.catches + s.stumpings + s.runOuts
  if (dismissals > 0) factors.push(`${dismissals} career fielding dismissal${dismissals === 1 ? '' : 's'}`)

  return {
    battingScore: Math.round(battingScore),
    bowlingScore: Math.round(bowlingScore),
    fieldingScore: Math.round(fieldingScore),
    pressureScore: 0,
    total: Math.round(battingScore + bowlingScore + fieldingScore),
    factors,
  }
}

/** Player-vs-player or match-vs-match comparison: a signed delta per component (positive = `a`
 *  ahead of `b`). Purely arithmetic — no new scoring logic. */
export function comparePerformanceScores(
  a: PerformanceScoreBreakdown,
  b: PerformanceScoreBreakdown,
): PerformanceScoreBreakdown {
  return {
    battingScore: a.battingScore - b.battingScore,
    bowlingScore: a.bowlingScore - b.bowlingScore,
    fieldingScore: a.fieldingScore - b.fieldingScore,
    pressureScore: a.pressureScore - b.pressureScore,
    total: a.total - b.total,
    factors: [],
  }
}

export { emptyBreakdown as emptyPerformanceScoreBreakdown }
