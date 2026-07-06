import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Users,
  Trophy,
  Activity,
  TrendingUp,
  Star,
  Target,
  Flame,
  Swords,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, PageLoader, StatCard, EmptyState } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import { LeaderboardCard } from '@/components/stats/LeaderboardCard'
import { usePlatformStats } from '@/hooks/usePlatformStats'
import { useAsync } from '@/hooks/useAsync'
import { listTournaments } from '@/services/tournaments.service'
import { aggregatePlayerStats, buildLeaderboards } from '@/domain/stats'
import { computeTournamentRecords } from '@/domain/records'
import { ballsToOvers } from '@/lib/format'

const GROUPS: Record<string, string[]> = {
  batting: ['runs', 'average', 'sr', 'sixes', 'fours'],
  bowling: ['wickets', 'economy', 'bestBowling'],
  fielding: ['fielding'],
}

export function StatsPage() {
  const { loading, leaderboards, playerMap, playerStats, matches } =
    usePlatformStats()
  const tournaments = useAsync(listTournaments, [])
  const [tab, setTab] = useState<
    'batting' | 'bowling' | 'fielding' | 'records'
  >('batting')
  const [scope, setScope] = useState('all')

  // Tournaments that actually have completed matches, for the scope filter.
  const scopeOptions = useMemo(() => {
    const nameById = new Map(
      (tournaments.data ?? []).map((t) => [t.id, t.name]),
    )
    const withMatches = new Map<string, string>()
    for (const m of matches) {
      if (m.status !== 'completed' || !m.tournamentId) continue
      withMatches.set(
        m.tournamentId,
        nameById.get(m.tournamentId) ?? m.tournamentName ?? 'Tournament',
      )
    }
    return [...withMatches.entries()].map(([id, name]) => ({ id, name }))
  }, [matches, tournaments.data])

  const scopedMatches = useMemo(
    () => (scope === 'all' ? matches : matches.filter((m) => m.tournamentId === scope)),
    [scope, matches],
  )

  // Recompute leaderboards/stats for the selected scope (or reuse platform-wide).
  const scoped = useMemo(() => {
    if (scope === 'all') return { leaderboards, playerStats }
    const ps = aggregatePlayerStats(scopedMatches)
    return { leaderboards: buildLeaderboards(ps), playerStats: ps }
  }, [scope, scopedMatches, leaderboards, playerStats])

  const records = useMemo(
    () => computeTournamentRecords(scopedMatches),
    [scopedMatches],
  )

  const totals = useMemo(() => {
    let runs = 0
    let wkts = 0
    let sixes = 0
    for (const s of scoped.playerStats.values()) {
      runs += s.runs
      wkts += s.wickets
      sixes += s.sixes
    }
    return { runs, wkts, sixes, players: scoped.playerStats.size }
  }, [scoped.playerStats])

  const visible = scoped.leaderboards.filter((lb) =>
    (GROUPS[tab] ?? []).includes(lb.key),
  )

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Stats & analytics"
        subtitle="Leaderboards built from completed matches — platform-wide or per competition."
      />

      {loading ? (
        <PageLoader />
      ) : matches.filter((m) => m.status === 'completed').length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={40} />}
          title="No stats yet"
          description="Leaderboards appear once matches are completed."
        />
      ) : (
        <>
          {scopeOptions.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <label
                htmlFor="stats-scope"
                className="text-sm font-medium text-ink-600"
              >
                Competition
              </label>
              <select
                id="stats-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-800 focus:border-brand-500 focus:outline-none"
              >
                <option value="all">All competitions</option>
                {scopeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Runs scored" value={totals.runs} icon={<Activity size={20} />} tone="blue" />
            <StatCard label="Wickets taken" value={totals.wkts} icon={<Trophy size={20} />} tone="green" />
            <StatCard label="Sixes hit" value={totals.sixes} icon={<BarChart3 size={20} />} tone="amber" />
            <StatCard label="Ranked players" value={totals.players} icon={<Users size={20} />} tone="purple" />
          </div>

          <Tabs
            className="mb-4"
            active={tab}
            onChange={(k) => setTab(k as typeof tab)}
            tabs={[
              { key: 'batting', label: 'Batting' },
              { key: 'bowling', label: 'Bowling' },
              { key: 'fielding', label: 'Fielding' },
              { key: 'records', label: 'Records' },
            ]}
          />

          {tab === 'records' ? (
            <RecordsGrid
              records={records}
              nameOf={(pid) => playerMap.get(pid)?.displayName ?? '—'}
            />
          ) : visible.length === 0 ? (
            <EmptyState title="No data in this category yet" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((board, i) => (
                <LeaderboardCard
                  key={board.key}
                  board={board}
                  players={playerMap}
                  limit={8}
                  tone={i}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RecordsGrid({
  records,
  nameOf,
}: {
  records: ReturnType<typeof computeTournamentRecords>
  nameOf: (playerId: string) => string
}) {
  const cards: {
    key: string
    icon: React.ReactNode
    tone: string
    label: string
    value: string
    sub: string
    matchId: string
  }[] = []

  if (records.highestTeamTotal)
    cards.push({
      key: 'htt',
      icon: <TrendingUp size={18} />,
      tone: '#16a34a',
      label: 'Highest team total',
      value: `${records.highestTeamTotal.runs}/${records.highestTeamTotal.wickets}`,
      sub: `${records.highestTeamTotal.teamShort} · ${ballsToOvers(records.highestTeamTotal.legalBalls)} ov`,
      matchId: records.highestTeamTotal.matchId,
    })
  if (records.highestIndividualScore)
    cards.push({
      key: 'his',
      icon: <Star size={18} />,
      tone: '#d97706',
      label: 'Highest individual score',
      value: `${records.highestIndividualScore.runs}${records.highestIndividualScore.out ? '' : '*'}`,
      sub: `${nameOf(records.highestIndividualScore.playerId)} · ${records.highestIndividualScore.balls} balls`,
      matchId: records.highestIndividualScore.matchId,
    })
  if (records.bestBowlingFigures)
    cards.push({
      key: 'bbf',
      icon: <Target size={18} />,
      tone: '#dc2626',
      label: 'Best bowling figures',
      value: `${records.bestBowlingFigures.wickets}/${records.bestBowlingFigures.runs}`,
      sub: nameOf(records.bestBowlingFigures.playerId),
      matchId: records.bestBowlingFigures.matchId,
    })
  if (records.mostSixesInnings)
    cards.push({
      key: 'six',
      icon: <Flame size={18} />,
      tone: '#7c3aed',
      label: 'Most sixes in an innings',
      value: String(records.mostSixesInnings.count),
      sub: nameOf(records.mostSixesInnings.playerId),
      matchId: records.mostSixesInnings.matchId,
    })
  if (records.biggestWinByRuns)
    cards.push({
      key: 'bwr',
      icon: <Swords size={18} />,
      tone: '#16a34a',
      label: 'Biggest win (by runs)',
      value: `${records.biggestWinByRuns.margin} run${records.biggestWinByRuns.margin === 1 ? '' : 's'}`,
      sub: records.biggestWinByRuns.winnerName,
      matchId: records.biggestWinByRuns.matchId,
    })
  if (records.biggestWinByWickets)
    cards.push({
      key: 'bww',
      icon: <Swords size={18} />,
      tone: '#16a34a',
      label: 'Biggest win (by wickets)',
      value: `${records.biggestWinByWickets.margin} wkt${records.biggestWinByWickets.margin === 1 ? '' : 's'}`,
      sub: records.biggestWinByWickets.winnerName,
      matchId: records.biggestWinByWickets.matchId,
    })

  if (cards.length === 0)
    return <EmptyState title="No records yet — complete a match to set some." />

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.key}
          to={`/match/${c.matchId}`}
          className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-4 hover:border-brand-300 hover:bg-brand-50/40"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${c.tone}1a`, color: c.tone }}
          >
            {c.icon}
          </span>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-ink-400">
              {c.label}
            </div>
            <div className="truncate text-lg font-bold text-ink-900">
              {c.value}
            </div>
            <div className="truncate text-xs text-ink-500">{c.sub}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
