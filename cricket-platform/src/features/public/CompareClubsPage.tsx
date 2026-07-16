import { useSearchParams, Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { listClubs } from '@/services/clubs.service'
import { listTeams } from '@/services/teams.service'
import { listAllMatches } from '@/services/matches.service'
import { aggregateClubStats } from '@/domain/clubCompare'
import type { Club } from '@/types'

type Dir = 'high' | 'low'
interface Row {
  label: string
  a: number
  b: number
  dir: Dir
}

export function CompareClubsPage() {
  const [params, setParams] = useSearchParams()
  const clubs = useAsync(listClubs, [])
  const teams = useAsync(listTeams, [])
  const matches = useAsync(listAllMatches, [])

  const loading = clubs.loading || teams.loading || matches.loading
  const list = clubs.data ?? []

  if (loading) return <PageLoader />
  if (list.length < 2)
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <PageHeader title="Compare clubs" />
        <EmptyState icon={<Building2 size={40} />} title="Not enough clubs to compare" />
      </div>
    )

  const aId = params.get('a') || list[0].id
  const bId = params.get('b') || list.find((c) => c.id !== aId)!.id
  const setSide = (side: 'a' | 'b', id: string) => {
    const next = new URLSearchParams(params)
    next.set('a', side === 'a' ? id : aId)
    next.set('b', side === 'b' ? id : bId)
    setParams(next)
  }

  const ca = list.find((c) => c.id === aId)
  const cb = list.find((c) => c.id === bId)
  const sa = aggregateClubStats(aId, teams.data ?? [], matches.data ?? [])
  const sb = aggregateClubStats(bId, teams.data ?? [], matches.data ?? [])

  const rows: Row[] = [
    { label: 'Teams', a: sa.teams, b: sb.teams, dir: 'high' },
    { label: 'Played', a: sa.matches, b: sb.matches, dir: 'high' },
    { label: 'Won', a: sa.won, b: sb.won, dir: 'high' },
    { label: 'Lost', a: sa.lost, b: sb.lost, dir: 'low' },
    { label: 'Tied', a: sa.tied, b: sb.tied, dir: 'high' },
    { label: 'Win %', a: sa.winPct, b: sb.winPct, dir: 'high' },
    { label: 'Runs scored', a: sa.runsScored, b: sb.runsScored, dir: 'high' },
    { label: 'Wickets taken', a: sa.wicketsTaken, b: sb.wicketsTaken, dir: 'high' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Compare clubs"
        subtitle="Combined record across every team under each club, side by side."
        actions={
          <Link
            to="/compare/seasons"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            Compare seasons
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <ClubPicker side="a" value={aId} clubs={list} club={ca} onChange={(id) => setSide('a', id)} />
        <ClubPicker side="b" value={bId} clubs={list} club={cb} onChange={(id) => setSide('b', id)} />
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

function ClubPicker({
  side,
  value,
  clubs,
  club,
  onChange,
}: {
  side: 'a' | 'b'
  value: string
  clubs: Club[]
  club?: Club
  onChange: (id: string) => void
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 truncate font-semibold text-ink-900 dark:text-ink-50">
        {club ? (
          <Link to={`/club/${club.id}`} className="hover:text-brand-700">
            {club.name}
          </Link>
        ) : (
          <span className="text-ink-500 dark:text-ink-400">Select a club</span>
        )}
      </div>
      <select
        aria-label={`Club ${side.toUpperCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-800 dark:text-ink-200 focus:border-brand-500 focus:outline-none"
      >
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Card>
  )
}
