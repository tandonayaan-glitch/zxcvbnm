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
import {
  aggregatePlayerStats,
  aggregateTeamStats,
  buildLeaderboards,
  buildImpactBoard,
} from '@/domain/stats'
import { computeTournamentRecords } from '@/domain/records'
import { ballsToOvers } from '@/lib/format'

const GROUPS: Record<string, string[]> = {
  batting: ['runs', 'average', 'sr', 'sixes', 'fours'],
  bowling: ['wickets', 'economy', 'bestBowling'],
  fielding: ['fielding'],
}

export function StatsPage() {
  const { loading, leaderboards, playerMap, teamMap, playerStats, matches } =
    usePlatformStats()
  const tournaments = useAsync(listTournaments, [])
  const [tab, setTab] = useState<
    'batting' | 'bowling' | 'fielding' | 'teams' | 'records'
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

  const impactBoard = useMemo(
    () => buildImpactBoard(scoped.playerStats, 5),
    [scoped.playerStats],
  )

  // Resolve team names from denormalised match data, so standings survive a
  // deleted team doc (falls back to the live team doc name when present).
  const teamNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of matches) {
      map.set(m.teamA.id, m.teamA.name)
      map.set(m.teamB.id, m.teamB.name)
    }
    return map
  }, [matches])

  const teamStandings = useMemo(
    () =>
      [...aggregateTeamStats(scopedMatches).values()].sort(
        (a, b) =>
          b.won - a.won ||
          b.won / Math.max(1, b.won + b.lost) -
            a.won / Math.max(1, a.won + a.lost) ||
          b.runsScored - a.runsScored,
      ),
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
        actions={
          <Link
            to="/compare"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Compare players
          </Link>
        }
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

          {impactBoard.rows.length > 0 && (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <LeaderboardCard
                board={impactBoard}
                players={playerMap}
                limit={5}
                tone={3}
              />
              <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4 text-sm text-ink-500">
                <div className="mb-1 font-semibold text-ink-700">
                  How impact is scored
                </div>
                Batting: runs + boundary &amp; milestone bonuses. Bowling: 20 per
                wicket, plus maidens &amp; five-fors. Fielding: 8&ndash;12 per
                dismissal. A simple, explainable all-round rating&nbsp;&mdash; not
                a tuned model.
              </div>
            </div>
          )}

          <Tabs
            className="mb-4"
            active={tab}
            onChange={(k) => setTab(k as typeof tab)}
            tabs={[
              { key: 'batting', label: 'Batting' },
              { key: 'bowling', label: 'Bowling' },
              { key: 'fielding', label: 'Fielding' },
              { key: 'teams', label: 'Teams' },
              { key: 'records', label: 'Records' },
            ]}
          />

          {tab === 'teams' ? (
            teamStandings.length === 0 ? (
              <EmptyState title="No team results yet" />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="px-3 py-2.5 font-semibold">#</th>
                      <th className="px-3 py-2.5 font-semibold">Team</th>
                      <th className="px-2 py-2.5 text-right font-semibold">P</th>
                      <th className="px-2 py-2.5 text-right font-semibold">W</th>
                      <th className="px-2 py-2.5 text-right font-semibold">L</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Win %</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStandings.map((t, i) => {
                      const decided = t.won + t.lost + t.tied
                      const winPct =
                        decided > 0 ? Math.round((t.won / decided) * 100) : 0
                      const teamName =
                        teamMap.get(t.teamId)?.name ??
                        teamNameById.get(t.teamId) ??
                        'Team'
                      return (
                        <tr key={t.teamId} className="border-b border-ink-50">
                          <td className="px-3 py-2.5 text-ink-400">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <Link
                              to={`/team/${t.teamId}`}
                              className="font-medium text-ink-900 hover:text-brand-700"
                            >
                              {teamName}
                            </Link>
                          </td>
                          <td className="px-2 py-2.5 text-right text-ink-600">{t.matches}</td>
                          <td className="px-2 py-2.5 text-right text-pitch-700">{t.won}</td>
                          <td className="px-2 py-2.5 text-right text-red-600">{t.lost}</td>
                          <td className="px-2 py-2.5 text-right font-semibold text-ink-900">
                            {winPct}%
                          </td>
                          <td className="px-3 py-2.5 text-right text-ink-600">
                            {t.runsScored}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )
          ) : tab === 'records' ? (
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
