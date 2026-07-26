/* ==================================================================
 * Stats engine — pure aggregation from completed matches.
 * Derives player / team statistics and tournament standings from the
 * denormalised innings cards stored on each match document.
 * ================================================================== */
import type {
  Match,
  PlayerStats,
  PlayerMatchPerformance,
  StandingsRow,
  Team,
  TeamStats,
} from '@/types'
import { ballsToOvers, ballsToDecimalOvers } from '@/lib/format'

function emptyPlayerStats(playerId: string): PlayerStats {
  return {
    playerId,
    matches: 0,
    inningsBatted: 0,
    notOuts: 0,
    runs: 0,
    ballsFaced: 0,
    highScore: 0,
    highScoreNotOut: false,
    fours: 0,
    sixes: 0,
    thirties: 0,
    fifties: 0,
    hundreds: 0,
    inningsBowled: 0,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    bestBowlingWkts: -1,
    bestBowlingRuns: 0,
    fiveWktHauls: 0,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    updatedAt: Date.now(),
  }
}

function isFinished(m: Match): boolean {
  return m.status === 'completed'
}

function squadIds(m: Match): string[] {
  return [...m.squadA, ...m.squadB]
}

/** Aggregate stats for every player that appears across completed matches. */
export function aggregatePlayerStats(
  matches: Match[],
): Map<string, PlayerStats> {
  const map = new Map<string, PlayerStats>()
  const get = (id: string) => {
    let s = map.get(id)
    if (!s) {
      s = emptyPlayerStats(id)
      map.set(id, s)
    }
    return s
  }

  for (const m of matches) {
    if (!isFinished(m)) continue
    // matches played = appears in a squad
    for (const pid of new Set(squadIds(m))) get(pid).matches += 1

    for (const inn of m.innings) {
      // batting
      for (const b of inn.battingCard) {
        const battedFlag = b.balls > 0 || b.out || b.runs > 0
        if (!battedFlag) continue
        const s = get(b.playerId)
        s.inningsBatted += 1
        if (!b.out) s.notOuts += 1
        s.runs += b.runs
        s.ballsFaced += b.balls
        s.fours += b.fours
        s.sixes += b.sixes
        if (b.runs > s.highScore) {
          s.highScore = b.runs
          s.highScoreNotOut = !b.out
        }
        if (b.runs >= 100) s.hundreds += 1
        else if (b.runs >= 50) s.fifties += 1
        else if (b.runs >= 30) s.thirties += 1

        // fielding credited from dismissals
        if (b.out && b.fielderId && b.dismissalType) {
          const f = get(b.fielderId)
          if (b.dismissalType === 'caught') f.catches += 1
          else if (b.dismissalType === 'stumped') f.stumpings += 1
          else if (b.dismissalType === 'run_out') f.runOuts += 1
        }
      }
      // bowling
      for (const w of inn.bowlingCard) {
        if (w.legalBalls === 0 && w.wides === 0 && w.noBalls === 0) continue
        const s = get(w.playerId)
        s.inningsBowled += 1
        s.ballsBowled += w.legalBalls
        s.runsConceded += w.runsConceded
        s.wickets += w.wickets
        s.maidens += w.maidens
        if (w.wickets >= 5) s.fiveWktHauls += 1
        const better =
          w.wickets > s.bestBowlingWkts ||
          (w.wickets === s.bestBowlingWkts && w.runsConceded < s.bestBowlingRuns)
        if (s.bestBowlingWkts < 0 || better) {
          s.bestBowlingWkts = w.wickets
          s.bestBowlingRuns = w.runsConceded
        }
      }
    }
  }
  // normalise best bowling sentinel
  for (const s of map.values()) {
    if (s.bestBowlingWkts < 0) s.bestBowlingWkts = 0
    s.updatedAt = Date.now()
  }
  return map
}

/** Match-by-match performance log for a single player. */
export function playerPerformances(
  playerId: string,
  matches: Match[],
): PlayerMatchPerformance[] {
  const out: PlayerMatchPerformance[] = []
  for (const m of matches) {
    if (!isFinished(m)) continue
    if (!squadIds(m).includes(playerId)) continue

    let batting: PlayerMatchPerformance['batting']
    let bowling: PlayerMatchPerformance['bowling']
    for (const inn of m.innings) {
      const b = inn.battingCard.find((x) => x.playerId === playerId)
      if (b && (b.balls > 0 || b.out || b.runs > 0)) {
        batting = {
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          out: b.out,
          dismissalText: b.dismissalText,
        }
      }
      const w = inn.bowlingCard.find((x) => x.playerId === playerId)
      if (w && (w.legalBalls > 0 || w.wides > 0 || w.noBalls > 0)) {
        bowling = {
          overs: ballsToOvers(w.legalBalls, m.ballsPerOver),
          maidens: w.maidens,
          runs: w.runsConceded,
          wickets: w.wickets,
        }
      }
    }
    if (!batting && !bowling) continue
    const inSquadA = m.squadA.includes(playerId)
    out.push({
      matchId: m.id,
      matchTitle: m.title,
      date: m.completedAt ?? m.createdAt,
      opponent: inSquadA ? m.teamB.name : m.teamA.name,
      batting,
      bowling,
    })
  }
  return out.sort((a, b) => b.date - a.date)
}

