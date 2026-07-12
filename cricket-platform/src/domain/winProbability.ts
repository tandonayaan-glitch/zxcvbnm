/**
 * Heuristic second-innings win-probability estimate for the chasing side,
 * derived from the same required-rate / wickets-in-hand signals a broadcast
 * graphic uses. This is a deliberate heuristic, not a trained model — there
 * is no historical ball-by-ball dataset in this app to fit one on, and
 * fabricating false precision would be worse than a transparent estimate.
 */
export function chaseWinProbability(params: {
  runsNeeded: number
  ballsRemaining: number
  wicketsRemaining: number
  ballsPerOver: number
}): number {
  const { runsNeeded, ballsRemaining, wicketsRemaining, ballsPerOver } = params
  if (runsNeeded <= 0) return 100
  if (ballsRemaining <= 0 || wicketsRemaining <= 0) return 0

  const requiredRate = (runsNeeded / ballsRemaining) * ballsPerOver
  // The rate a side can plausibly sustain scales with wickets in hand — ten
  // wickets can push a much higher required rate than two.
  const achievableRate = 4 + wicketsRemaining * 1.1
  const pressure = (achievableRate - requiredRate) / achievableRate
  const wicketConfidence = (wicketsRemaining / 10) * 0.5
  const score = pressure * 3 + wicketConfidence
  const prob = 100 / (1 + Math.exp(-score * 2.2))
  return Math.round(Math.min(99, Math.max(1, prob)))
}
