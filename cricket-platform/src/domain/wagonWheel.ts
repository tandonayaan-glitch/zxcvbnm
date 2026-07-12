/* ==================================================================
 * Wagon wheel — aggregates optional shot-zone tags against the ball-by-
 * ball delivery record. Pure, no I/O. Only ever has data for balls the
 * scorer chose to tag (`BallMeta.zone`); deliveries without a tag are
 * simply excluded rather than guessed.
 * ================================================================== */
import type { BallMeta, Delivery, ShotZone } from '@/types'

export interface WagonWheelZone {
  zone: ShotZone
  runs: number
  balls: number
  fours: number
  sixes: number
}

/** One row per zone 1-8, in order, always present (0s where untagged). */
export function wagonWheelData(
  deliveries: Delivery[],
  ballMeta: BallMeta[],
  filterBatterId?: string,
): WagonWheelZone[] {
  const zoneById = new Map(ballMeta.filter((m) => m.zone != null).map((m) => [m.id, m.zone!]))
  const rows = new Map<ShotZone, WagonWheelZone>(
    ([1, 2, 3, 4, 5, 6, 7, 8] as ShotZone[]).map((z) => [
      z,
      { zone: z, runs: 0, balls: 0, fours: 0, sixes: 0 },
    ]),
  )

  for (const d of deliveries) {
    const zone = zoneById.get(d.id)
    if (!zone) continue
    if (filterBatterId && d.strikerId !== filterBatterId) continue
    if (d.extraType === 'wide') continue // never faced by the batter
    const row = rows.get(zone)!
    row.balls += 1
    row.runs += d.runsOffBat
    if (d.runsOffBat === 4) row.fours += 1
    if (d.runsOffBat === 6) row.sixes += 1
  }

  return [...rows.values()]
}

export function hasWagonWheelData(ballMeta: BallMeta[]): boolean {
  return ballMeta.some((m) => m.zone != null)
}
