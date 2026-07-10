/* ==================================================================
 * Player radar profile — six batting/bowling/fielding axes normalised to
 * 0-100 against fixed reference benchmarks (not other players), so a
 * single player's radar is meaningful without needing a comparison set.
 * Deliberately simple and explainable, like the impact rating.
 * ================================================================== */
import type { PlayerStats } from '@/types'

export interface RadarAxis {
  label: string
  /** 0-100, clamped, for plotting. */
  value: number
  /** Human-readable raw stat, for the tooltip/legend. */
  raw: string
}

// Reference benchmarks a strong all-round performer might reach — used only
// to scale the radar's 0-100 axes, not as a ranking against other players.
const BENCH = { runs: 300, average: 50, strikeRate: 180, wickets: 25, economy: 10, fielding: 15 }

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export function playerRadarProfile(s: PlayerStats): RadarAxis[] {
  const dismissals = s.inningsBatted - s.notOuts
  const average = dismissals > 0 ? s.runs / dismissals : s.runs
  const strikeRate = s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : 0
  const economy = s.ballsBowled > 0 ? (s.runsConceded / s.ballsBowled) * 6 : null
  const fielding = s.catches + s.runOuts + s.stumpings

  return [
    { label: 'Runs', value: clamp((s.runs / BENCH.runs) * 100), raw: String(s.runs) },
    { label: 'Average', value: clamp((average / BENCH.average) * 100), raw: average.toFixed(1) },
    { label: 'Strike rate', value: clamp((strikeRate / BENCH.strikeRate) * 100), raw: strikeRate.toFixed(1) },
    { label: 'Wickets', value: clamp((s.wickets / BENCH.wickets) * 100), raw: String(s.wickets) },
    {
      label: 'Economy',
      value: economy != null ? clamp(((BENCH.economy - economy) / BENCH.economy) * 100) : 0,
      raw: economy != null ? economy.toFixed(2) : '—',
    },
    { label: 'Fielding', value: clamp((fielding / BENCH.fielding) * 100), raw: String(fielding) },
  ]
}
