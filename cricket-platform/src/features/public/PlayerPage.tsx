import { useParams, Link } from 'react-router-dom'
import { User, Flag, Star, Award, Target, TrendingUp } from 'lucide-react'
import { Avatar, Badge, Card, PageLoader, EmptyState } from '@/components/ui/primitives'
import { FollowButton } from '@/components/ui/FollowButton'
import { Tabs } from '@/components/ui/Tabs'
import { useMemo, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getPlayer } from '@/services/players.service'
import { getTeamsByIds } from '@/services/teams.service'
import { getPlayerStats, getPlayerPerformances } from '@/services/stats.service'
import { listAllMatches } from '@/services/matches.service'
import { listTournaments } from '@/services/tournaments.service'
import { computeAchievements, computeAwards } from '@/domain/achievements'
import { playerTournamentSplits } from '@/domain/playerSplits'
import { playerTimeline } from '@/domain/playerTimeline'
import { aggregatePlayerStats } from '@/domain/stats'
import { AchievementsPanel } from '@/components/stats/AchievementsPanel'
import { PlayerForm } from '@/components/charts/PlayerForm'
import {
  battingAverage,
  strikeRate,
  economy,
  bowlingAverage,
  bowlingStrikeRate,
  formatBestBowling,
  ballsToOvers,
  PLAYER_ROLE_LABELS,
  BOWLING_STYLE_LABELS,
  formatDate,
} from '@/lib/format'

