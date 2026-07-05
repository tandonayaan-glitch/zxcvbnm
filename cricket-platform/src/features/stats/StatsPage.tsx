import { useMemo, useState } from 'react'
import { BarChart3, Users, Trophy, Activity } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader, StatCard, EmptyState } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import { LeaderboardCard } from '@/components/stats/LeaderboardCard'
import { usePlatformStats } from '@/hooks/usePlatformStats'
import { useAsync } from '@/hooks/useAsync'
import { listTournaments } from '@/services/tournaments.service'
import { aggregatePlayerStats, buildLeaderboards } from '@/domain/stats'

const GROUPS: Record<string, string[]> = {
  batting: ['runs', 'average', 'sr', 'sixes', 'fours'],
  bowling: ['wickets', 'economy', 'bestBowling'],
  fielding: ['fielding'],
}

export function StatsPage() {
  const { loading, leaderboards, playerMap, playerStats, matches } =
    usePlatformStats()
  const tournaments = useAsync(listTournaments, [])
  const [tab, setTab] = useState<'batting' | 'bowling' | 'fielding'>('batting')
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

  // Recompute leaderboards/stats for the selected scope (or reuse platform-wide).
  const scoped = useMemo(() => {
    if (scope === 'all') return { leaderboards, playerStats }
    const subset = matches.filter((m) => m.tournamentId === scope)
    const ps = aggregatePlayerStats(subset)
    return { leaderboards: buildLeaderboards(ps), playerStats: ps }
  }, [scope, matches, leaderboards, playerStats])

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

  const visible = scoped.leaderboards.filter((lb) => GROUPS[tab].includes(lb.key))

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
            ]}
          />

          {visible.length === 0 ? (
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
