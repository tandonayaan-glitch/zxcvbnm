/* ==================================================================
 * Head-to-head — the completed-match record between two teams, read
 * from denormalised match result fields (robust to deleted team docs).
 * ================================================================== */
import type { Match } from '@/types'

export interface HeadToHead {
  played: number
  aWins: number
  bWins: number
  tied: number
  noResult: number
  /** Completed meetings, newest first. */
  meetings: {
    matchId: string
    winnerId: string | null
    summary: string
    date: number
  }[]
}

export function computeHeadToHead(
  aId: string,
  bId: string,
  matches: Match[],
): HeadToHead {
  const h: HeadToHead = {
    played: 0,
    aWins: 0,
    bWins: 0,
    tied: 0,
    noResult: 0,
    meetings: [],
  }

  for (const m of matches) {
    if (m.status !== 'completed') continue
    const ids = [m.teamA.id, m.teamB.id]
    if (!ids.includes(aId) || !ids.includes(bId)) continue

    h.played += 1
    const r = m.result
    if (r?.outcome === 'win' && r.winnerTeamId) {
      if (r.winnerTeamId === aId) h.aWins += 1
      else if (r.winnerTeamId === bId) h.bWins += 1
    } else if (r?.outcome === 'tie') {
      h.tied += 1
    } else {
      h.noResult += 1
    }

    h.meetings.push({
      matchId: m.id,
      winnerId: r?.winnerTeamId ?? null,
      summary: r?.summary ?? '',
      date: m.completedAt ?? m.createdAt,
    })
  }

  h.meetings.sort((x, y) => y.date - x.date)
  return h
}