export function PlayerPage() {
  const { id = '' } = useParams()
  const player = useAsync(() => getPlayer(id), [id])
  const stats = useAsync(() => getPlayerStats(id), [id])
  const perfs = useAsync(() => getPlayerPerformances(id), [id])
  const matches = useAsync(listAllMatches, [])
  const tournaments = useAsync(listTournaments, [])
  const teams = useAsync(
    () => (player.data ? getTeamsByIds(player.data.teamIds) : Promise.resolve([])),
    [player.data],
  )
  const [tab, setTab] = useState('overview')

  // These recompute over every completed match, so they're memoised on the
  // underlying data. Hooks must run unconditionally before the loading/
  // not-found early returns below (Rules of Hooks).
  const splits = useMemo(
    () => playerTournamentSplits(id, matches.data ?? []),
    [id, matches.data],
  )
  const timeline = useMemo(
    () => playerTimeline(id, matches.data ?? []),
    [id, matches.data],
  )
  // Global rankings — where this player sits among all ranked players.
  const rankings = useMemo(() => {
    const allStatsArr = [...aggregatePlayerStats(matches.data ?? []).values()]
    const rankIn = (key: 'runs' | 'wickets' | 'sixes') => {
      const sorted = allStatsArr
        .filter((st) => st[key] > 0)
        .sort((a, b) => b[key] - a[key])
      const idx = sorted.findIndex((st) => st.playerId === id)
      return idx >= 0 ? { rank: idx + 1, total: sorted.length } : null
    }
    return (
      [
        { label: 'Runs', ...rankIn('runs') },
        { label: 'Wickets', ...rankIn('wickets') },
        { label: 'Sixes', ...rankIn('sixes') },
      ] as { label: string; rank?: number; total?: number }[]
    ).filter((r) => r.rank)
  }, [id, matches.data])
  // Prefer the live tournament name; fall back to the name denormalised on
  // the match (covers legacy/seed matches that never stored one).
  const tournamentNameById = useMemo(
    () => new Map((tournaments.data ?? []).map((tn) => [tn.id, tn.name])),
    [tournaments.data],
  )
  const splitName = (sp: (typeof splits)[number]) =>
    (sp.tournamentId && tournamentNameById.get(sp.tournamentId)) ||
    sp.tournamentName

  if (player.loading) return <PageLoader />
  if (!player.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<User size={40} />} title="Player not found" />
      </div>
    )

  const p = player.data
  const s = stats.data
  const dismissals = s ? s.inningsBatted - s.notOuts : 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Card className="mb-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={p.fullName} src={p.photoURL} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-ink-900">{p.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="blue">{PLAYER_ROLE_LABELS[p.role]}</Badge>
              <span className="text-sm text-ink-500">
                {p.battingStyle === 'right_hand' ? 'RHB' : 'LHB'}
                {p.bowlingStyle !== 'none' &&
                  ` · ${BOWLING_STYLE_LABELS[p.bowlingStyle]}`}
              </span>
            </div>
            {(teams.data ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(teams.data ?? []).map((t) => (
                  <Link
                    key={t.id}
                    to={`/team/${t.id}`}
                    className="text-sm font-medium text-brand-700 hover:underline"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <FollowButton kind="players" id={p.id} />
            <Link
              to={`/compare?a=${p.id}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Compare
            </Link>
          </div>
        </div>
      </Card>

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          ...(splits.length > 0
            ? [{ key: 'tournaments', label: 'By tournament' }]
            : []),
          ...(timeline.length > 0
            ? [{ key: 'timeline', label: 'Timeline' }]
            : []),
          { key: 'achievements', label: 'Achievements' },
          { key: 'matches', label: 'Match log' },
        ]}
      />

      {tab === 'achievements' &&
        (stats.loading ? (
          <PageLoader />
        ) : (
          <AchievementsPanel
            achievements={computeAchievements(
              s ?? {
                playerId: id,
                matches: 0,
                inningsBatted: 0,
                notOuts: 0,
                runs: 0,
                ballsFaced: 0,
                highScore: 0,
                highScoreNotOut: false,
                fours: 0,
                sixes: 0,
                thirties: 0,
                fifties: 0,
                hundreds: 0,
                inningsBowled: 0,
                ballsBowled: 0,
                runsConceded: 0,
                wickets: 0,
                maidens: 0,
                bestBowlingWkts: 0,
                bestBowlingRuns: 0,
                fiveWktHauls: 0,
                catches: 0,
                runOuts: 0,
                stumpings: 0,
                updatedAt: 0,
              },
            )}
            awards={computeAwards(id, matches.data ?? [])}
          />
        ))}

      {tab === 'overview' &&
        (stats.loading ? (
          <PageLoader />
        ) : !s || s.matches === 0 ? (
          <EmptyState
            title="No stats yet"
            description="Stats will appear once this player features in completed matches."
          />
        ) : (
          <div className="space-y-4">
            {rankings.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rankings.map((r) => (
                  <Link
                    key={r.label}
                    to="/stats"
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    <span className="font-bold text-brand-700">#{r.rank}</span>
                    <span className="text-ink-600">{r.label}</span>
                    <span className="text-xs text-ink-400">of {r.total}</span>
                  </Link>
                ))}
              </div>
            )}
            <PlayerForm performances={perfs.data ?? []} />
            <div className="grid gap-4 sm:grid-cols-2">
            <StatBlock
              title="Batting"
              rows={[
                ['Matches', s.matches],
                ['Innings', s.inningsBatted],
                ['Not outs', s.notOuts],
                ['Runs', s.runs],
                ['Balls faced', s.ballsFaced],
                ['Highest', `${s.highScore}${s.highScoreNotOut ? '*' : ''}`],
                ['Average', battingAverage(s.runs, dismissals)],
                ['Strike rate', strikeRate(s.runs, s.ballsFaced)],
                ['Fours', s.fours],
                ['Sixes', s.sixes],
                ['50s / 100s', `${s.fifties} / ${s.hundreds}`],
              ]}
            />
            <StatBlock
              title="Bowling"
              rows={[
                ['Innings', s.inningsBowled],
                ['Overs', ballsToOvers(s.ballsBowled)],
                ['Runs', s.runsConceded],
                ['Wickets', s.wickets],
                ['Best', formatBestBowling(s.bestBowlingWkts, s.bestBowlingRuns)],
                ['Average', bowlingAverage(s.runsConceded, s.wickets)],
                ['Economy', economy(s.runsConceded, s.ballsBowled)],
                ['Strike rate', bowlingStrikeRate(s.ballsBowled, s.wickets)],
                ['Maidens', s.maidens],
                ['5-wkt hauls', s.fiveWktHauls],
              ]}
            />
            <StatBlock
              title="Fielding"
              rows={[
                ['Catches', s.catches],
                ['Run outs', s.runOuts],
                ['Stumpings', s.stumpings],
              ]}
            />
            </div>
          </div>
        ))}

      {tab === 'tournaments' && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5 font-semibold">Tournament</th>
                <th className="px-2 py-2.5 text-right font-semibold">M</th>
                <th className="px-2 py-2.5 text-right font-semibold">Runs</th>
                <th className="px-2 py-2.5 text-right font-semibold">HS</th>
                <th className="px-2 py-2.5 text-right font-semibold">Avg</th>
                <th className="px-2 py-2.5 text-right font-semibold">SR</th>
                <th className="px-2 py-2.5 text-right font-semibold">Wkts</th>
                <th className="px-2 py-2.5 text-right font-semibold">Best</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ct</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((sp) => {
                const st = sp.stats
                return (
                  <tr key={sp.tournamentId ?? '__none__'} className="border-b border-ink-50">
                    <td className="px-4 py-2.5">
                      {sp.tournamentId ? (
                        <Link
                          to={`/tournament/${sp.tournamentId}`}
                          className="font-medium text-ink-900 hover:text-brand-700"
                        >
                          {splitName(sp)}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink-500">
                          {splitName(sp)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600">{st.matches}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink-900">
                      {st.runs}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600">
                      {st.highScore}
                      {st.highScoreNotOut ? '*' : ''}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600">
                      {battingAverage(st.runs, st.inningsBatted - st.notOuts)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600">
                      {strikeRate(st.runs, st.ballsFaced)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink-900">
                      {st.wickets}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600">
                      {formatBestBowling(st.bestBowlingWkts, st.bestBowlingRuns)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-600">{st.catches}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'timeline' && (
        <Card className="p-5">
          <ol className="relative ml-1 space-y-5 border-l-2 border-ink-100 pl-5">
            {timeline.map((e, i) => (
              <li key={`${e.matchId}-${e.title}-${i}`} className="relative">
                <span className="absolute -left-[30px] flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 ring-4 ring-white">
                  <TimelineIcon icon={e.icon} />
                </span>
                <Link to={`/match/${e.matchId}`} className="block hover:opacity-80">
                  <div className="font-semibold text-ink-900">{e.title}</div>
                  <div className="text-sm text-ink-600">{e.detail}</div>
                  <div className="text-xs text-ink-400">{formatDate(e.date)}</div>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {tab === 'matches' &&
        (perfs.loading ? (
          <PageLoader />
        ) : (perfs.data ?? []).length === 0 ? (
          <EmptyState title="No match performances yet" />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Match</th>
                  <th className="px-4 py-2.5 font-semibold">Batting</th>
                  <th className="px-4 py-2.5 font-semibold">Bowling</th>
                </tr>
              </thead>
              <tbody>
                {(perfs.data ?? []).map((perf) => (
                  <tr key={perf.matchId} className="border-b border-ink-50">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/match/${perf.matchId}`}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        vs {perf.opponent}
                      </Link>
                      <div className="text-xs text-ink-400">
                        {formatDate(perf.date)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">
                      {perf.batting
                        ? `${perf.batting.runs}${
                            perf.batting.out ? '' : '*'
                          } (${perf.batting.balls})`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">
                      {perf.bowling
                        ? `${perf.bowling.wickets}/${perf.bowling.runs} (${perf.bowling.overs})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
    </div>
  )
}

function TimelineIcon({ icon }: { icon: string }) {
  const size = 14
  if (icon === 'debut') return <Flag size={size} />
  if (icon === 'hundred') return <Award size={size} />
  if (icon === 'fifty') return <Star size={size} />
  if (icon === 'fivefor') return <Target size={size} />
  return <TrendingUp size={size} />
}

function StatBlock({
  title,
  rows,
}: {
  title: string
  rows: [string, string | number][]
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2.5 font-semibold text-ink-900">
        {title}
      </div>
      <div className="divide-y divide-ink-50">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-2 text-sm">
            <span className="text-ink-500">{label}</span>
            <span className="font-semibold text-ink-900">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
