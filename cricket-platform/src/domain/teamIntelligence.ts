/* ==================================================================
 * Team Intelligence — batting order, bowling roles, chase-vs-set record,
 * and a data-driven (never "guaranteed optimal") suggested XI. Pure, no
 * I/O; everything here is aggregated straight from this team's own
 * completed matches.
 * ================================================================== */
import { careerPerformanceScore } from './performanceScore'
import type { Match, Player, PlayerStats } from '@/types'

export interface BattingOrderLine {
  position: number
  innings: number
  runs: number
  balls: number
  average: number
  strikeRate: number
  dismissals: number
}

/** Average and strike rate at each batting-order slot this team has actually used — real
 *  positional data, not a role assumption (a team that sends its keeper at #3 shows up as #3
 *  data, not "keeper" data). */
export function battingOrderAnalysis(matches: Match[], teamId: string): BattingOrderLine[] {
  const byPos = new Map<number, { innings: number; runs: number; balls: number; dismissals: number }>()
  for (const m of matches) {
    if (m.status !== 'completed') continue
    for (const inn of m.innings) {
      if (inn.battingTeamId !== teamId) continue
      for (const b of inn.battingCard) {
        if (b.balls === 0 && !b.out && b.runs === 0) continue
        const row = byPos.get(b.battingOrder) ?? { innings: 0, runs: 0, balls: 0, dismissals: 0 }
        row.innings += 1
        row.runs += b.runs
        row.balls += b.balls
        if (b.out) row.dismissals += 1
        byPos.set(b.battingOrder, row)
      }
    }
  }
  return [...byPos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([position, r]) => ({
      position,
      innings: r.innings,
      runs: r.runs,
      balls: r.balls,
      average: r.dismissals > 0 ? Math.round((r.runs / r.dismissals) * 10) / 10 : r.runs,
      strikeRate: r.balls > 0 ? Math.round((r.runs / r.balls) * 1000) / 10 : 0,
      dismissals: r.dismissals,
    }))
}

export interface BowlerRoleLine {
  playerId: string
  matches: number
  legalBalls: number
  runsConceded: number
  wickets: number
  economy: number
}

/** Every bowler this team has used, ranked by wickets then economy — a real bowling-attack
 *  breakdown from the same bowling cards the scorecard shows. */
export function bowlingRoleAnalysis(matches: Match[], teamId: string): BowlerRoleLine[] {
  const byPlayer = new Map<string, { matches: Set<string>; legalBalls: number; runsConceded: number; wickets: number }>()
  for (const m of matches) {
    if (m.status !== 'completed') continue
    for (const inn of m.innings) {
      if (inn.bowlingTeamId !== teamId) continue
      for (const w of inn.bowlingCard) {
        if (w.legalBalls === 0 && w.wides === 0 && w.noBalls === 0) continue
        const row = byPlayer.get(w.playerId) ?? { matches: new Set<string>(), legalBalls: 0, runsConceded: 0, wickets: 0 }
        row.matches.add(m.id)
        row.legalBalls += w.legalBalls
        row.runsConceded += w.runsConceded
        row.wickets += w.wickets
        byPlayer.set(w.playerId, row)
      }
    }
  }
  return [...byPlayer.entries()]
    .map(([playerId, r]) => ({
      playerId,
      matches: r.matches.size,
      legalBalls: r.legalBalls,
      runsConceded: r.runsConceded,
      wickets: r.wickets,
      economy: r.legalBalls > 0 ? Math.round((r.runsConceded / r.legalBalls) * 6 * 100) / 100 : 0,
    }))
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
}

export interface ChaseSetRecord {
  battingFirst: { played: number; won: number }
  battingSecond: { played: number; won: number }
}

/** This team's real win rate batting first vs chasing, from completed matches with a recorded
 *  result — not a modeled preference. */
export function chasingVsSettingRecord(matches: Match[], teamId: string): ChaseSetRecord {
  const rec: ChaseSetRecord = { battingFirst: { played: 0, won: 0 }, battingSecond: { played: 0, won: 0 } }
  for (const m of matches) {
    if (m.status !== 'completed' || !m.battingFirstTeamId) continue
    if (m.teamA.id !== teamId && m.teamB.id !== teamId) continue
    const bucket = m.battingFirstTeamId === teamId ? rec.battingFirst : rec.battingSecond
    bucket.played += 1
    if (m.result?.outcome === 'win' && m.result.winnerTeamId === teamId) bucket.won += 1
  }
  return rec
}

export interface SuggestedXISlot {
  playerId: string
  reason: string
}

/**
 * A data-driven starting XI suggestion, ranked by career Performance Score with a single
 * adjustment (a wicket-keeper is force-included if the roster has one at all, since a side
 * genuinely cannot field without one). This is explicitly NOT presented as an optimal or
 * guaranteed-best XI — it's one deterministic reading of past performance, blind to current
 * fitness, form momentum beyond what the score already reflects, matchup-specific tactics, or
 * anything the scorer/captain knows that isn't in this platform's data.
 */
export function suggestXI(
  roster: Player[],
  statsById: Map<string, PlayerStats>,
  squadSize = 11,
): SuggestedXISlot[] {
  const scored = roster
    .map((p) => {
      const s = statsById.get(p.id)
      const score = s ? careerPerformanceScore(s).total : 0
      return { player: p, score }
    })
    .sort((a, b) => b.score - a.score)

  const picked = scored.slice(0, squadSize)
  const keeperInPicked = picked.some((x) => x.player.role === 'wicket_keeper')
  if (!keeperInPicked) {
    const bestKeeper = scored.find((x) => x.player.role === 'wicket_keeper')
    if (bestKeeper) {
      picked[picked.length - 1] = bestKeeper
    }
  }

  return picked
    .sort((a, b) => b.score - a.score)
    .map((x) => ({
      playerId: x.player.id,
      reason:
        x.score > 0
          ? `Performance Score ${x.score}`
          : x.player.role === 'wicket_keeper'
            ? 'Only available wicket-keeper on the roster'
            : 'No completed-match record yet',
    }))
}
