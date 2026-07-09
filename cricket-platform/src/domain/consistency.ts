/* ==================================================================
 * Batting consistency — how little a player's scores vary innings to
 * innings, via the coefficient of variation (stddev / mean) of runs per
 * innings. Lower variation = more consistent. Pure; requires a minimum
 * sample size so a single big score doesn't read as "perfectly consistent".
 * ================================================================== */
import type { Match } from '@/types'
import type { Leaderboard } from './stats'

const MIN_INNINGS = 3

export interface ConsistencyRow {
  playerId: string
  innings: number
  average: number
  stdDev: number
  /** Coefficient of variation, as a percentage — lower is more consistent. */
  variation: number
}

/** Runs per innings, per player, across completed matches. */
function battingInningsByPlayer(matches: Match[]): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const m of matches) {
    if (m.status !== 'completed') continue
    for (const inn of m.innings) {
      for (const b of inn.battingCard) {
        const batted = b.balls > 0 || b.out || b.runs > 0
        if (!batted) continue
        const arr = map.get(b.playerId) ?? []
        arr.push(b.runs)
        map.set(b.playerId, arr)
      }
    }
  }
  return map
}

export function computeBattingConsistency(matches: Match[]): ConsistencyRow[] {
  const rows: ConsistencyRow[] = []
  for (const [playerId, runs] of battingInningsByPlayer(matches)) {
    if (runs.length < MIN_INNINGS) continue
    const n = runs.length
    const mean = runs.reduce((a, r) => a + r, 0) / n
    const variance = runs.reduce((a, r) => a + (r - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)
    const variation = mean > 0 ? (stdDev / mean) * 100 : 0
    rows.push({ playerId, innings: n, average: mean, stdDev, variation })
  }
  return rows.sort((a, b) => a.variation - b.variation)
}

/** Leaderboard view — higher bar = more consistent, so the raw (lower-is-
 * better) variation is inverted for the bar-scaling `value`. */
export function buildConsistencyBoard(matches: Match[], limit = 10): Leaderboard {
  const rows = computeBattingConsistency(matches)
    .slice(0, limit)
    .map((r) => ({
      playerId: r.playerId,
      value: Math.max(0, 100 - r.variation),
      display: `${r.variation.toFixed(0)}% var`,
      sub: `avg ${r.average.toFixed(1)} · ${r.innings} inn`,
    }))
  return {
    key: 'consistency',
    title: 'Most consistent batters',
    icon: 'gauge',
    rows,
  }
}
