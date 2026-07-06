/* ==================================================================
 * Star performers of a match — the top batting and bowling display from
 * the innings cards. Pure; used for an at-a-glance match highlight.
 * ================================================================== */
import type { Match } from '@/types'

export interface MatchBatter {
  playerId: string
  runs: number
  balls: number
  out: boolean
  teamId: string
}

export interface MatchBowler {
  playerId: string
  wickets: number
  runs: number
  balls: number
  teamId: string
}

export function matchTopPerformers(match: Match): {
  batter?: MatchBatter
  bowler?: MatchBowler
} {
  let batter: MatchBatter | undefined
  let bowler: MatchBowler | undefined

  for (const inn of match.innings) {
    for (const b of inn.battingCard) {
      if (b.balls === 0 && !b.out && b.runs === 0) continue
      if (!batter || b.runs > batter.runs) {
        batter = {
          playerId: b.playerId,
          runs: b.runs,
          balls: b.balls,
          out: b.out,
          teamId: inn.battingTeamId,
        }
      }
    }
    for (const w of inn.bowlingCard) {
      if (w.legalBalls === 0 && w.wides === 0 && w.noBalls === 0) continue
      const better =
        !bowler ||
        w.wickets > bowler.wickets ||
        (w.wickets === bowler.wickets && w.runsConceded < bowler.runs)
      if (better) {
        bowler = {
          playerId: w.playerId,
          wickets: w.wickets,
          runs: w.runsConceded,
          balls: w.legalBalls,
          teamId: inn.bowlingTeamId,
        }
      }
    }
  }

  return { batter, bowler }
}
