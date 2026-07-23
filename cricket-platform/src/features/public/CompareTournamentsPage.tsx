import { useSearchParams, Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { listTournaments } from '@/services/tournaments.service'
import { listAllMatches } from '@/services/matches.service'
import { aggregateTournamentStats } from '@/domain/tournamentCompare'
import type { Tournament } from '@/types'

type Dir = 'high' | 'low'
interface Row {
  label: string
  a: number
  b: number
  dir: Dir
}

export function CompareTournamentsPage() {
  const [params, setParams] = useSearchParams()
  const tournaments = useAsync(listTournaments, [])
  const matches = useAsync(listAllMatches, [])

  const loading = tournaments.loading || matches.loading
  const list = tournaments.data ?? []

  if (loading) return <PageLoader />
  if (list.length < 2)
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <PageHeader title="Compare tournaments" />
        <EmptyState icon={<Trophy size={40} />} title="Not enough tournaments to compare" />
      </div>
    )

  const aId = params.get('a') || list[0].id
  const bId = params.get('b') || list.find((t) => t.id !== aId)!.id
  const setSide = (side: 'a' | 'b', id: string) => {
    const next = new URLSearchParams(params)
    next.set('a', side === 'a' ? id : aId)
    next.set('b', side === 'b' ? id : bId)
    setParams(next)
  }

  const ta1 = list.find((t) => t.id === aId)
  const tb1 = list.find((t) => t.id === bId)
  const sa = aggregateTournamentStats(aId, matches.data ?? [])
  const sb = aggregateTournamentStats(bId, matches.data ?? [])

  const rows: Row[] = [
    { label: 'Teams involved', a: sa.teams, b: sb.teams, dir: 'high' },
    { label: 'Matches', a: sa.matches, b: sb.matches, dir: 'high' },
    { label: 'Completed', a: sa.completedMatches, b: sb.completedMatches, dir: 'high' },
    { label: 'Runs scored', a: sa.runsScored, b: sb.runsScored, dir: 'high' },
    { label: 'Wickets taken', a: sa.wicketsTaken, b: sb.wicketsTaken, dir: 'high' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Compare tournaments"
        subtitle="Every team and match within each tournament, side by side."
        actions={
          <Link
            to="/compare"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            Compare players
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <TournamentPicker side="a" value={aId} tournaments={list} tournament={ta1} onChange={(id) => setSide('a', id)} />
        <TournamentPicker side="b" value={bId} tournaments={list} tournament={tb1} onChange={(id) => setSide('b', id)} />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-ink-50">
          {rows.map((row) => {
            const aBetter =
              row.a !== row.b && (row.dir === 'high' ? row.a > row.b : row.a < row.b)
            const bBetter =
              row.a !== row.b && (row.dir === 'high' ? row.b > row.a : row.b < row.a)
            return (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5 text-sm"
              >
                <span
                  className={`text-right font-semibold ${
                    aBetter ? 'text-pitch-700' : 'text-ink-700 dark:text-ink-300'
                  }`}
                >
                  {row.a}
                </span>
                <span className="px-2 text-center text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  {row.label}
                </span>
                <span
                  className={`font-semibold ${
                    bBetter ? 'text-pitch-700' : 'text-ink-700 dark:text-ink-300'
                  }`}
                >
                  {row.b}
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function TournamentPicker({
  side,
  value,
  tournaments,
  tournament,
  onChange,
}: {
  side: 'a' | 'b'
  value: string
  tournaments: Tournament[]
  tournament?: Tournament
  onChange: (id: string) => void
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 truncate font-semibold text-ink-900 dark:text-ink-50">
        {tournament ? (
          <Link to={`/tournament/${tournament.id}`} className="hover:text-brand-700">
            {tournament.name}
          </Link>
        ) : (
          <span className="text-ink-500 dark:text-ink-400">Select a tournament</span>
        )}
      </div>
      <select
        aria-label={`Tournament ${side.toUpperCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-800 dark:text-ink-200 focus:border-brand-500 focus:outline-none"
      >
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Card>
  )
}
