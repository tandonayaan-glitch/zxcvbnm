/* ==================================================================
 * Tournament records — pure aggregation over completed matches.
 * Reads the same cached innings cards used by the stats engine; no
 * delivery-level data required, so it stays cheap for a tournament page.
 * ================================================================== */
import type { Match } from '@/types'

export interface TeamTotalRecord {
  teamId: string
  teamShort: string
  runs: number
  wickets: number
  legalBalls: number
  matchId: string
}

export interface IndividualScoreRecord {
  playerId: string
  runs: number
  balls: number
  out: boolean
  matchId: string
}

export interface BowlingFiguresRecord {
  playerId: string
  wickets: number
  runs: number
  matchId: string
}

export interface BoundaryTallyRecord {
  playerId: string
  count: number
  matchId: string
}

export interface WinMarginRecord {
  winnerTeamId: string
  winnerName: string
  margin: number
  matchId: string
}

export interface TournamentRecords {
  highestTeamTotal?: TeamTotalRecord
  lowestTeamTotal?: TeamTotalRecord
  highestIndividualScore?: IndividualScoreRecord
  bestBowlingFigures?: BowlingFiguresRecord
  mostSixesInnings?: BoundaryTallyRecord
  mostFoursInnings?: BoundaryTallyRecord
  biggestWinByRuns?: WinMarginRecord
  biggestWinByWickets?: WinMarginRecord
}

export function computeTournamentRecords(matches: Match[]): TournamentRecords {
  const rec: TournamentRecords = {}

  for (const m of matches) {
    if (m.status !== 'completed') continue

    for (const inn of m.innings) {
      const played = inn.legalBalls > 0 || inn.totalRuns > 0
      if (!played) continue
      const teamShort =
        inn.battingTeamId === m.teamA.id ? m.teamA.shortName : m.teamB.shortName
      const total: TeamTotalRecord = {
        teamId: inn.battingTeamId,
        teamShort,
        runs: inn.totalRuns,
        wickets: inn.wickets,
        legalBalls: inn.legalBalls,
        matchId: m.id,
      }
      if (!rec.highestTeamTotal || total.runs > rec.highestTeamTotal.runs) {
        rec.highestTeamTotal = total
      }
      if (
        inn.closeReason === 'all_out' &&
        (!rec.lowestTeamTotal || total.runs < rec.lowestTeamTotal.runs)
      ) {
        rec.lowestTeamTotal = total
      }

      for (const b of inn.battingCard) {
        if (b.balls === 0 && !b.out && b.runs === 0) continue
        if (!rec.highestIndividualScore || b.runs > rec.highestIndividualScore.runs) {
          rec.highestIndividualScore = {
            playerId: b.playerId,
            runs: b.runs,
            balls: b.balls,
            out: b.out,
            matchId: m.id,
          }
        }
        if (b.sixes > 0 && (!rec.mostSixesInnings || b.sixes > rec.mostSixesInnings.count)) {
          rec.mostSixesInnings = { playerId: b.playerId, count: b.sixes, matchId: m.id }
        }
        if (b.fours > 0 && (!rec.mostFoursInnings || b.fours > rec.mostFoursInnings.count)) {
          rec.mostFoursInnings = { playerId: b.playerId, count: b.fours, matchId: m.id }
        }
      }

      for (const w of inn.bowlingCard) {
        if (w.legalBalls === 0 && w.wides === 0 && w.noBalls === 0) continue
        const better =
          !rec.bestBowlingFigures ||
          w.wickets > rec.bestBowlingFigures.wickets ||
          (w.wickets === rec.bestBowlingFigures.wickets &&
            w.runsConceded < rec.bestBowlingFigures.runs)
        if (better) {
          rec.bestBowlingFigures = {
            playerId: w.playerId,
            wickets: w.wickets,
            runs: w.runsConceded,
            matchId: m.id,
          }
        }
      }
    }

    const r = m.result
    if (r?.outcome === 'win' && r.winnerTeamId && r.margin) {
      const margin = parseInt(r.margin, 10)
      if (!Number.isNaN(margin)) {
        const entry: WinMarginRecord = {
          winnerTeamId: r.winnerTeamId,
          winnerName: r.winnerName ?? '',
          margin,
          matchId: m.id,
        }
        if (r.margin.includes('run')) {
          if (!rec.biggestWinByRuns || margin > rec.biggestWinByRuns.margin) {
            rec.biggestWinByRuns = entry
          }
        } else if (r.margin.includes('wicket')) {
          if (!rec.biggestWinByWickets || margin > rec.biggestWinByWickets.margin) {
            rec.biggestWinByWickets = entry
          }
        }
      }
    }
  }

  return rec
}
