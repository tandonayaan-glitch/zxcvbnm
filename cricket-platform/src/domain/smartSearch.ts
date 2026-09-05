/* ==================================================================
 * Smart Search — deterministic query architecture for cricket-statistical
 * questions ("most runs", "best strike rate", "best death-over bowlers").
 * Pure, no I/O, and no AI: each "intent" below is matched by plain keyword
 * rules against the query text, then answered from data this platform
 * already aggregates cheaply (buildLeaderboards/aggregateTeamStats/
 * tossInsights) — nothing here reads every match's ball-by-ball log.
 *
 * This is deliberately kept separate from any future natural-language/AI
 * layer (see PHASE 18 / domain/ai.ts): an AI layer, if one is ever wired
 * up, would translate free text into one of these same intent keys and
 * call the same `run()` function — it would never invent the underlying
 * numbers itself. Today, with no AI provider configured, keyword matching
 * is the whole "natural language" story, and it's honestly limited to
 * that — a genuinely unrecognised query returns no result rather than a
 * fabricated guess.
 * ================================================================== */
import { buildLeaderboards, type Leaderboard } from './stats'
import { aggregateTeamStats } from './stats'
import { teamOpponentRecords } from './teamOpponents'
import type { Match, Player, PlayerStats, Team } from '@/types'

export interface SmartSearchContext {
  playerStats: Map<string, PlayerStats>
  players: Player[]
  teams: Team[]
  matches: Match[]
}

export interface SmartSearchRow {
  label: string
  value: string
  playerId?: string
  teamId?: string
}

export interface SmartSearchResult {
  intentKey: string
  title: string
  rows: SmartSearchRow[]
}

interface QueryIntent {
  key: string
  title: string
  example: string
  matches: (q: string) => boolean
  run: (ctx: SmartSearchContext) => SmartSearchResult
}

const norm = (s: string) => s.toLowerCase()

function leaderboardRows(board: Leaderboard | undefined, limit = 10): SmartSearchRow[] {
  if (!board) return []
  return board.rows.slice(0, limit).map((r) => ({ label: r.display, value: r.sub ?? '', playerId: r.playerId }))
}

function findBoard(boards: Leaderboard[], key: string): Leaderboard | undefined {
  return boards.find((b) => b.key === key)
}

