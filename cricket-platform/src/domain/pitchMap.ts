/* ==================================================================
 * Pitch / bowling map — aggregates optional line+length tags against the
 * ball-by-ball delivery record. Pure, no I/O. Only ever has data for balls
 * the scorer chose to tag.
 * ================================================================== */
import type { BallMeta, BowlingLength, BowlingLine, Delivery } from '@/types'

export const BOWLING_LINES: BowlingLine[] = [
  'wide_leg',
  'leg',
  'stump',
  'outside_off',
  'wide_off',
]
export const BOWLING_LENGTHS: BowlingLength[] = [
  'full_toss',
  'yorker',
  'full',
  'good',
  'short',
  'bouncer',
]

export interface PitchMapCell {
  line: BowlingLine
  length: BowlingLength
  balls: number
  runs: number
  wickets: number
  dots: number
}

/** One row per line x length combination, always present (0s where untagged). */
export function pitchMapData(
  deliveries: Delivery[],
  ballMeta: BallMeta[],
  filterBowlerId?: string,
): PitchMapCell[] {
  const tagById = new Map(ballMeta.map((m) => [m.id, m]))
  const cells = new Map<string, PitchMapCell>()
  for (const line of BOWLING_LINES) {
    for (const length of BOWLING_LENGTHS) {
      cells.set(`${line}|${length}`, { line, length, balls: 0, runs: 0, wickets: 0, dots: 0 })
    }
  }

  for (const d of deliveries) {
    const tag = tagById.get(d.id)
    if (!tag?.line || !tag?.length) continue
    if (filterBowlerId && d.bowlerId !== filterBowlerId) continue
    const cell = cells.get(`${tag.line}|${tag.length}`)!
    cell.balls += 1
    cell.runs += d.totalRuns
    if (d.wicket) cell.wickets += 1
    if (d.totalRuns === 0) cell.dots += 1
  }

  return [...cells.values()]
}

export function hasPitchMapData(ballMeta: BallMeta[]): boolean {
  return ballMeta.some((m) => m.line != null && m.length != null)
}
