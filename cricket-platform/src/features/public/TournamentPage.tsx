import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Trophy,
  RefreshCw,
  Plus,
  TrendingUp,
  TrendingDown,
  Star,
  Target,
  Flame,
  Hash,
  Swords,
  Award as AwardIcon,
  Download,
  FileJson,
  Printer,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { ShareButton } from '@/components/ui/ShareButton'
import { QRCodeButton } from '@/components/ui/QRCodeButton'
import { FollowButton } from '@/components/ui/FollowButton'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { getTournament } from '@/services/tournaments.service'
import { listTeams } from '@/services/teams.service'
import { listPlayers } from '@/services/players.service'
import { listAllMatches } from '@/services/matches.service'
import { listClubs } from '@/services/clubs.service'
import { listSeasons } from '@/services/seasons.service'
import { recomputeTournamentStandings, recomputeAllStats } from '@/services/stats.service'
import {
  computeStandings,
  aggregatePlayerStats,
  topRunScorers,
  topWicketTakers,
} from '@/domain/stats'
import { computeTournamentRecords } from '@/domain/records'
import { computeTournamentAwards } from '@/domain/awards'
import { bracketRounds, hasKnockoutPhase } from '@/domain/bracket'
import { groupStandings } from '@/domain/groups'
import { groupQualification, type QualificationRow } from '@/domain/qualification'
import { tournamentTimeline } from '@/domain/tournamentTimeline'
import {
  tournamentToCSV,
  tournamentToJSON,
  type TournamentExport,
} from '@/domain/tournamentExport'
import { downloadBlob, slugify } from '@/lib/download'
import { canManageTournaments, useAuthStore } from '@/store/authStore'
import { formatDate, formatRate, ballsToOvers } from '@/lib/format'
import type { Match, StandingsRow } from '@/types'

