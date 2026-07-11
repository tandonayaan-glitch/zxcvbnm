/* ==================================================================
 * Tournament timeline — a chronological feed of a tournament's
 * matches (scheduled or played), for a "what happened when" view
 * distinct from the Fixtures & Results list. Pure; reads only the
 * denormalised fields already on each match.
 * ================================================================== */
import type { KnockoutStage, Match, MatchStatus } from '@/types'

export interface TimelineEvent {
  matchId: string
  date: number
  teamAName: string
  teamBName: string
  status: MatchStatus
  summary?: string
  stage?: KnockoutStage | null
}

/** Every match in the tournament, ordered earliest to latest. */
export function tournamentTimeline(matches: Match[]): TimelineEvent[] {
  return matches
    .map((m) => ({
      matchId: m.id,
      date: m.completedAt ?? m.scheduledAt ?? m.createdAt,
      teamAName: m.teamA.name,
      teamBName: m.teamB.name,
      status: m.status,
      summary: m.result?.summary,
      stage: m.stage,
    }))
    .sort((a, b) => a.date - b.date)
}