const INTENTS: QueryIntent[] = [
  {
    key: 'most_runs',
    title: 'Most runs',
    example: 'most runs',
    matches: (q) => /most runs|highest run.?scorer|top scorer/.test(q),
    run: (ctx) => ({ intentKey: 'most_runs', title: 'Most runs', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'runs')) }),
  },
  {
    key: 'most_wickets',
    title: 'Most wickets',
    example: 'most wickets',
    matches: (q) => /most wickets|top wicket.?taker/.test(q),
    run: (ctx) => ({ intentKey: 'most_wickets', title: 'Most wickets', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'wickets')) }),
  },
  {
    key: 'best_strike_rate',
    title: 'Best strike rate',
    example: 'best strike rate',
    matches: (q) => /strike rate/.test(q) && !/bowl/.test(q),
    run: (ctx) => ({ intentKey: 'best_strike_rate', title: 'Best strike rate', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'sr')) }),
  },
  {
    key: 'best_economy',
    title: 'Best economy',
    example: 'best economy',
    matches: (q) => /best economy|lowest economy|economical bowler/.test(q),
    run: (ctx) => ({ intentKey: 'best_economy', title: 'Best economy', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'economy')) }),
  },
  {
    key: 'most_sixes',
    title: 'Most sixes',
    example: 'most sixes',
    matches: (q) => /most sixes/.test(q),
    run: (ctx) => ({ intentKey: 'most_sixes', title: 'Most sixes', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'sixes')) }),
  },
  {
    key: 'most_fours',
    title: 'Most fours',
    example: 'most fours',
    matches: (q) => /most fours/.test(q),
    run: (ctx) => ({ intentKey: 'most_fours', title: 'Most fours', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'fours')) }),
  },
  {
    key: 'best_bowling',
    title: 'Best bowling figures',
    example: 'best bowling figures',
    matches: (q) => /best bowling/.test(q),
    run: (ctx) => ({ intentKey: 'best_bowling', title: 'Best bowling figures', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'bestBowling')) }),
  },
  {
    key: 'best_average',
    title: 'Best batting average',
    example: 'best batting average',
    matches: (q) => /batting average|best average/.test(q),
    run: (ctx) => ({ intentKey: 'best_average', title: 'Best batting average', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'average')) }),
  },
  {
    key: 'most_dismissals',
    title: 'Most fielding dismissals',
    example: 'most catches',
    matches: (q) => /most catches|most dismissals|best fielder/.test(q),
    run: (ctx) => ({ intentKey: 'most_dismissals', title: 'Most fielding dismissals', rows: leaderboardRows(findBoard(buildLeaderboards(ctx.playerStats), 'fielding')) }),
  },
  {
    key: 'best_team_record',
    title: 'Best team win record',
    example: 'best team record',
    matches: (q) => /best team|team.*record|most wins/.test(q),
    run: (ctx) => {
      const teamStats = [...aggregateTeamStats(ctx.matches).values()].filter((s) => s.matches > 0)
      const teamNameById = new Map(ctx.teams.map((t) => [t.id, t.name]))
      const rows = teamStats
        .sort((a, b) => b.won / Math.max(1, b.matches) - a.won / Math.max(1, a.matches))
        .slice(0, 10)
        .map((s) => ({
          label: teamNameById.get(s.teamId) ?? 'Team',
          value: `${s.won}W ${s.lost}L (${s.matches} played)`,
          teamId: s.teamId,
        }))
      return { intentKey: 'best_team_record', title: 'Best team win record', rows }
    },
  },
]

/** Team-vs-team record — a special-cased intent since it needs two team names resolved from the
 *  query text itself rather than a fixed keyword match, so it's kept separate from the static
 *  `INTENTS` table above. */
export function teamVsTeamQuery(query: string, ctx: SmartSearchContext): SmartSearchResult | null {
  const q = norm(query)
  if (!/\bvs\b|\bversus\b/.test(q)) return null
  const [aPart, bPart] = q.split(/\bvs\b|\bversus\b/).map((s) => s.trim())
  if (!aPart || !bPart) return null
  const findTeam = (part: string) =>
    ctx.teams.find((t) => norm(t.name).includes(part) || norm(t.shortName).includes(part))
  const teamA = findTeam(aPart)
  const teamB = findTeam(bPart)
  if (!teamA || !teamB) return null

  const records = teamOpponentRecords(teamA.id, ctx.matches)
  const vsRecord = records.find((r) => r.opponentId === teamB.id)
  if (!vsRecord) {
    return {
      intentKey: 'team_vs_team',
      title: `${teamA.name} vs ${teamB.name}`,
      rows: [{ label: 'No completed matches yet', value: '' }],
    }
  }
  return {
    intentKey: 'team_vs_team',
    title: `${teamA.name} vs ${teamB.name}`,
    rows: [
      {
        label: `${vsRecord.played} played`,
        value: `${teamA.name} ${vsRecord.won}W · ${vsRecord.lost}L${vsRecord.tied ? ` · ${vsRecord.tied}T` : ''}`,
      },
    ],
  }
}

/** Runs the query against every registered intent (plus the special-cased team-vs-team one) and
 *  returns the first match — deterministic, order-stable (declaration order in `INTENTS`). */
export function runSmartSearch(query: string, ctx: SmartSearchContext): SmartSearchResult | null {
  const q = norm(query.trim())
  if (!q) return null
  const teamVs = teamVsTeamQuery(q, ctx)
  if (teamVs) return teamVs
  const intent = INTENTS.find((i) => i.matches(q))
  return intent ? intent.run(ctx) : null
}

export function smartSearchExamples(): string[] {
  return [...INTENTS.map((i) => i.example), 'Team A vs Team B']
}