/* ----------------------------- Teams ----------------------------- */

function emptyTeamStats(teamId: string): TeamStats {
  return {
    teamId,
    matches: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    runsScored: 0,
    wicketsTaken: 0,
    recentForm: [],
    updatedAt: Date.now(),
  }
}

export function aggregateTeamStats(matches: Match[]): Map<string, TeamStats> {
  const map = new Map<string, TeamStats>()
  const get = (id: string) => {
    let s = map.get(id)
    if (!s) {
      s = emptyTeamStats(id)
      map.set(id, s)
    }
    return s
  }

  const ordered = [...matches]
    .filter(isFinished)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))

  for (const m of ordered) {
    const a = get(m.teamA.id)
    const b = get(m.teamB.id)
    a.matches += 1
    b.matches += 1

    for (const inn of m.innings) {
      get(inn.battingTeamId).runsScored += inn.totalRuns
      get(inn.bowlingTeamId).wicketsTaken += inn.wickets
    }

    const r = m.result
    if (!r || r.outcome === 'no_result' || r.outcome === 'abandoned') {
      a.noResult += 1
      b.noResult += 1
      a.recentForm.push('N')
      b.recentForm.push('N')
    } else if (r.outcome === 'tie') {
      a.tied += 1
      b.tied += 1
      a.recentForm.push('T')
      b.recentForm.push('T')
    } else if (r.winnerTeamId) {
      const winner = get(r.winnerTeamId)
      const loserId = r.winnerTeamId === m.teamA.id ? m.teamB.id : m.teamA.id
      const loser = get(loserId)
      winner.won += 1
      loser.lost += 1
      winner.recentForm.push('W')
      loser.recentForm.push('L')
    }
  }
  for (const s of map.values()) {
    s.recentForm = s.recentForm.slice(-5)
    s.updatedAt = Date.now()
  }
  return map
}

/* -------------------------- Standings -------------------------- */

const POINTS_WIN = 2
const POINTS_TIE = 1

export function computeStandings(
  teamIds: string[],
  teams: Team[],
  matches: Match[],
): StandingsRow[] {
  const byId = new Map(teams.map((t) => [t.id, t]))
  // Fall back to the name/shortName snapshot denormalised onto each match for
  // teams whose Team doc has since been deleted (matches Records tab, which
  // reads the same snapshot instead of the live Teams collection).
  const snapshotById = new Map<string, { name: string; shortName: string }>()
  for (const m of matches) {
    snapshotById.set(m.teamA.id, { name: m.teamA.name, shortName: m.teamA.shortName })
    snapshotById.set(m.teamB.id, { name: m.teamB.name, shortName: m.teamB.shortName })
  }
  const rows = new Map<string, StandingsRow>()
  for (const id of teamIds ?? []) {
    const t = byId.get(id)
    const snap = snapshotById.get(id)
    rows.set(id, {
      teamId: id,
      teamName: t?.name ?? snap?.name ?? 'Team',
      teamShort: t?.shortName ?? snap?.shortName ?? '—',
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      runsFor: 0,
      ballsFor: 0,
      runsAgainst: 0,
      ballsAgainst: 0,
      nrr: 0,
    })
  }

  const inThisTournament = (m: Match) =>
    isFinished(m) && rows.has(m.teamA.id) && rows.has(m.teamB.id)

  for (const m of matches) {
    if (!inThisTournament(m)) continue
    const a = rows.get(m.teamA.id)!
    const b = rows.get(m.teamB.id)!
    a.played += 1
    b.played += 1

    for (const inn of m.innings) {
      const bat = rows.get(inn.battingTeamId)
      const bowl = rows.get(inn.bowlingTeamId)
      if (bat) {
        bat.runsFor += inn.totalRuns
        bat.ballsFor += inn.legalBalls
      }
      if (bowl) {
        bowl.runsAgainst += inn.totalRuns
        bowl.ballsAgainst += inn.legalBalls
      }
    }

    const r = m.result
    if (!r || r.outcome === 'no_result' || r.outcome === 'abandoned') {
      a.noResult += 1
      b.noResult += 1
      a.points += POINTS_TIE
      b.points += POINTS_TIE
    } else if (r.outcome === 'tie') {
      a.tied += 1
      b.tied += 1
      a.points += POINTS_TIE
      b.points += POINTS_TIE
    } else if (r.winnerTeamId) {
      const w = rows.get(r.winnerTeamId)!
      const loserId = r.winnerTeamId === m.teamA.id ? m.teamB.id : m.teamA.id
      const l = rows.get(loserId)!
      w.won += 1
      l.lost += 1
      w.points += POINTS_WIN
    }
  }

  for (const row of rows.values()) {
    const rrFor = row.ballsFor
      ? row.runsFor / ballsToDecimalOvers(row.ballsFor)
      : 0
    const rrAgainst = row.ballsAgainst
      ? row.runsAgainst / ballsToDecimalOvers(row.ballsAgainst)
      : 0
    row.nrr = Number((rrFor - rrAgainst).toFixed(3))
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won,
  )
}

