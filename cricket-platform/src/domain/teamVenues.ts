/* ==================================================================
 * Team venue record — a team's completed-match record grouped by venue.
 * Pure; reads the denormalised venue + result fields on each match.
 * ================================================================== */
import type { Match } from '@/types'

export interface VenueRecord {
  venue: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
}

export function teamVenueRecords(
  teamId: string,
  matches: Match[],
): VenueRecord[] {
  const map = new Map<string, VenueRecord>()

  for (const m of matches) {
    if (m.status !== 'completed') continue
    if (m.teamA.id !== teamId && m.teamB.id !== teamId) continue
    const venue = (m.venue ?? '').trim()
    if (!venue) continue

    let rec = map.get(venue)
    if (!rec) {
      rec = { venue, played: 0, won: 0, lost: 0, tied: 0, noResult: 0 }
      map.set(venue, rec)
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
    (a, b) => b.played - a.played || a.venue.localeCompare(b.venue),
  )
}
