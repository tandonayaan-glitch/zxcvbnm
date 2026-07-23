import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Shield,
  Crown,
  TrendingUp,
  Target,
  Trophy,
  Star,
  Swords,
  Rocket,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageLoader,
  StatCard,
} from '@/components/ui/primitives'
import { FollowButton } from '@/components/ui/FollowButton'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { useAsync } from '@/hooks/useAsync'
import { getTeam } from '@/services/teams.service'
import { getPlayersByIds, listPlayers } from '@/services/players.service'
import { getTeamStats } from '@/services/stats.service'
import { listAllMatches } from '@/services/matches.service'
import { listTournaments } from '@/services/tournaments.service'
import { listClubs } from '@/services/clubs.service'
import { aggregatePlayerStats } from '@/domain/stats'
import { teamResults, teamRecord, type FormOutcome } from '@/domain/teamForm'
import { TeamForm, type TeamFormPoint } from '@/components/charts/TeamForm'
import { computeTeamHonours, hasTeamRecords } from '@/domain/teamRecords'
import { teamOpponentRecords } from '@/domain/teamOpponents'
import { teamVenueRecords } from '@/domain/teamVenues'
import { PLAYER_ROLE_LABELS, formatDate, ballsToOvers } from '@/lib/format'

export function TeamPage() {
  const { id = '' } = useParams()
  const team = useAsync(() => getTeam(id), [id])
  const squad = useAsync(
    () => (team.data ? getPlayersByIds(team.data.playerIds) : Promise.resolve([])),
    [team.data],
  )
  const stats = useAsync(() => getTeamStats(id), [id])
  const matches = useAsync(listAllMatches, [])
  const allPlayers = useAsync(listPlayers, [])
  const tournaments = useAsync(listTournaments, [])
  const clubs = useAsync(listClubs, [])

  // Analytics recomputation is non-trivial (iterates every match/innings), so
  // it's memoised on the underlying data rather than recomputed every render.
  // Hooks must run unconditionally before the loading/not-found early
  // returns below (Rules of Hooks) — each guards internally for missing data.
  const teamMatches = useMemo(
    () => (matches.data ?? []).filter((m) => m.teamA.id === id || m.teamB.id === id),
    [matches.data, id],
  )
  const results = useMemo(
    () => teamResults(matches.data ?? [], id),
    [matches.data, id],
  )
  const record = useMemo(() => teamRecord(results), [results])

  // Runs scored per recent match, for the form chart (oldest → newest).
  const formSeries: TeamFormPoint[] = useMemo(
    () =>
      results
        .slice(0, 10)
        .reverse()
        .map((r) => {
          const m = teamMatches.find((x) => x.id === r.matchId)
          const inn = m?.innings.find((iv) => iv.battingTeamId === id)
          return {
            matchId: r.matchId,
            runs: inn?.totalRuns ?? 0,
            outcome: r.outcome,
            opponentShort: r.opponentShort,
          }
        }),
    [results, teamMatches, id],
  )

  // Top performers among this squad, across the team's completed matches.
  const playerName = useMemo(
    () => new Map((squad.data ?? []).map((p) => [p.id, p.displayName])),
    [squad.data],
  )
  const { topRuns, topWkts } = useMemo(() => {
    const squadIds = new Set((squad.data ?? []).map((p) => p.id))
    const squadStats = [
      ...aggregatePlayerStats(
        teamMatches.filter((m) => m.status === 'completed'),
      ).values(),
    ].filter((st) => squadIds.has(st.playerId))
    return {
      topRuns: [...squadStats].sort((a, b) => b.runs - a.runs).find((st) => st.runs > 0),
      topWkts: [...squadStats]
        .sort((a, b) => b.wickets - a.wickets)
        .find((st) => st.wickets > 0),
    }
  }, [squad.data, teamMatches])

  // Honours & records — resolve record-holder names across all players, not
  // just the current squad (a record may belong to a player who has left).
  const honours = useMemo(
    () => computeTeamHonours(id, matches.data ?? []),
    [id, matches.data],
  )
  const opponentRecords = useMemo(
    () => teamOpponentRecords(id, matches.data ?? []),
    [id, matches.data],
  )
  const venueRecords = useMemo(
    () => teamVenueRecords(id, matches.data ?? []),
    [id, matches.data],
  )
  const nameOf = (pid: string) =>
    (allPlayers.data ?? []).find((p) => p.id === pid)?.displayName ?? '—'
  // Prefer the live tournament name for titles; fall back to the name
  // denormalised on the match (covers legacy/seed matches without one).
  const tournamentNameById = useMemo(
    () => new Map((tournaments.data ?? []).map((tn) => [tn.id, tn.name])),
    [tournaments.data],
  )

  if (team.loading) return <PageLoader />
  if (!team.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<Shield size={40} />} title="Team not found" />
      </div>
    )

  const t = team.data
  const s = stats.data
  const clubName = (clubs.data ?? []).find((c) => c.id === t.clubId)?.name

  const titleName = (tt: (typeof honours.titles)[number]) =>
    (tt.tournamentId && tournamentNameById.get(tt.tournamentId)) ||
    tt.tournamentName

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Card className="mb-4 overflow-hidden">
        <div
          className="flex items-center gap-4 p-5"
          style={{
            background: `linear-gradient(135deg, ${t.primaryColor}, ${t.secondaryColor})`,
          }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 text-2xl font-extrabold text-white backdrop-blur">
            {t.shortName}
          </div>
          <div className="text-white">
            <h1 className="text-2xl font-bold">{t.name}</h1>
            <p className="text-white/80">
              {t.playerIds.length} players
              {clubName && t.clubId && (
                <>
                  {' · '}
                  <Link to={`/club/${t.clubId}`} className="underline hover:text-white">
                    {clubName}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="ml-auto">
            <FollowButton kind="teams" id={t.id} />
          </div>
        </div>
      </Card>

      {s && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Played" value={s.matches} tone="blue" />
          <StatCard label="Won" value={s.won} tone="green" />
          <StatCard label="Lost" value={s.lost} tone="red" />
          <StatCard label="Runs scored" value={s.runsScored} tone="amber" />
        </div>
      )}

      {results.length > 0 && (
        <Card className="mb-4">
          <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
                Win rate
              </div>
              <div className="text-2xl font-extrabold text-ink-900 dark:text-ink-50">
                {record.winPct}%
              </div>
              <div className="text-xs text-ink-500 dark:text-ink-400">
                {record.won}W · {record.lost}L
                {record.tied > 0 && ` · ${record.tied}T`}
                {record.noResult > 0 && ` · ${record.noResult}NR`}
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1.5 text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
                Recent form
              </div>
              <div className="flex flex-wrap gap-1.5">
                {results.slice(0, 8).map((r) => (
                  <Link
                    key={r.matchId}
                    to={`/match/${r.matchId}`}
                    title={`vs ${r.opponentShort} — ${r.summary}`}
                  >
                    <FormChip outcome={r.outcome} />
                  </Link>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {formSeries.length > 0 && (
        <div className="mb-4">
          <TeamForm data={formSeries} />
        </div>
      )}

      {(topRuns || topWkts) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {topRuns && (
            <PerformerCard
              icon={<TrendingUp size={18} />}
              tone="#16a34a"
              label="Top run-scorer"
              playerId={topRuns.playerId}
              name={playerName.get(topRuns.playerId) ?? '—'}
              line={`${topRuns.runs} run${topRuns.runs === 1 ? '' : 's'} · ${topRuns.inningsBatted} inn`}
            />
          )}
          {topWkts && (
            <PerformerCard
              icon={<Target size={18} />}
              tone="#dc2626"
              label="Top wicket-taker"
              playerId={topWkts.playerId}
              name={playerName.get(topWkts.playerId) ?? '—'}
              line={`${topWkts.wickets} wkt${topWkts.wickets === 1 ? '' : 's'} · ${topWkts.inningsBowled} inn`}
            />
          )}
        </div>
      )}

      {honours.titles.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title={`Honours · ${honours.titles.length} title${
              honours.titles.length === 1 ? '' : 's'
            }`}
          />
          <CardBody className="space-y-2">
            {honours.titles.map((tt) => (
              <Link
                key={tt.matchId}
                to={`/match/${tt.matchId}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-amber-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <Trophy size={16} />
                </span>
                <div className="flex-1">
                  <div className="font-medium text-ink-900 dark:text-ink-50">
                    {titleName(tt)} — Champions
                  </div>
                  <div className="text-xs text-ink-400 dark:text-ink-500">
                    beat {tt.opponentShort} in the final · {formatDate(tt.date)}
                  </div>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {hasTeamRecords(honours) && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Team records
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {honours.highestTotal && (
              <TeamRecordCard
                icon={<TrendingUp size={18} />}
                tone="#16a34a"
                label="Highest total"
                value={`${honours.highestTotal.runs}/${honours.highestTotal.wickets}`}
                sub={`vs ${honours.highestTotal.opponentShort} · ${ballsToOvers(
                  honours.highestTotal.legalBalls,
                )} ov`}
                matchId={honours.highestTotal.matchId}
              />
            )}
            {honours.highestChase && (
              <TeamRecordCard
                icon={<Rocket size={18} />}
                tone="#0ea5e9"
                label="Highest chase"
                value={`${honours.highestChase.runs}/${honours.highestChase.wickets}`}
                sub={`chased down vs ${honours.highestChase.opponentShort}`}
                matchId={honours.highestChase.matchId}
              />
            )}
            {honours.biggestWinByRuns && (
              <TeamRecordCard
                icon={<Swords size={18} />}
                tone="#16a34a"
                label="Biggest win (runs)"
                value={`${honours.biggestWinByRuns.margin} run${
                  honours.biggestWinByRuns.margin === 1 ? '' : 's'
                }`}
                sub={`vs ${honours.biggestWinByRuns.opponentShort}`}
                matchId={honours.biggestWinByRuns.matchId}
              />
            )}
            {honours.biggestWinByWickets && (
              <TeamRecordCard
                icon={<Swords size={18} />}
                tone="#16a34a"
                label="Biggest win (wickets)"
                value={`${honours.biggestWinByWickets.margin} wkt${
                  honours.biggestWinByWickets.margin === 1 ? '' : 's'
                }`}
                sub={`vs ${honours.biggestWinByWickets.opponentShort}`}
                matchId={honours.biggestWinByWickets.matchId}
              />
            )}
            {honours.highestIndividualScore && (
              <TeamRecordCard
                icon={<Star size={18} />}
                tone="#d97706"
                label="Highest individual score"
                value={`${honours.highestIndividualScore.runs}${
                  honours.highestIndividualScore.out ? '' : '*'
                }`}
                sub={`${nameOf(honours.highestIndividualScore.playerId)} · ${
                  honours.highestIndividualScore.balls
                } balls`}
                matchId={honours.highestIndividualScore.matchId}
              />
            )}
            {honours.bestBowling && (
              <TeamRecordCard
                icon={<Target size={18} />}
                tone="#dc2626"
                label="Best bowling"
                value={`${honours.bestBowling.wickets}/${honours.bestBowling.runs}`}
                sub={nameOf(honours.bestBowling.playerId)}
                matchId={honours.bestBowling.matchId}
              />
            )}
          </div>
        </div>
      )}

      {opponentRecords.length > 0 && (
        <Card className="mb-4 overflow-x-auto">
          <CardHeader title="Record vs opponents" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                <th className="px-4 py-2.5 font-semibold">Opponent</th>
                <th className="px-2 py-2.5 text-right font-semibold">P</th>
                <th className="px-2 py-2.5 text-right font-semibold">W</th>
                <th className="px-2 py-2.5 text-right font-semibold">L</th>
                <th className="px-2 py-2.5 text-right font-semibold">T</th>
                <th className="px-4 py-2.5 text-right font-semibold">Win %</th>
              </tr>
            </thead>
            <tbody>
              {opponentRecords.map((o) => {
                const decided = o.won + o.lost + o.tied
                const winPct = decided > 0 ? Math.round((o.won / decided) * 100) : 0
                return (
                  <tr key={o.opponentId} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/team/${o.opponentId}`}
                        className="font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                      >
                        {o.opponentName}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{o.played}</td>
                    <td className="px-2 py-2.5 text-right text-pitch-700">{o.won}</td>
                    <td className="px-2 py-2.5 text-right text-red-600">{o.lost}</td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {o.tied + o.noResult}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {winPct}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {venueRecords.length > 0 && (
        <Card className="mb-4 overflow-x-auto">
          <CardHeader title="Record by venue" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                <th className="px-4 py-2.5 font-semibold">Venue</th>
                <th className="px-2 py-2.5 text-right font-semibold">P</th>
                <th className="px-2 py-2.5 text-right font-semibold">W</th>
                <th className="px-2 py-2.5 text-right font-semibold">L</th>
                <th className="px-4 py-2.5 text-right font-semibold">Win %</th>
              </tr>
            </thead>
            <tbody>
              {venueRecords.map((v) => {
                const decided = v.won + v.lost + v.tied
                const winPct = decided > 0 ? Math.round((v.won / decided) * 100) : 0
                return (
                  <tr key={v.venue} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ink-50">
                      {v.venue}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{v.played}</td>
                    <td className="px-2 py-2.5 text-right text-pitch-700">{v.won}</td>
                    <td className="px-2 py-2.5 text-right text-red-600">{v.lost}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {winPct}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Squad" />
          <CardBody className="space-y-1">
            {squad.loading ? (
              <PageLoader />
            ) : (squad.data ?? []).length === 0 ? (
              <p className="py-3 text-center text-sm text-ink-500 dark:text-ink-400">
                No players in this squad.
              </p>
            ) : (
              (squad.data ?? []).map((p) => (
                <Link
                  key={p.id}
                  to={`/player/${p.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <Avatar name={p.fullName} src={p.photoURL} size={32} />
                  <div className="flex-1">
                    <div className="font-medium text-ink-900 dark:text-ink-50">{p.fullName}</div>
                    <div className="text-xs text-ink-400 dark:text-ink-500">
                      {PLAYER_ROLE_LABELS[p.role]}
                    </div>
                  </div>
                  {p.id === t.captainId && (
                    <Badge tone="amber">
                      <Crown size={12} /> C
                    </Badge>
                  )}
                  {p.id === t.viceCaptainId && <Badge tone="gray">VC</Badge>}
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent matches" />
          <CardBody className="space-y-2">
            {teamMatches.length === 0 ? (
              <p className="py-3 text-center text-sm text-ink-500 dark:text-ink-400">
                No matches yet.
              </p>
            ) : (
              teamMatches.slice(0, 8).map((m) => (
                <Link
                  key={m.id}
                  to={`/match/${m.id}`}
                  className="block rounded-lg px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-900 dark:text-ink-50">
                      {m.teamA.shortName} vs {m.teamB.shortName}
                    </span>
                    <span className="text-xs text-ink-400 dark:text-ink-500">
                      {formatDate(m.completedAt ?? m.scheduledAt ?? m.createdAt)}
                    </span>
                  </div>
                  {m.result && (
                    <div className="text-sm text-pitch-700">
                      {m.result.summary}
                    </div>
                  )}
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Activity" />
        <CardBody>
          <ActivityFeed refId={id} max={10} />
        </CardBody>
      </Card>
    </div>
  )
}

// Uses the `pitch`/`red` theme tokens (not inline hex) so the colour-blind
// palette's `.colorblind` override (pitch -> teal) applies to the win chip
// automatically, the same way it does everywhere else pitch-* is used.
const FORM_TONE: Record<FormOutcome, { bg: string; label: string }> = {
  W: { bg: 'bg-pitch-600', label: 'W' },
  L: { bg: 'bg-red-600', label: 'L' },
  T: { bg: 'bg-amber-600', label: 'T' },
  N: { bg: 'bg-ink-400', label: 'N' },
}

function FormChip({ outcome }: { outcome: FormOutcome }) {
  const c = FORM_TONE[outcome]
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${c.bg}`}
    >
      {c.label}
    </span>
  )
}

function TeamRecordCard({
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

function PerformerCard({
  icon,
  tone,
  label,
  playerId,
  name,
  line,
}: {
  icon: React.ReactNode
  tone: string
  label: string
  playerId: string
  name: string
  line: string
}) {
  return (
    <Link
      to={`/player/${playerId}`}
      className="flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tone}1a`, color: tone }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
          {label}
        </div>
        <div className="truncate font-semibold text-ink-900 dark:text-ink-50">{name}</div>
        <div className="text-xs text-ink-500 dark:text-ink-400">{line}</div>
      </div>
    </Link>
  )
}