/* ----------------------- Leaderboards ----------------------- */

export interface LeaderRow {
  playerId: string
  value: number
  secondary?: number
}

export function topRunScorers(
  stats: Map<string, PlayerStats>,
  n = 5,
): LeaderRow[] {
  return [...stats.values()]
    .filter((s) => s.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, n)
    .map((s) => ({ playerId: s.playerId, value: s.runs, secondary: s.matches }))
}

export function topWicketTakers(
  stats: Map<string, PlayerStats>,
  n = 5,
): LeaderRow[] {
  return [...stats.values()]
    .filter((s) => s.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, n)
    .map((s) => ({
      playerId: s.playerId,
      value: s.wickets,
      secondary: s.runsConceded,
    }))
}

/* ============================ Leaderboards ============================ */

export interface LeaderboardRow {
  playerId: string
  /** Numeric value used for sorting/bar widths. */
  value: number
  /** Pretty value shown to the user (e.g. "45.50", "3/12"). */
  display: string
  /** Secondary context line (e.g. "12 inns · 320 runs"). */
  sub?: string
}

export interface Leaderboard {
  key: string
  title: string
  icon: string // lucide name hint, used by the UI
  rows: LeaderboardRow[]
}

const MIN_BALLS_RATE = 30 // qualification for SR / economy boards

function arr(stats: Map<string, PlayerStats>): PlayerStats[] {
  return [...stats.values()]
}

/**
 * Build the full set of platform leaderboards from aggregated player stats.
 * Pure — the UI maps playerId -> name/photo.
 */
