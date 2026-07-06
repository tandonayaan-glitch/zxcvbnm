/* ==================================================================
 * Player career timeline — notable milestones in chronological order,
 * derived from the match-by-match performance log. Pure.
 * ================================================================== */
import type { Match } from '@/types'
import { playerPerformances } from './stats'

export type TimelineIcon = 'debut' | 'fifty' | 'hundred' | 'fivefor' | 'best' | 'latest'

export interface TimelineEvent {
  matchId: string
  date: number
  icon: TimelineIcon
  title: string
  detail: string
}

export function playerTimeline(playerId: string, matches: Match[]): TimelineEvent[] {
  const perfs = playerPerformances(playerId, matches) // newest-first
  if (perfs.length === 0) return []
  const chrono = [...perfs].reverse() // oldest-first

  const events: TimelineEvent[] = []
  const debut = chrono[0]
  events.push({
    matchId: debut.matchId,
    date: debut.date,
    icon: 'debut',
    title: 'Debut',
    detail: `vs ${debut.opponent}`,
  })

  // Career bests, to flag the standout innings/spell exactly once.
  let bestBatId: string | null = null
  let bestBatRuns = -1
  let bestBowlId: string | null = null
  let bestBowlWkts = -1
  let bestBowlRuns = Infinity
  for (const p of chrono) {
    if (p.batting && p.batting.runs > bestBatRuns) {
      bestBatRuns = p.batting.runs
      bestBatId = p.matchId
    }
    if (
      p.bowling &&
      (p.bowling.wickets > bestBowlWkts ||
        (p.bowling.wickets === bestBowlWkts && p.bowling.runs < bestBowlRuns))
    ) {
      bestBowlWkts = p.bowling.wickets
      bestBowlRuns = p.bowling.runs
      bestBowlId = p.matchId
    }
  }

  for (const p of chrono) {
    if (p.batting) {
      if (p.batting.runs >= 100) {
        events.push({
          matchId: p.matchId,
          date: p.date,
          icon: 'hundred',
          title: 'Hundred',
          detail: `${p.batting.runs}${p.batting.out ? '' : '*'} vs ${p.opponent}`,
        })
      } else if (p.batting.runs >= 50) {
        events.push({
          matchId: p.matchId,
          date: p.date,
          icon: 'fifty',
          title: 'Fifty',
          detail: `${p.batting.runs}${p.batting.out ? '' : '*'} vs ${p.opponent}`,
        })
      }
    }
    if (p.bowling && p.bowling.wickets >= 5) {
      events.push({
        matchId: p.matchId,
        date: p.date,
        icon: 'fivefor',
        title: 'Five-wicket haul',
        detail: `${p.bowling.wickets}/${p.bowling.runs} vs ${p.opponent}`,
      })
    }
  }

  // Career-best markers (only when they aren't already a fifty/hundred/five-for
  // and the player has more than one appearance to compare).
  if (chrono.length > 1) {
    if (bestBatId && bestBatRuns > 0 && bestBatRuns < 50) {
      const p = chrono.find((x) => x.matchId === bestBatId)!
      events.push({
        matchId: p.matchId,
        date: p.date,
        icon: 'best',
        title: 'Career-best score',
        detail: `${p.batting!.runs}${p.batting!.out ? '' : '*'} vs ${p.opponent}`,
      })
    }
    if (bestBowlId && bestBowlWkts > 0 && bestBowlWkts < 5) {
      const p = chrono.find((x) => x.matchId === bestBowlId)!
      events.push({
        matchId: p.matchId,
        date: p.date,
        icon: 'best',
        title: 'Career-best bowling',
        detail: `${p.bowling!.wickets}/${p.bowling!.runs} vs ${p.opponent}`,
      })
    }
  }

  // Newest-first for display.
  return events.sort((a, b) => b.date - a.date)
}
