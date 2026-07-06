/* ==================================================================
 * Tournament export — build CSV / JSON from prepared, name-resolved rows
 * (standings + leaders). Pure string builders; the UI wires the download.
 * ================================================================== */

export interface StandingsExportRow {
  rank: number
  team: string
  played: number
  won: number
  lost: number
  tied: number
  points: number
  nrr: number
}

export interface LeaderExportRow {
  rank: number
  player: string
  value: number
}

export interface TournamentExport {
  name: string
  standings: StandingsExportRow[]
  mostRuns: LeaderExportRow[]
  mostWickets: LeaderExportRow[]
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function tournamentToCSV(data: TournamentExport): string {
  const rows: (string | number)[][] = []
  rows.push(['Tournament', data.name])
  rows.push([])

  rows.push(['Standings'])
  rows.push(['#', 'Team', 'P', 'W', 'L', 'T', 'Pts', 'NRR'])
  for (const r of data.standings) {
    rows.push([r.rank, r.team, r.played, r.won, r.lost, r.tied, r.points, r.nrr])
  }
  rows.push([])

  rows.push(['Most runs'])
  rows.push(['#', 'Player', 'Runs'])
  for (const r of data.mostRuns) rows.push([r.rank, r.player, r.value])
  rows.push([])

  rows.push(['Most wickets'])
  rows.push(['#', 'Player', 'Wickets'])
  for (const r of data.mostWickets) rows.push([r.rank, r.player, r.value])

  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

export function tournamentToJSON(data: TournamentExport): string {
  return JSON.stringify(data, null, 2)
}
