/* ==================================================================
 * Team vs-opponents record — a team's completed-match record broken
 * down by opponent. Pure; reads denormalised team + result fields.
 * ================================================================== */
import type { Match } from '@/types'

export interface OpponentRecord {
  opponentId: string
  opponentName: string
  opponentShort: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
}

export function teamOpponentRecords(
  teamId: string,
  matches: Match[],
): OpponentRecord[] {
  const map = new Map<string, OpponentRecord>()

  for (const m of matches) {
    if (m.status !== 'completed') continue
    if (m.teamA.id !== teamId && m.teamB.id !== teamId) continue

    const opp = m.teamA.id === teamId ? m.teamB : m.teamA
    let rec = map.get(opp.id)
    if (!rec) {
      rec = {
        opponentId: opp.id,
        opponentName: opp.name,
        opponentShort: opp.shortName,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
      }
      map.set(opp.id, rec)
    }

    rec.played += 1
    const r = m.result
    if (r?.outcome === 'win' && r.winnerTeamId) {
      if (r.winnerTeamId === teamId) rec.won += 1
      else rec.lost += 1
    } else if (r?.outcome === 'tie') {
      rec.tied += 1
    } else {
      rec.noResult += 1
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.played - a.played || a.opponentName.localeCompare(b.opponentName),
  )
}
