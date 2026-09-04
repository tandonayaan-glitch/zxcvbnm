import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { PageLoader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { getTournament } from '@/services/tournaments.service'
import { listTeams } from '@/services/teams.service'
import { listPlayers } from '@/services/players.service'
import { listAllMatches } from '@/services/matches.service'
import { computeStandings, aggregatePlayerStats, buildLeaderboards } from '@/domain/stats'
import { computeTournamentRecords } from '@/domain/records'
import { computeTournamentAwards } from '@/domain/awards'
import { formatDate } from '@/lib/format'

/**
 * A printable tournament report — real data assembled from the same domain functions the
 * tournament page itself uses, rendered for `window.print()` → "Save as PDF". This project has
 * no server-side PDF-rendering pipeline, so this is the honest way to produce a PDF: the
 * browser's own print-to-PDF, not a fabricated "export" that doesn't actually generate a file.
 */
export function TournamentReportPage() {
  const { id = '' } = useParams()
  const tournament = useAsync(() => getTournament(id), [id])
  const teams = useAsync(listTeams, [])
  const players = useAsync(listPlayers, [])
  const matches = useAsync(listAllMatches, [])

  useDocumentMeta(tournament.data ? `${tournament.data.name} — Report` : 'Tournament report')

  const tMatches = useMemo(
    () => (matches.data ?? []).filter((m) => m.tournamentId === id && !m.deletedAt),
    [matches.data, id],
  )
  const teamNameById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t.name])), [teams.data])
  const playerNameById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p.displayName])),
    [players.data],
  )

  const standings = useMemo(
    () => (tournament.data ? computeStandings(tournament.data.teamIds, teams.data ?? [], tMatches) : []),
    [tournament.data, teams.data, tMatches],
  )
  const stats = useMemo(() => aggregatePlayerStats(tMatches), [tMatches])
  const leaderboards = useMemo(() => buildLeaderboards(stats, 5), [stats])
  const records = useMemo(() => computeTournamentRecords(tMatches), [tMatches])
  const awards = useMemo(() => computeTournamentAwards(stats, tMatches), [stats, tMatches])
  const completed = tMatches.filter((m) => m.status === 'completed')

  if (tournament.loading || matches.loading) return <PageLoader label="Building report…" />
  if (!tournament.data) return <div className="p-8 text-center text-ink-500">Tournament not found.</div>

  const t = tournament.data

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to={`/tournament/${id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700">
          <ArrowLeft size={15} /> Back to tournament
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
        >
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">{t.name}</h1>
      <p className="text-sm text-ink-500 dark:text-ink-400">
        {t.format} · {completed.length} of {tMatches.length} matches completed
        {t.startDate && ` · from ${formatDate(t.startDate)}`}
      </p>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold text-ink-900 dark:text-ink-50">Standings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-ink-500 dark:border-ink-700">
              <th className="py-1">Team</th>
              <th className="py-1 text-right">P</th>
              <th className="py-1 text-right">W</th>
              <th className="py-1 text-right">L</th>
              <th className="py-1 text-right">Pts</th>
              <th className="py-1 text-right">NRR</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.teamId} className="border-b border-ink-100 dark:border-ink-800">
                <td className="py-1 font-medium">{row.teamName}</td>
                <td className="py-1 text-right">{row.played}</td>
                <td className="py-1 text-right">{row.won}</td>
                <td className="py-1 text-right">{row.lost}</td>
                <td className="py-1 text-right font-semibold">{row.points}</td>
                <td className="py-1 text-right">{row.nrr.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold text-ink-900 dark:text-ink-50">Results</h2>
        <ul className="space-y-1 text-sm">
          {completed.map((m) => (
            <li key={m.id}>
              {formatDate(m.completedAt)} — {m.teamA.name} v {m.teamB.name}: {m.result?.summary ?? '—'}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold text-ink-900 dark:text-ink-50">Leaders</h2>
        <div className="grid grid-cols-2 gap-4">
          {leaderboards.map((b) => (
            <div key={b.key}>
              <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300">{b.title}</h3>
              <ol className="mt-1 text-sm">
                {b.rows.map((r, i) => (
                  <li key={r.playerId}>
                    {i + 1}. {playerNameById.get(r.playerId) ?? 'Unknown'} — {r.display}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {awards.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-ink-900 dark:text-ink-50">Awards</h2>
          <ul className="text-sm">
            {awards.map((a) => (
              <li key={a.key}>
                {a.title}: {playerNameById.get(a.playerId) ?? 'Unknown'} ({a.value})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold text-ink-900 dark:text-ink-50">Records</h2>
        <ul className="text-sm">
          {records.highestTeamTotal && (
            <li>
              Highest total: {records.highestTeamTotal.runs}/{records.highestTeamTotal.wickets} (
              {teamNameById.get(records.highestTeamTotal.teamId) ?? 'Team'})
            </li>
          )}
          {records.highestIndividualScore && (
            <li>
              Highest score: {records.highestIndividualScore.runs}
              {!records.highestIndividualScore.out ? '*' : ''} (
              {playerNameById.get(records.highestIndividualScore.playerId) ?? 'Unknown'})
            </li>
          )}
          {records.bestBowlingFigures && (
            <li>
              Best bowling: {records.bestBowlingFigures.wickets}/{records.bestBowlingFigures.runs} (
              {playerNameById.get(records.bestBowlingFigures.playerId) ?? 'Unknown'})
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
