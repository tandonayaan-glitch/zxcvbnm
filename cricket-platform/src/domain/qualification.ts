/* ==================================================================
 * Group-stage qualification tracker — pure, and deliberately
 * conservative: a team is only ever called "qualified" or
 * "eliminated" when that call is mathematically guaranteed regardless
 * of how every remaining group match plays out. Anything not yet
 * certain is "contention", including ties at the cutoff that would
 * really be resolved by NRR — this tracker doesn't simulate NRR
 * outcomes, so it leaves those as contention rather than guessing.
 * ================================================================== */
import type { Match, StandingsRow } from '@/types'

export type QualificationStatus = 'qualified' | 'contention' | 'eliminated'

export interface QualificationRow {
  teamId: string
  status: QualificationStatus
  points: number
  remainingGames: number
  /** Points if this team wins every remaining group game (2 pts/win). */
  maxPossiblePoints: number
}

const POINTS_WIN = 2

/**
 * Qualification status for each team in one group.
 * `rows` should be that group's standings (already computed);
 * `matches` can be the whole tournament's matches — only non-completed
 * games between two teams that are both in `rows` count as "remaining".
 */
export function groupQualification(
  rows: StandingsRow[],
  matches: Match[],
  qualifiersPerGroup: number,
): QualificationRow[] {
  const groupIds = new Set(rows.map((r) => r.teamId))

  const remaining = new Map<string, number>()
  for (const id of groupIds) remaining.set(id, 0)
  for (const m of matches) {
    if (m.status === 'completed' || m.status === 'abandoned') continue
    if (!groupIds.has(m.teamA.id) || !groupIds.has(m.teamB.id)) continue
    remaining.set(m.teamA.id, (remaining.get(m.teamA.id) ?? 0) + 1)
    remaining.set(m.teamB.id, (remaining.get(m.teamB.id) ?? 0) + 1)
  }

  const ceiling = new Map<string, number>()
  for (const r of rows) {
    ceiling.set(r.teamId, r.points + (remaining.get(r.teamId) ?? 0) * POINTS_WIN)
  }

  return rows.map((r) => {
    const others = rows.filter((x) => x.teamId !== r.teamId)
    const myCeiling = ceiling.get(r.teamId) ?? r.points

    // Sound in one direction: other teams' current points only ever go up,
    // so if N of them already exceed my ceiling, I can never break into the
    // top N regardless of what happens in any other match.
    const alreadyBeatenBy = others.filter((x) => x.points > myCeiling).length
    const eliminated = alreadyBeatenBy >= qualifiersPerGroup

    // Sound in the other direction: if fewer than N other teams could ever
    // reach-or-tie my current points, nobody outside the top N can catch me.
    const canStillCatchMe = others.filter(
      (x) => (ceiling.get(x.teamId) ?? x.points) >= r.points,
    ).length
    const qualified = !eliminated && canStillCatchMe < qualifiersPerGroup

    return {
      teamId: r.teamId,
      status: eliminated ? 'eliminated' : qualified ? 'qualified' : 'contention',
      points: r.points,
      remainingGames: remaining.get(r.teamId) ?? 0,
      maxPossiblePoints: myCeiling,
    }
  })
}
