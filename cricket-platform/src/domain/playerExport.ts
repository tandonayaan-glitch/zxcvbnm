/* ==================================================================
 * Player export — build CSV / JSON from a player's career stats,
 * per-tournament splits and match-by-match performance log. Pure string
 * builders; the UI wires the download.
 * ================================================================== */
import type { Player, PlayerStats, PlayerMatchPerformance } from '@/types'
import type { TournamentSplit } from './playerSplits'
import { battingAverage, strikeRate, formatBestBowling } from '@/lib/format'
import { csvCell } from '@/lib/download'

export interface PlayerExport {
  player: Player
  stats: PlayerStats | null
  splits: TournamentSplit[]
  performances: PlayerMatchPerformance[]
}

export function playerToCSV(data: PlayerExport): string {
  const { player: p, stats: s, splits, performances } = data
  const rows: (string | number)[][] = []

  rows.push(['Player', p.fullName])
  rows.push(['Role', p.role])
  rows.push([])

  rows.push(['Career'])
  if (s) {
    const dismissals = s.inningsBatted - s.notOuts
    rows.push(['Matches', s.matches])
    rows.push(['Runs', s.runs, 'Average', battingAverage(s.runs, dismissals)])
    rows.push(['Strike rate', strikeRate(s.runs, s.ballsFaced)])
    rows.push(['Wickets', s.wickets, 'Best bowling', formatBestBowling(s.bestBowlingWkts, s.bestBowlingRuns)])
    rows.push(['Catches', s.catches, 'Run outs', s.runOuts, 'Stumpings', s.stumpings])
  } else {
    rows.push(['No career stats yet'])
  }
  rows.push([])

  if (splits.length > 0) {
    rows.push(['By tournament'])
    rows.push(['Tournament', 'M', 'Runs', 'Wkts'])
    for (const sp of splits) {
      rows.push([sp.tournamentName, sp.stats.matches, sp.stats.runs, sp.stats.wickets])
    }
    rows.push([])
  }

  if (performances.length > 0) {
    rows.push(['Match log'])
    rows.push(['Opponent', 'Batting', 'Bowling'])
    for (const perf of performances) {
      const bat = perf.batting
        ? `${perf.batting.runs}${perf.batting.out ? '' : '*'} (${perf.batting.balls})`
        : ''
      const bowl = perf.bowling
        ? `${perf.bowling.wickets}/${perf.bowling.runs} (${perf.bowling.overs})`
        : ''
      rows.push([perf.opponent, bat, bowl])
    }
  }

  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

export function playerToJSON(data: PlayerExport): string {
  return JSON.stringify(data, null, 2)
}
