/* ==================================================================
 * Batter vs Bowler — per-opponent breakdown of a batter's record against
 * every bowler they've faced. Pure, no I/O; caller supplies the deliveries
 * (typically every ball across every match the batter has played).
 * ================================================================== */
import type { Delivery } from '@/types'

export interface BatterVsBowlerRecord {
  bowlerId: string
  runs: number
  /** Balls faced — legal deliveries only; a wide is bowled but never faced,
   *  matching `scoring.ts`'s own "striker.balls += 1 unless extra === 'wide'"
   *  convention exactly, so this stays consistent with every other balls-
   *  faced figure in the app. */
  balls: number
  dismissals: number
  fours: number
  sixes: number
  dots: number
}

/** One row per bowler the batter has actually faced at least once, sorted by
 *  balls faced (most-contested matchups first). No zero-filled rows — unlike
 *  the wagon-wheel/pitch-map grids, there's no fixed enum of "every possible
 *  bowler" to pad out. */
export function batterVsBowlerBreakdown(
  deliveries: Delivery[],
  batterId: string,
): BatterVsBowlerRecord[] {
  const rows = new Map<string, BatterVsBowlerRecord>()

  for (const d of deliveries) {
    if (d.strikerId !== batterId) continue
    let row = rows.get(d.bowlerId)
    if (!row) {
      row = {
        bowlerId: d.bowlerId,
        runs: 0,
        balls: 0,
        dismissals: 0,
        fours: 0,
        sixes: 0,
        dots: 0,
      }
      rows.set(d.bowlerId, row)
    }

    row.runs += d.runsOffBat
    if (d.extraType !== 'wide') row.balls += 1
    if (!d.extraType && d.runsOffBat === 4) row.fours += 1
    if (!d.extraType && d.runsOffBat === 6) row.sixes += 1
    if (d.totalRuns === 0) row.dots += 1
    if (d.wicket && d.wicket.outBatterId === batterId) row.dismissals += 1
  }

  return [...rows.values()].sort((a, b) => b.balls - a.balls)
}

/** Same breakdown, narrowed to a single opponent bowler — for a focused
 *  "head to head vs this bowler" view rather than the full table. */
export function batterVsOneBowler(
  deliveries: Delivery[],
  batterId: string,
  bowlerId: string,
): BatterVsBowlerRecord | undefined {
  return batterVsBowlerBreakdown(deliveries, batterId).find(
    (r) => r.bowlerId === bowlerId,
  )
}