export function buildLeaderboards(
  stats: Map<string, PlayerStats>,
  limit = 10,
): Leaderboard[] {
  const list = arr(stats)
  const take = <T>(a: T[]) => a.slice(0, limit)

  const mostRuns: Leaderboard = {
    key: 'runs',
    title: 'Most runs',
    icon: 'trending-up',
    rows: take(
      list
        .filter((s) => s.runs > 0)
        .sort((a, b) => b.runs - a.runs)
        .map((s) => ({
          playerId: s.playerId,
          value: s.runs,
          display: String(s.runs),
          sub: `${s.inningsBatted} inn · HS ${s.highScore}${
            s.highScoreNotOut ? '*' : ''
          }`,
        })),
    ),
  }

  const mostWickets: Leaderboard = {
    key: 'wickets',
    title: 'Most wickets',
    icon: 'target',
    rows: take(
      list
        .filter((s) => s.wickets > 0)
        .sort((a, b) => b.wickets - a.wickets)
        .map((s) => ({
          playerId: s.playerId,
          value: s.wickets,
          display: String(s.wickets),
          sub: `${ballsToOvers(s.ballsBowled)} ov · ${s.runsConceded} runs`,
        })),
    ),
  }

  const battingAvg: Leaderboard = {
    key: 'average',
    title: 'Best batting average',
    icon: 'bar-chart-3',
    rows: take(
      list
        .filter((s) => s.inningsBatted >= 3)
        .map((s) => {
          const dismissals = s.inningsBatted - s.notOuts
          const avg = dismissals > 0 ? s.runs / dismissals : s.runs
          return {
            playerId: s.playerId,
            value: avg,
            display: avg.toFixed(2),
            sub: `${s.runs} runs · ${s.inningsBatted} inn`,
          }
        })
        .sort((a, b) => b.value - a.value),
    ),
  }

  const strikeRate: Leaderboard = {
    key: 'sr',
    title: 'Best strike rate',
    icon: 'zap',
    rows: take(
      list
        .filter((s) => s.ballsFaced >= MIN_BALLS_RATE)
        .map((s) => {
          const sr = (s.runs / s.ballsFaced) * 100
          return {
            playerId: s.playerId,
            value: sr,
            display: sr.toFixed(1),
            sub: `${s.runs} off ${s.ballsFaced}`,
          }
        })
        .sort((a, b) => b.value - a.value),
    ),
  }

  const economy: Leaderboard = {
    key: 'economy',
    title: 'Best economy',
    icon: 'gauge',
    rows: take(
      list
        .filter((s) => s.ballsBowled >= MIN_BALLS_RATE)
        .map((s) => {
          const eco = (s.runsConceded / s.ballsBowled) * 6
          return {
            playerId: s.playerId,
            value: -eco, // lower is better → negate for sort
            display: eco.toFixed(2),
            sub: `${s.wickets} wkts · ${ballsToOvers(s.ballsBowled)} ov`,
          }
        })
        .sort((a, b) => b.value - a.value),
    ),
  }

  const sixes: Leaderboard = {
    key: 'sixes',
    title: 'Most sixes',
    icon: 'flame',
    rows: take(
      list
        .filter((s) => s.sixes > 0)
        .sort((a, b) => b.sixes - a.sixes)
        .map((s) => ({
          playerId: s.playerId,
          value: s.sixes,
          display: String(s.sixes),
          sub: `${s.fours} fours`,
        })),
    ),
  }

  const fours: Leaderboard = {
    key: 'fours',
    title: 'Most fours',
    icon: 'square',
    rows: take(
      list
        .filter((s) => s.fours > 0)
        .sort((a, b) => b.fours - a.fours)
        .map((s) => ({
          playerId: s.playerId,
          value: s.fours,
          display: String(s.fours),
          sub: `${s.sixes} sixes`,
        })),
    ),
  }

  const bestBowling: Leaderboard = {
    key: 'bestBowling',
    title: 'Best bowling figures',
    icon: 'award',
    rows: take(
      list
        .filter((s) => s.bestBowlingWkts > 0)
        .sort(
          (a, b) =>
            b.bestBowlingWkts - a.bestBowlingWkts ||
            a.bestBowlingRuns - b.bestBowlingRuns,
        )
        .map((s) => ({
          playerId: s.playerId,
          value: s.bestBowlingWkts * 1000 - s.bestBowlingRuns,
          display: `${s.bestBowlingWkts}/${s.bestBowlingRuns}`,
          sub: `${s.wickets} career wkts`,
        })),
    ),
  }

  const fielding: Leaderboard = {
    key: 'fielding',
    title: 'Most dismissals (fielding)',
    icon: 'hand',
    rows: take(
      list
        .map((s) => ({
          s,
          total: s.catches + s.runOuts + s.stumpings,
        }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total)
        .map(({ s, total }) => ({
          playerId: s.playerId,
          value: total,
          display: String(total),
          sub: `${s.catches}c ${s.runOuts}ro ${s.stumpings}st`,
        })),
    ),
  }

  return [
    mostRuns,
    mostWickets,
    sixes,
    fours,
    battingAvg,
    strikeRate,
    economy,
    bestBowling,
    fielding,
  ].filter((lb) => lb.rows.length > 0)
}

/* ---------------------------- MVP / Impact ---------------------------- */

export interface ImpactBreakdown {
  total: number
  batting: number
  bowling: number
  fielding: number
}

/**
 * A transparent all-round impact score: batting (runs + boundary & milestone
 * bonuses), bowling (wickets, maidens, hauls) and fielding (dismissals).
 * Deliberately simple and explainable rather than a tuned model.
 */
export function impactRating(s: PlayerStats): ImpactBreakdown {
  const batting =
    s.runs + s.fours + s.sixes * 2 + s.thirties * 4 + s.fifties * 8 + s.hundreds * 16
  const bowling = s.wickets * 20 + s.maidens * 4 + s.fiveWktHauls * 25
  const fielding = s.catches * 8 + s.stumpings * 12 + s.runOuts * 8
  return { total: batting + bowling + fielding, batting, bowling, fielding }
}

/** Leaderboard of overall impact — the platform's "most valuable players". */
export function buildImpactBoard(
  stats: Map<string, PlayerStats>,
  limit = 10,
): Leaderboard {
  const rows = [...stats.values()]
    .map((s) => ({ s, r: impactRating(s) }))
    .filter((x) => x.r.total > 0)
    .sort((a, b) => b.r.total - a.r.total)
    .slice(0, limit)
    .map(({ s, r }) => ({
      playerId: s.playerId,
      value: r.total,
      display: String(r.total),
      sub: `${s.runs} runs · ${s.wickets} wkts · ${
        s.catches + s.runOuts + s.stumpings
      } dis`,
    }))
  return {
    key: 'mvp',
    title: 'Most valuable players (impact)',
    icon: 'award',
    rows,
  }
}
