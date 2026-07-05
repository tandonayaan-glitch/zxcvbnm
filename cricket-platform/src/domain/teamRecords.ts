/* ==================================================================
 * Team honours & records — pure aggregation over a team's completed
 * matches, read from the denormalised innings cards on each match doc
 * (no delivery reads). "Honours" are knockout finals won; "records" are
 * the team's own bests (total, chase, winning margins, individual feats).
 * ================================================================== */
import type { Match } from '@/types'

export interface TeamTitle {
  tournamentId: string | null
  tournamentName: string
  matchId: string
  opponentShort: string
  date: number
}

export interface TeamTotalRecord {
  runs: number
  wickets: number
  legalBalls: number
  matchId: string
  opponentShort: string
}

export interface TeamBattingRecord {
  playerId: string
  runs: number
  balls: number
  out: boolean
  matchId: string
}

export interface TeamBowlingRecord {
  playerId: string
  wickets: number
  runs: number
  matchId: string
}

export interface TeamWinMarginRecord {
  margin: number
  matchId: string
  opponentShort: string
}

export interface TeamHonours {
  titles: TeamTitle[]
  finalsLost: number
  highestTotal?: TeamTotalRecord
  highestChase?: TeamTotalRecord
  biggestWinByRuns?: TeamWinMarginRecord
  biggestWinByWickets?: TeamWinMarginRecord
  highestIndividualScore?: TeamBattingRecord
  bestBowling?: TeamBowlingRecord
}

/** True once the honours object carries at least one record worth showing. */
export function hasTeamRecords(h: TeamHonours): boolean {
  return Boolean(
    h.highestTotal ||
      h.highestChase ||
      h.biggestWinByRuns ||
      h.biggestWinByWickets ||
      h.highestIndividualScore ||
      h.bestBowling,
  )
}

export function computeTeamHonours(teamId: string, matches: Match[]): TeamHonours {
  const h: TeamHonours = { titles: [], finalsLost: 0 }

  for (const m of matches) {
    if (m.status !== 'completed') continue
    if (m.teamA.id !== teamId && m.teamB.id !== teamId) continue

    const opponent = m.teamA.id === teamId ? m.teamB : m.teamA
    const opponentShort = opponent.shortName
    const r = m.result
    const won = r?.outcome === 'win' && r.winnerTeamId === teamId

    // Honours: knockout finals.
    if (m.stage === 'final' && r?.outcome === 'win' && r.winnerTeamId) {
      if (won) {
        h.titles.push({
          tournamentId: m.tournamentId ?? null,
          tournamentName: m.tournamentName ?? 'Tournament',
          matchId: m.id,
          opponentShort,
          date: m.completedAt ?? m.createdAt,
        })
      } else {
        h.finalsLost += 1
      }
    }

    for (const inn of m.innings) {
      // Team batting innings — totals and individual scores.
      if (inn.battingTeamId === teamId) {
        const total: TeamTotalRecord = {
          runs: inn.totalRuns,
          wickets: inn.wickets,
          legalBalls: inn.legalBalls,
          matchId: m.id,
          opponentShort,
        }
        const played = inn.legalBalls > 0 || inn.totalRuns > 0
        if (played && (!h.highestTotal || total.runs > h.highestTotal.runs)) {
          h.highestTotal = total
        }
        // A successful chase: batting second in a win.
        if (won && inn.index === 1 && (!h.highestChase || total.runs > h.highestChase.runs)) {
          h.highestChase = total
        }
        for (const b of inn.battingCard) {
          if (b.balls === 0 && !b.out && b.runs === 0) continue
          if (!h.highestIndividualScore || b.runs > h.highestIndividualScore.runs) {
            h.highestIndividualScore = {
              playerId: b.playerId,
              runs: b.runs,
              balls: b.balls,
              out: b.out,
              matchId: m.id,
            }
          }
        }
      }

      // Team bowling innings — best figures.
      if (inn.bowlingTeamId === teamId) {
        for (const w of inn.bowlingCard) {
          if (w.legalBalls === 0 && w.wides === 0 && w.noBalls === 0) continue
          const better =
            !h.bestBowling ||
            w.wickets > h.bestBowling.wickets ||
            (w.wickets === h.bestBowling.wickets && w.runsConceded < h.bestBowling.runs)
          if (better) {
            h.bestBowling = {
              playerId: w.playerId,
              wickets: w.wickets,
              runs: w.runsConceded,
              matchId: m.id,
            }
          }
        }
      }
    }

    // Winning margins.
    if (won && r?.margin) {
      const margin = parseInt(r.margin, 10)
      if (!Number.isNaN(margin)) {
        const entry: TeamWinMarginRecord = { margin, matchId: m.id, opponentShort }
        if (r.margin.includes('run')) {
          if (!h.biggestWinByRuns || margin > h.biggestWinByRuns.margin) {
            h.biggestWinByRuns = entry
          }
        } else if (r.margin.includes('wicket')) {
          if (!h.biggestWinByWickets || margin > h.biggestWinByWickets.margin) {
            h.biggestWinByWickets = entry
          }
        }
      }
    }
  }

  h.titles.sort((a, b) => b.date - a.date)
  return h
}