export function TournamentPage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const tournament = useAsync(() => getTournament(id), [id])
  const teams = useAsync(listTeams, [])
  const players = useAsync(listPlayers, [])
  const matches = useAsync(listAllMatches, [])
  const clubs = useAsync(listClubs, [])
  const seasons = useAsync(listSeasons, [])
  const [tab, setTab] = useState('standings')
  const [refreshing, setRefreshing] = useState(false)

  const tMatches = useMemo(
    () => (matches.data ?? []).filter((m) => m.tournamentId === id),
    [matches.data, id],
  )

  const standings = useMemo(() => {
    if (!tournament.data) return []
    return computeStandings(
      tournament.data.teamIds ?? [],
      teams.data ?? [],
      tMatches,
    )
  }, [tournament.data, teams.data, tMatches])

  const groups = useMemo(() => {
    if (!tournament.data) return []
    return groupStandings(
      tournament.data.teamGroups,
      tournament.data.teamIds ?? [],
      teams.data ?? [],
      tMatches,
    )
  }, [tournament.data, teams.data, tMatches])

  const qualification = useMemo(() => {
    if (groups.length === 0) return []
    const n = tournament.data?.qualifiersPerGroup ?? 2
    return groups.map((g) => ({
      group: g.group,
      rows: groupQualification(g.rows, tMatches, n),
    }))
  }, [groups, tMatches, tournament.data?.qualifiersPerGroup])

  const timeline = useMemo(() => tournamentTimeline(tMatches), [tMatches])

  const stats = useMemo(() => aggregatePlayerStats(tMatches), [tMatches])
  const records = useMemo(() => computeTournamentRecords(tMatches), [tMatches])
  const awards = useMemo(
    () => computeTournamentAwards(stats, tMatches),
    [stats, tMatches],
  )
  const rounds = useMemo(() => bracketRounds(tMatches), [tMatches])
  const playerName = (pid: string) =>
    (players.data ?? []).find((p) => p.id === pid)?.displayName ?? 'Unknown'

  // Team names from denormalised match data, so standings survive a deleted
  // team doc (computeStandings falls back to a generic "Team" otherwise).
  const teamNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of tMatches) {
      map.set(m.teamA.id, m.teamA.name)
      map.set(m.teamB.id, m.teamB.name)
    }
    return map
  }, [tMatches])

  // Rebuilding these (top-20 leader lists) is cheap, but memoise anyway since
  // standings/stats/teamNameById are already memoised and exportData doesn't
  // depend on `tab`, so there's no reason to rebuild it on every tab switch.
  const exportData: TournamentExport = useMemo(
    () => ({
      name: tournament.data?.name ?? '',
      standings: standings.map((r, i) => ({
        rank: i + 1,
        team: teamNameById.get(r.teamId) ?? r.teamName,
        played: r.played,
        won: r.won,
        lost: r.lost,
        tied: r.tied,
        points: r.points,
        nrr: r.nrr,
      })),
      mostRuns: topRunScorers(stats, 20).map((r, i) => ({
        rank: i + 1,
        player: playerName(r.playerId),
        value: r.value,
      })),
      mostWickets: topWicketTakers(stats, 20).map((r, i) => ({
        rank: i + 1,
        player: playerName(r.playerId),
        value: r.value,
      })),
    }),
    [tournament.data?.name, standings, teamNameById, stats, players.data],
  )

  if (tournament.loading) return <PageLoader />
  if (!tournament.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<Trophy size={40} />} title="Tournament not found" />
      </div>
    )

  const t = tournament.data
  const tournamentTeams = (teams.data ?? []).filter((x) =>
    (t.teamIds ?? []).includes(x.id),
  )
  const clubName = (clubs.data ?? []).find((c) => c.id === t.clubId)?.name
  const seasonName = (seasons.data ?? []).find((s) => s.id === t.seasonId)?.name
  const showBracket = hasKnockoutPhase(t.format)

  const hasExport =
    exportData.standings.length > 0 ||
    exportData.mostRuns.length > 0 ||
    exportData.mostWickets.length > 0
  const exportBase = `${slugify(t.name)}-${id}`

  async function refresh() {
    setRefreshing(true)
    try {
      await recomputeAllStats()
      await recomputeTournamentStandings(id)
      toast.success('Standings & stats refreshed')
      matches.refetch()
    } catch {
      toast.error('Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {t.bannerURL && (
        <img
          src={t.bannerURL}
          alt={`${t.name} banner`}
          className="mb-4 h-40 w-full rounded-xl object-cover sm:h-56"
        />
      )}
      <Card className="mb-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Trophy size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">{t.name}</h1>
              <div className="mt-0.5 flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
                <Badge tone={t.status === 'ongoing' ? 'green' : 'gray'}>
                  {t.status}
                </Badge>
                <span className="capitalize">{t.format.replace('_', ' + ')}</span>
                <span>· {formatDate(t.startDate)}</span>
                {(clubName || seasonName) && (
                  <span className="flex items-center gap-1">
                    ·
                    {clubName && t.clubId && (
                      <Link to={`/club/${t.clubId}`} className="hover:text-brand-700">
                        {clubName}
                      </Link>
                    )}
                    {clubName && seasonName && '/'}
                    {seasonName && t.seasonId && (
                      <Link to={`/season/${t.seasonId}`} className="hover:text-brand-700">
                        {seasonName}
                      </Link>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <ShareButton variant="icon" title={t.name} />
            <QRCodeButton title={t.name} />
            <FollowButton kind="tournaments" id={t.id} />
            {canManageTournaments(profile) && (
              <>
                <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}>
                  <RefreshCw size={14} /> Refresh
                </Button>
                <Link to="/matches/new">
                  <Button size="sm">
                    <Plus size={14} /> Match
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
        {t.description && (
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">{t.description}</p>
        )}
      </Card>

      {hasExport && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Export
          </span>
          <button
            onClick={() =>
              downloadBlob(
                `${exportBase}.csv`,
                tournamentToCSV(exportData),
                'text/csv;charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <Download size={15} /> CSV
          </button>
          <button
            onClick={() =>
              downloadBlob(
                `${exportBase}.json`,
                tournamentToJSON(exportData),
                'application/json',
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <FileJson size={15} /> JSON
          </button>
          <button
            onClick={() => window.print()}
            title="Opens the browser print dialog — choose &quot;Save as PDF&quot; as the destination for a PDF file"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>
      )}

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'standings', label: 'Standings' },
          ...(groups.length > 0
            ? [
                { key: 'groups', label: 'Groups' },
                { key: 'qualification', label: 'Qualification' },
              ]
            : []),
          ...(showBracket ? [{ key: 'bracket', label: 'Bracket' }] : []),
          { key: 'matches', label: 'Fixtures & Results' },
          { key: 'timeline', label: 'Timeline' },
          { key: 'leaders', label: 'Leaders' },
          { key: 'awards', label: 'Awards' },
          { key: 'records', label: 'Records' },
          { key: 'teams', label: 'Teams' },
          { key: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'standings' && (
        <StandingsTable rows={standings} teamNameById={teamNameById} />
      )}

      {tab === 'groups' && (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="mb-1.5 text-sm font-semibold text-ink-800 dark:text-ink-200">
                Group {g.group}
              </div>
              <StandingsTable rows={g.rows} teamNameById={teamNameById} />
            </div>
          ))}
        </div>
      )}

      {tab === 'qualification' && (
        <div className="space-y-4">
          {qualification.map((g) => (
            <div key={g.group}>
              <div className="mb-1.5 text-sm font-semibold text-ink-800 dark:text-ink-200">
                Group {g.group}
              </div>
              <QualificationTable rows={g.rows} teamNameById={teamNameById} />
            </div>
          ))}
        </div>
      )}

      {tab === 'bracket' && (
        <div>
          {rounds.length === 0 ? (
            <EmptyState
              icon={<Trophy size={40} />}
              title="No knockout matches yet"
              description="Assign a stage (semi-final, final…) when creating a match to build the bracket."
            />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {rounds.map((round) => (
                <div key={round.stage} className="min-w-[220px] flex-1">
                  <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    {round.label}
                  </div>
                  <div className="flex h-full flex-col justify-around gap-3">
                    {round.matches.map((m) => (
                      <BracketMatch key={m.id} match={m} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'matches' && (
        <div className="space-y-2">
          {tMatches.length === 0 ? (
            <EmptyState title="No matches scheduled" />
          ) : (
            tMatches.map((m) => (
              <Link key={m.id} to={`/match/${m.id}`}>
                <Card className="flex items-center justify-between p-3.5 hover:border-brand-300">
                  <div>
                    <div className="font-medium text-ink-900 dark:text-ink-50">
                      {m.teamA.name} vs {m.teamB.name}
                    </div>
                    <div className="text-sm text-ink-500 dark:text-ink-400">
                      {formatDate(m.scheduledAt ?? m.createdAt)}
                    </div>
                    {m.result && (
                      <div className="text-sm text-pitch-700">
                        {m.result.summary}
                      </div>
                    )}
                  </div>
                  <Badge
                    tone={
                      m.status === 'live' || m.status === 'innings_break'
                        ? 'red'
                        : m.status === 'completed'
                          ? 'gray'
                          : 'amber'
                    }
                  >
                    {m.status === 'innings_break' ? 'live' : m.status}
                  </Badge>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-2">
          {timeline.length === 0 ? (
            <EmptyState title="No matches yet" />
          ) : (
            timeline.map((ev) => (
              <Link key={ev.matchId} to={`/match/${ev.matchId}`}>
                <Card className="flex items-center justify-between p-3.5 hover:border-brand-300">
                  <div>
                    <div className="text-xs text-ink-400 dark:text-ink-500">{formatDate(ev.date)}</div>
                    <div className="font-medium text-ink-900 dark:text-ink-50">
                      {ev.teamAName} vs {ev.teamBName}
                    </div>
                    {ev.summary && (
                      <div className="text-sm text-pitch-700">{ev.summary}</div>
                    )}
                  </div>
                  <Badge
                    tone={
                      ev.status === 'live' || ev.status === 'innings_break'
                        ? 'red'
                        : ev.status === 'completed'
                          ? 'gray'
                          : 'amber'
                    }
                  >
                    {ev.status === 'innings_break' ? 'live' : ev.status}
                  </Badge>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'leaders' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <LeaderCard
            title="Most runs"
            tone="green"
            rows={topRunScorers(stats, 10).map((r) => ({
              id: r.playerId,
              name: playerName(r.playerId),
              value: r.value,
            }))}
          />
          <LeaderCard
            title="Most wickets"
            tone="blue"
            rows={topWicketTakers(stats, 10).map((r) => ({
              id: r.playerId,
              name: playerName(r.playerId),
              value: r.value,
            }))}
          />
        </div>
      )}

      {tab === 'awards' && (
        <div>
          {awards.length === 0 ? (
            <EmptyState
              icon={<AwardIcon size={40} />}
              title="No awards yet"
              description="Awards are decided once matches are completed and scored."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {awards.map((a, i) => (
                <AwardCard
                  key={a.key}
                  featured={i === 0}
                  title={a.title}
                  value={a.value}
                  playerId={a.playerId}
                  name={playerName(a.playerId)}
                  sub={a.sub}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'records' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {records.highestTeamTotal && (
            <RecordCard
              icon={<TrendingUp size={18} />}
              tone="#16a34a"
              label="Highest team total"
              value={`${records.highestTeamTotal.runs}/${records.highestTeamTotal.wickets}`}
              sub={`${records.highestTeamTotal.teamShort} · ${ballsToOvers(
                records.highestTeamTotal.legalBalls,
              )} ov`}
              matchId={records.highestTeamTotal.matchId}
            />
          )}
          {records.lowestTeamTotal && (
            <RecordCard
              icon={<TrendingDown size={18} />}
              tone="#dc2626"
              label="Lowest team total (all out)"
              value={`${records.lowestTeamTotal.runs}/${records.lowestTeamTotal.wickets}`}
              sub={`${records.lowestTeamTotal.teamShort} · ${ballsToOvers(
                records.lowestTeamTotal.legalBalls,
              )} ov`}
              matchId={records.lowestTeamTotal.matchId}
            />
          )}
          {records.highestIndividualScore && (
            <RecordCard
              icon={<Star size={18} />}
              tone="#d97706"
              label="Highest individual score"
              value={`${records.highestIndividualScore.runs}${
                records.highestIndividualScore.out ? '' : '*'
              }`}
              sub={`${playerName(records.highestIndividualScore.playerId)} · ${
                records.highestIndividualScore.balls
              } balls`}
              matchId={records.highestIndividualScore.matchId}
            />
          )}
          {records.bestBowlingFigures && (
            <RecordCard
              icon={<Target size={18} />}
              tone="#dc2626"
              label="Best bowling figures"
              value={`${records.bestBowlingFigures.wickets}/${records.bestBowlingFigures.runs}`}
              sub={playerName(records.bestBowlingFigures.playerId)}
              matchId={records.bestBowlingFigures.matchId}
            />
          )}
          {records.mostSixesInnings && (
            <RecordCard
              icon={<Flame size={18} />}
              tone="#7c3aed"
              label="Most sixes in an innings"
              value={String(records.mostSixesInnings.count)}
              sub={playerName(records.mostSixesInnings.playerId)}
              matchId={records.mostSixesInnings.matchId}
            />
          )}
          {records.mostFoursInnings && (
            <RecordCard
              icon={<Hash size={18} />}
              tone="#2563eb"
              label="Most fours in an innings"
              value={String(records.mostFoursInnings.count)}
              sub={playerName(records.mostFoursInnings.playerId)}
              matchId={records.mostFoursInnings.matchId}
            />
          )}
          {records.biggestWinByRuns && (
            <RecordCard
              icon={<Swords size={18} />}
              tone="#16a34a"
              label="Biggest win (by runs)"
              value={`${records.biggestWinByRuns.margin} run${
                records.biggestWinByRuns.margin === 1 ? '' : 's'
              }`}
              sub={records.biggestWinByRuns.winnerName}
              matchId={records.biggestWinByRuns.matchId}
            />
          )}
          {records.biggestWinByWickets && (
            <RecordCard
              icon={<Swords size={18} />}
              tone="#16a34a"
              label="Biggest win (by wickets)"
              value={`${records.biggestWinByWickets.margin} wicket${
                records.biggestWinByWickets.margin === 1 ? '' : 's'
              }`}
              sub={records.biggestWinByWickets.winnerName}
              matchId={records.biggestWinByWickets.matchId}
            />
          )}
          {Object.keys(records).length === 0 && (
            <p className="text-sm text-ink-500 dark:text-ink-400 sm:col-span-2 lg:col-span-3">
              No completed matches yet — records will appear once matches finish.
            </p>
          )}
        </div>
      )}

      {tab === 'teams' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournamentTeams.map((t2) => (
            <Link key={t2.id} to={`/team/${t2.id}`}>
              <Card className="flex items-center gap-3 p-4 hover:border-brand-300">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white"
                  style={{ backgroundColor: t2.primaryColor }}
                >
                  {t2.shortName}
                </div>
                <span className="font-medium text-ink-900 dark:text-ink-50">{t2.name}</span>
              </Card>
            </Link>
          ))}
          {tournamentTeams.length === 0 && (
            <p className="text-sm text-ink-500 dark:text-ink-400">No teams added yet.</p>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <Card className="p-4">
          <ActivityFeed refId={id} max={15} />
        </Card>
      )}
    </div>
  )
}

function StandingsTable({
  rows,
  teamNameById,
}: {
  rows: StandingsRow[]
  teamNameById: Map<string, string>
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <th className="px-3 py-2.5 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">Team</th>
            <th className="px-2 py-2.5 text-right font-semibold">P</th>
            <th className="px-2 py-2.5 text-right font-semibold">W</th>
            <th className="px-2 py-2.5 text-right font-semibold">L</th>
            <th className="px-2 py-2.5 text-right font-semibold">T</th>
            <th className="px-2 py-2.5 text-right font-semibold">Pts</th>
            <th className="px-3 py-2.5 text-right font-semibold">NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className="border-b border-ink-50 dark:border-ink-800">
              <td className="px-3 py-2.5 text-ink-400 dark:text-ink-500">{i + 1}</td>
              <td className="px-3 py-2.5">
                <Link
                  to={`/team/${r.teamId}`}
                  className="font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                >
                  {teamNameById.get(r.teamId) ?? r.teamName}
                </Link>
              </td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.played}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.won}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.lost}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.tied}</td>
              <td className="px-2 py-2.5 text-right font-bold text-ink-900 dark:text-ink-50">{r.points}</td>
              <td className="px-3 py-2.5 text-right text-ink-600 dark:text-ink-400">{formatRate(r.nrr)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-ink-400 dark:text-ink-500">
                No teams in this tournament yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}

const QUAL_TONE: Record<QualificationRow['status'], 'green' | 'amber' | 'gray'> = {
  qualified: 'green',
  contention: 'amber',
  eliminated: 'gray',
}
const QUAL_LABEL: Record<QualificationRow['status'], string> = {
  qualified: 'Qualified',
  contention: 'In contention',
  eliminated: 'Eliminated',
}

function QualificationTable({
  rows,
  teamNameById,
}: {
  rows: QualificationRow[]
  teamNameById: Map<string, string>
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <th className="px-3 py-2.5 font-semibold">Team</th>
            <th className="px-2 py-2.5 text-right font-semibold">Pts</th>
            <th className="px-2 py-2.5 text-right font-semibold">Remaining</th>
            <th className="px-2 py-2.5 text-right font-semibold">Max pts</th>
            <th className="px-3 py-2.5 text-right font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId} className="border-b border-ink-50 dark:border-ink-800">
              <td className="px-3 py-2.5">
                <Link
                  to={`/team/${r.teamId}`}
                  className="font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                >
                  {teamNameById.get(r.teamId) ?? r.teamId}
                </Link>
              </td>
              <td className="px-2 py-2.5 text-right font-bold text-ink-900 dark:text-ink-50">{r.points}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.remainingGames}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.maxPossiblePoints}</td>
              <td className="px-3 py-2.5 text-right">
                <Badge tone={QUAL_TONE[r.status]}>{QUAL_LABEL[r.status]}</Badge>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-ink-400 dark:text-ink-500">
                No teams in this group yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}

function BracketTeamRow({
  name,
  isWinner,
  decided,
}: {
  name: string
  isWinner: boolean
  decided: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={
          decided && isWinner
            ? 'font-bold text-ink-900 dark:text-ink-50'
            : decided
              ? 'text-ink-400 dark:text-ink-500'
              : 'text-ink-800 dark:text-ink-200'
        }
      >
        {name}
      </span>
      {decided && isWinner && <Trophy size={13} className="text-amber-500" />}
    </div>
  )
}

function BracketMatch({ match }: { match: Match }) {
  const decided = match.status === 'completed' && !!match.result?.winnerTeamId
  const winnerId = match.result?.winnerTeamId ?? null
  return (
    <Link
      to={`/match/${match.id}`}
      className="block rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 text-sm hover:border-brand-300 hover:bg-brand-50/40"
    >
      <BracketTeamRow
        name={match.teamA.shortName}
        isWinner={winnerId === match.teamA.id}
        decided={decided}
      />
      <div className="my-1 h-px bg-ink-100 dark:bg-ink-800" />
      <BracketTeamRow
        name={match.teamB.shortName}
        isWinner={winnerId === match.teamB.id}
        decided={decided}
      />
      <div className="mt-2 truncate text-xs text-ink-500 dark:text-ink-400">
        {match.result?.summary ??
          (match.status === 'live' || match.status === 'innings_break'
            ? 'In progress'
            : formatDate(match.scheduledAt ?? match.createdAt))}
      </div>
    </Link>
  )
}

function RecordCard({
  icon,
  tone,
  label,
  value,
  sub,
  matchId,
}: {
  icon: React.ReactNode
  tone: string
  label: string
  value: string
  sub: string
  matchId: string
}) {
  return (
    <Link
      to={`/match/${matchId}`}
      className="flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tone}1a`, color: tone }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">{label}</div>
        <div className="truncate text-lg font-bold text-ink-900 dark:text-ink-50">{value}</div>
        <div className="truncate text-xs text-ink-500 dark:text-ink-400">{sub}</div>
      </div>
    </Link>
  )
}

function AwardCard({
  featured,
  title,
  value,
  playerId,
  name,
  sub,
}: {
  featured: boolean
  title: string
  value: string
  playerId: string
  name: string
  sub: string
}) {
  return (
    <Link
      to={`/player/${playerId}`}
      className={
        featured
          ? 'flex items-center gap-3 rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-4 hover:border-amber-400 sm:col-span-2 lg:col-span-3'
          : 'flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 hover:border-brand-300 hover:bg-brand-50/40'
      }
    >
      <span
        className={
          featured
            ? 'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white'
            : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600'
        }
      >
        <AwardIcon size={featured ? 24 : 18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-amber-600">
          {title}
        </div>
        <div
          className={
            featured
              ? 'truncate text-xl font-bold text-ink-900 dark:text-ink-50'
              : 'truncate text-base font-bold text-ink-900 dark:text-ink-50'
          }
        >
          {name}
        </div>
        <div className="truncate text-xs text-ink-500 dark:text-ink-400">{sub}</div>
      </div>
      <Badge tone="amber">{value}</Badge>
    </Link>
  )
}

function LeaderCard({
  title,
  tone,
  rows,
}: {
  title: string
  tone: 'green' | 'blue'
  rows: { id: string; name: string; value: number }[]
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 px-4 py-2.5 font-semibold text-ink-900 dark:text-ink-50">
        {title}
      </div>
      <div className="divide-y divide-ink-50">
        {rows.length === 0 && (
          <p className="px-4 py-4 text-center text-sm text-ink-400 dark:text-ink-500">
            No data yet.
          </p>
        )}
        {rows.map((r, i) => (
          <Link
            key={r.id}
            to={`/player/${r.id}`}
            className="flex items-center gap-3 px-4 py-2 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <span className="w-4 text-sm text-ink-400 dark:text-ink-500">{i + 1}</span>
            <Avatar name={r.name} size={26} />
            <span className="flex-1 text-sm text-ink-800 dark:text-ink-200">{r.name}</span>
            <Badge tone={tone}>{r.value}</Badge>
          </Link>
        ))}
      </div>
    </Card>
  )
}
