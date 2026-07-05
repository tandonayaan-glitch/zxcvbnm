/* ==================================================================
 * Match export — turn a match (and its deliveries) into portable CSV /
 * JSON. Pure string builders; the UI wraps the result in a Blob download.
 * ================================================================== */
import type { Delivery, Match, Player } from '@/types'
import { ballsToOvers } from '@/lib/format'

function nameMap(players: Player[]): Map<string, string> {
  return new Map(players.map((p) => [p.id, p.displayName]))
}

/** Full structured export — the match doc plus its ball-by-ball deliveries. */
export function matchToJSON(match: Match, deliveries: Delivery[]): string {
  return JSON.stringify({ match, deliveries }, null, 2)
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Human-readable scorecard as CSV: per-innings batting and bowling cards. */
export function matchToCSV(match: Match, players: Player[]): string {
  const name = nameMap(players)
  const rows: (string | number)[][] = []

  rows.push(['Match', match.title])
  rows.push(['Teams', `${match.teamA.name} vs ${match.teamB.name}`])
  rows.push(['Format', `${match.format} · ${match.oversPerInnings} overs`])
  if (match.result) rows.push(['Result', match.result.summary])
  rows.push([])

  match.innings.forEach((inn, i) => {
    const battingTeam =
      inn.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name
    rows.push([
      `Innings ${i + 1}`,
      battingTeam,
      `${inn.totalRuns}/${inn.wickets}`,
      `${ballsToOvers(inn.legalBalls, match.ballsPerOver)} ov`,
    ])

    rows.push(['Batter', 'R', 'B', '4s', '6s', 'SR', 'Dismissal'])
    for (const b of inn.battingCard) {
      if (b.balls === 0 && !b.out && b.runs === 0) continue
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'
      rows.push([
        name.get(b.playerId) ?? b.playerId,
        b.runs,
        b.balls,
        b.fours,
        b.sixes,
        sr,
        b.out ? (b.dismissalText ?? 'out') : 'not out',
      ])
    }

    rows.push(['Bowler', 'O', 'R', 'W', 'Econ'])
    for (const w of inn.bowlingCard) {
      if (w.legalBalls === 0 && w.wides === 0 && w.noBalls === 0) continue
      const econ =
        w.legalBalls > 0 ? ((w.runsConceded / w.legalBalls) * 6).toFixed(2) : '0.00'
      rows.push([
        name.get(w.playerId) ?? w.playerId,
        ballsToOvers(w.legalBalls, match.ballsPerOver),
        w.runsConceded,
        w.wickets,
        econ,
      ])
    }
    rows.push([])
  })

  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

/** Filesystem-safe slug for download filenames. */
export function exportSlug(match: Match): string {
  const base = `${match.teamA.shortName}-v-${match.teamB.shortName}-${match.id}`
  return base.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').toLowerCase()
}
