/* ==================================================================
 * Match milestones — pure derivation from a just-completed match's
 * denormalized innings state. No side effects; the caller resolves
 * player names and decides what to do with each event (activity log,
 * notification, etc).
 * ================================================================== */
import type { Match } from '@/types'

export type MilestoneType = 'century' | 'half_century' | 'five_wicket_haul'

export interface Milestone {
  type: MilestoneType
  playerId: string
  inningsIndex: number
  value: number // runs for batting milestones, wickets for bowling
}

/** Half-centuries are only reported up to 99 — 100+ is a century instead. */
export function detectMilestones(match: Match): Milestone[] {
  const out: Milestone[] = []
  for (const inn of match.innings) {
    for (const b of inn.battingCard) {
      if (b.runs >= 100) {
        out.push({ type: 'century', playerId: b.playerId, inningsIndex: inn.index, value: b.runs })
      } else if (b.runs >= 50) {
        out.push({ type: 'half_century', playerId: b.playerId, inningsIndex: inn.index, value: b.runs })
      }
    }
    for (const bw of inn.bowlingCard) {
      if (bw.wickets >= 5) {
        out.push({
          type: 'five_wicket_haul',
          playerId: bw.playerId,
          inningsIndex: inn.index,
          value: bw.wickets,
        })
      }
    }
  }
  return out
}
