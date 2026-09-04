/* Pure toss-outcome analytics over completed matches. No I/O. */
import type { Match } from '@/types'

export interface TossInsights {
  totalDecided: number
  batFirstCount: number
  bowlFirstCount: number
  /** Of matches where the toss winner also won the match. */
  tossWinnerWonCount: number
  tossWinnerWonPct: number
  /** Of matches where the toss winner chose to bat first and won. */
  batFirstWinPct: number
  /** Of matches where the toss winner chose to bowl first and won. */
  bowlFirstWinPct: number
}

/** Real counts only — every percentage is `count / total`, never a modeled probability, and
 *  correlation (toss winner also won) is reported as exactly that, not implied causation. */
export function computeTossInsights(matches: Match[]): TossInsights {
  const decided = matches.filter(
    (m) => m.status === 'completed' && m.toss && m.result?.outcome === 'win',
  )

  const batFirst = decided.filter((m) => m.toss!.decision === 'bat')
  const bowlFirst = decided.filter((m) => m.toss!.decision === 'bowl')

  const tossWinnerWon = decided.filter((m) => m.toss!.wonByTeamId === m.result!.winnerTeamId)
  const batFirstWon = batFirst.filter((m) => m.toss!.wonByTeamId === m.result!.winnerTeamId)
  const bowlFirstWon = bowlFirst.filter((m) => m.toss!.wonByTeamId === m.result!.winnerTeamId)

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

  return {
    totalDecided: decided.length,
    batFirstCount: batFirst.length,
    bowlFirstCount: bowlFirst.length,
    tossWinnerWonCount: tossWinnerWon.length,
    tossWinnerWonPct: pct(tossWinnerWon.length, decided.length),
    batFirstWinPct: pct(batFirstWon.length, batFirst.length),
    bowlFirstWinPct: pct(bowlFirstWon.length, bowlFirst.length),
  }
}
