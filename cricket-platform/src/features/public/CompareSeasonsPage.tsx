import { useSearchParams, Link } from 'react-router-dom'
import { CalendarRange } from 'lucide-react'
import { Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { listSeasons } from '@/services/seasons.service'
import { listTournaments } from '@/services/tournaments.service'
import { listAllMatches } from '@/services/matches.service'
import { aggregateSeasonStats } from '@/domain/seasonCompare'
import { PremiumGate } from '@/components/guards/PremiumGate'
import type { Season } from '@/types'

type Dir = 'high' | 'low'
interface Row {
  label: string
  a: number
  b: number
  dir: Dir
}

export function CompareSeasonsPage() {
  const [params, setParams] = useSearchParams()
  const seasons = useAsync(listSeasons, [])
  const tournaments = useAsync(listTournaments, [])
  const matches = useAsync(listAllMatches, [])

  const loading = seasons.loading || tournaments.loading || matches.loading
  const list = seasons.data ?? []

  if (loading) return <PageLoader />
  if (list.length < 2)
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <PageHeader title="Compare seasons" />
        <EmptyState icon={<CalendarRange size={40} />} title="Not enough seasons to compare" />
      </div>
    )

  const aId = params.get('a') || list[0].id
  const bId = params.get('b') || list.find((s) => s.id !== aId)!.id
  const setSide = (side: 'a' | 'b', id: string) => {
    const next = new URLSearchParams(params)
    next.set('a', side === 'a' ? id : aId)
    next.set('b', side === 'b' ? id : bId)
    setParams(next)
  }

  const sa1 = list.find((s) => s.id === aId)
  const sb1 = list.find((s) => s.id === bId)
  const sa = aggregateSeasonStats(aId, tournaments.data ?? [], matches.data ?? [])
  const sb = aggregateSeasonStats(bId, tournaments.data ?? [], matches.data ?? [])

  const rows: Row[] = [
    { label: 'Tournaments', a: sa.tournaments, b: sb.tournaments, dir: 'high' },
    { label: 'Teams involved', a: sa.teams, b: sb.teams, dir: 'high' },
    { label: 'Matches', a: sa.matches, b: sb.matches, dir: 'high' },
    { label: 'Completed', a: sa.completedMatches, b: sb.completedMatches, dir: 'high' },
    { label: 'Runs scored', a: sa.runsScored, b: sb.runsScored, dir: 'high' },
    { label: 'Wickets taken', a: sa.wicketsTaken, b: sb.wicketsTaken, dir: 'high' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Compare seasons"
        subtitle="Every tournament and match under each season, side by side."
        actions={
          <Link
            to="/compare/tournaments"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            Compare tournaments
          </Link>
        }
      />

      <PremiumGate feature="tournament_comparison">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <SeasonPicker side="a" value={aId} seasons={list} season={sa1} onChange={(id) => setSide('a', id)} />
          <SeasonPicker side="b" value={bId} seasons={list} season={sb1} onChange={(id) => setSide('b', id)} />
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
      </PremiumGate>
    </div>
  )
}

function SeasonPicker({
  side,
  value,
  seasons,
  season,
  onChange,
}: {
  side: 'a' | 'b'
  value: string
  seasons: Season[]
  season?: Season
  onChange: (id: string) => void
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 truncate font-semibold text-ink-900 dark:text-ink-50">
        {season ? (
          <Link to={`/season/${season.id}`} className="hover:text-brand-700">
            {season.name}
          </Link>
        ) : (
          <span className="text-ink-500 dark:text-ink-400">Select a season</span>
        )}
      </div>
      <select
        aria-label={`Season ${side.toUpperCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-800 dark:text-ink-200 focus:border-brand-500 focus:outline-none"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </Card>
  )
}
