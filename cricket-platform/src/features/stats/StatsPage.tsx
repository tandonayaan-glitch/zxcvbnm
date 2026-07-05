import { useMemo, useState } from 'react'
import { BarChart3, Users, Trophy, Activity } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader, StatCard, EmptyState } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import { LeaderboardCard } from '@/components/stats/LeaderboardCard'
import { usePlatformStats } from '@/hooks/usePlatformStats'

const GROUPS: Record<string, string[]> = {
  batting: ['runs', 'average', 'sr', 'sixes', 'fours'],
  bowling: ['wickets', 'economy', 'bestBowling'],
  fielding: ['fielding'],
}

export function StatsPage() {
  const { loading, leaderboards, playerMap, playerStats, matches } =
    usePlatformStats()
  const [tab, setTab] = useState<'batting' | 'bowling' | 'fielding'>('batting')

  const totals = useMemo(() => {
    let runs = 0
    let wkts = 0
    let sixes = 0
    for (const s of playerStats.values()) {
      runs += s.runs
      wkts += s.wickets
      sixes += s.sixes
    }
    return { runs, wkts, sixes, players: playerStats.size }
  }, [playerStats])

  const visible = leaderboards.filter((lb) => GROUPS[tab].includes(lb.key))

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Stats & analytics"
        subtitle="Platform-wide leaderboards built from every completed match."
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
