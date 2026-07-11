import { useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { listAllMatches } from '@/services/matches.service'
import { aggregateTeamStats } from '@/domain/stats'
import { computeHeadToHead } from '@/domain/headToHead'
import type { Match, TeamStats } from '@/types'

interface TeamOption {
  id: string
  name: string
  shortName: string
}

type Dir = 'high' | 'low'
interface Row {
  label: string
  a: number
  b: number
  dir: Dir
}

function statsFor(s: TeamStats | undefined) {
  const won = s?.won ?? 0
  const lost = s?.lost ?? 0
  const tied = s?.tied ?? 0
  const decided = won + lost + tied
  return {
    matches: s?.matches ?? 0,
    won,
    lost,
    tied,
    winPct: decided > 0 ? Math.round((won / decided) * 100) : 0,
    runsScored: s?.runsScored ?? 0,
    wicketsTaken: s?.wicketsTaken ?? 0,
  }
}

export function CompareTeamsPage() {
  const [params, setParams] = useSearchParams()
  const matches = useAsync(listAllMatches, [])
  const data = matches.data ?? []

  const teamStats = useMemo(() => aggregateTeamStats(data), [data])

  // Source the team list from denormalised match data, so teams whose docs
  // were deleted are still comparable.
  const teams = useMemo(() => {
    const map = new Map<string, TeamOption>()
    for (const m of data) {
      for (const t of [m.teamA, m.teamB]) {
        if (!map.has(t.id))
          map.set(t.id, { id: t.id, name: t.name, shortName: t.shortName })
      }
    }
    return [...map.values()].sort((x, y) => x.name.localeCompare(y.name))
  }, [data])

  if (matches.loading) return <PageLoader />
  if (teams.length < 2)
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <PageHeader title="Compare teams" />
        <EmptyState icon={<Shield size={40} />} title="Not enough teams to compare" />
      </div>
    )

  const aId = params.get('a') || teams[0].id
  const bId = params.get('b') || teams.find((t) => t.id !== aId)!.id
  const setSide = (side: 'a' | 'b', id: string) => {
    const next = new URLSearchParams(params)
    next.set('a', side === 'a' ? id : aId)
    next.set('b', side === 'b' ? id : bId)
    setParams(next)
  }

  const ta = teams.find((t) => t.id === aId)
  const tb = teams.find((t) => t.id === bId)
  const sa = statsFor(teamStats.get(aId))
  const sb = statsFor(teamStats.get(bId))
  const h2h = computeHeadToHead(aId, bId, data)

  const rows: Row[] = [
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
        title="Compare teams"
        subtitle="Head-to-head records, side by side."
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
        <TeamPicker side="a" value={aId} teams={teams} team={ta} onChange={(id) => setSide('a', id)} />
        <TeamPicker side="b" value={bId} teams={teams} team={tb} onChange={(id) => setSide('b', id)} />
      </div>

      {h2h.played > 0 && (
        <Card className="mb-4 p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Head to head · {h2h.played} meeting{h2h.played === 1 ? '' : 's'}
          </div>
          <div className="mt-1 text-lg font-extrabold text-ink-900 dark:text-ink-50">
            {ta?.shortName} {h2h.aWins} &ndash; {h2h.bWins} {tb?.shortName}
            {h2h.tied > 0 && (
              <span className="ml-2 text-sm font-medium text-ink-500 dark:text-ink-400">
                ({h2h.tied} tied)
              </span>
            )}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="divide-y divide-ink-50">
          {rows.map((row) => {
            const aBetter =
              row.a !== row.b &&
              (row.dir === 'high' ? row.a > row.b : row.a < row.b)
            const bBetter =
              row.a !== row.b &&
              (row.dir === 'high' ? row.b > row.a : row.b < row.a)
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

function TeamPicker({
  side,
  value,
  teams,
  team,
  onChange,
}: {
  side: 'a' | 'b'
  value: string
  teams: TeamOption[]
  team?: TeamOption
  onChange: (id: string) => void
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 truncate font-semibold text-ink-900 dark:text-ink-50">
        {team ? (
          <Link to={`/team/${team.id}`} className="hover:text-brand-700">
            {team.name}
          </Link>
        ) : (
          <span className="text-ink-500 dark:text-ink-400">Select a team</span>
        )}
      </div>
      <select
        aria-label={`Team ${side.toUpperCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-800 dark:text-ink-200 focus:border-brand-500 focus:outline-none"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Card>
  )
}
