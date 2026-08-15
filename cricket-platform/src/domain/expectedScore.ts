/* ==================================================================
 * Expected Score — first-innings projected final total. Pure, no I/O.
 * A documented heuristic, not a fitted model or a Duckworth-Lewis-style
 * resource calculation (there's no historical ball-by-ball dataset in this
 * app to calibrate either against, and claiming DLS-equivalence would be
 * actively misleading — same honesty this module's sibling,
 * `winProbability.ts`, already commits to).
 * ================================================================== */

/**
 * Extrapolates the current run rate across the overs remaining, then scales
 * that extrapolation down when wickets are already under pressure — a side
 * five wickets down has fewer recognized batters left to sustain the rate
 * than a side that's lost none. The wicket-in-hand scaling mirrors
 * `chaseWinProbability`'s own `wicketsRemaining / 10` normalization exactly
 * (a standard-XI assumption already accepted there) rather than introducing
 * a second, differently-scaled convention for the same "wickets remaining"
 * input the caller already computes.
 */
export function projectFirstInningsScore(params: {
  currentRuns: number
  ballsBowled: number
  ballsRemaining: number
  wicketsRemaining: number
  ballsPerOver: number
}): number {
  const { currentRuns, ballsBowled, ballsRemaining, wicketsRemaining, ballsPerOver } = params
  if (ballsBowled <= 0 || ballsRemaining <= 0) return currentRuns

  const currentRunRate = (currentRuns / ballsBowled) * ballsPerOver
  // Never below 0.5x (even a side with few wickets in hand can still keep
  // scoring, just more conservatively) or above 1x (this scales down an
  // already-observed rate, it isn't modelling acceleration).
  const wicketFactor = 0.5 + 0.5 * Math.min(1, Math.max(0, wicketsRemaining / 10))
  const oversRemaining = ballsRemaining / ballsPerOver

  return Math.round(currentRuns + currentRunRate * wicketFactor * oversRemaining)
}
