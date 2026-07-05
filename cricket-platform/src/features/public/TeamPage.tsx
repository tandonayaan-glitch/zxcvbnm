import { useParams, Link } from 'react-router-dom'
import { Shield, Crown, TrendingUp, Target } from 'lucide-react'
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
import { useAsync } from '@/hooks/useAsync'
import { getTeam } from '@/services/teams.service'
import { getPlayersByIds } from '@/services/players.service'
import { getTeamStats } from '@/services/stats.service'
import { listAllMatches } from '@/services/matches.service'
import { aggregatePlayerStats } from '@/domain/stats'
import { teamResults, teamRecord, type FormOutcome } from '@/domain/teamForm'
import { PLAYER_ROLE_LABELS, formatDate } from '@/lib/format'

export function TeamPage() {
  const { id = '' } = useParams()
  const team = useAsync(() => getTeam(id), [id])
  const squad = useAsync(
    () => (team.data ? getPlayersByIds(team.data.playerIds) : Promise.resolve([])),
    [team.data],
  )
  const stats = useAsync(() => getTeamStats(id), [id])
  const matches = useAsync(listAllMatches, [])

  if (team.loading) return <PageLoader />
  if (!team.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<Shield size={40} />} title="Team not found" />
      </div>
    )

  const t = team.data
  const teamMatches = (matches.data ?? []).filter(
    (m) => m.teamA.id === id || m.teamB.id === id,
  )
  const s = stats.data

  const results = teamResults(matches.data ?? [], id)
  const record = teamRecord(results)

  // Top performers among this squad, across the team's completed matches.
  const squadIds = new Set((squad.data ?? []).map((p) => p.id))
  const playerName = new Map(
    (squad.data ?? []).map((p) => [p.id, p.displayName]),
  )
  const squadStats = [
    ...aggregatePlayerStats(
      teamMatches.filter((m) => m.status === 'completed'),
    ).values(),
  ].filter((st) => squadIds.has(st.playerId))
  const topRuns = [...squadStats]
    .sort((a, b) => b.runs - a.runs)
    .find((st) => st.runs > 0)
  const topWkts = [...squadStats]
    .sort((a, b) => b.wickets - a.wickets)
    .find((st) => st.wickets > 0)

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
            <p className="text-white/80">{t.playerIds.length} players</p>
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
              <div className="text-xs uppercase tracking-wide text-ink-400">
                Win rate
              </div>
              <div className="text-2xl font-extrabold text-ink-900">
                {record.winPct}%
              </div>
              <div className="text-xs text-ink-500">
                {record.won}W · {record.lost}L
                {record.tied > 0 && ` · ${record.tied}T`}
                {record.noResult > 0 && ` · ${record.noResult}NR`}
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1.5 text-xs uppercase tracking-wide text-ink-400">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Squad" />
          <CardBody className="space-y-1">
            {squad.loading ? (
              <PageLoader />
            ) : (squad.data ?? []).length === 0 ? (
              <p className="py-3 text-center text-sm text-ink-500">
                No players in this squad.
              </p>
            ) : (
              (squad.data ?? []).map((p) => (
                <Link
                  key={p.id}
                  to={`/player/${p.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                >
                  <Avatar name={p.fullName} src={p.photoURL} size={32} />
                  <div className="flex-1">
                    <div className="font-medium text-ink-900">{p.fullName}</div>
                    <div className="text-xs text-ink-400">
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
              <p className="py-3 text-center text-sm text-ink-500">
                No matches yet.
              </p>
            ) : (
              teamMatches.slice(0, 8).map((m) => (
                <Link
                  key={m.id}
                  to={`/match/${m.id}`}
                  className="block rounded-lg px-2 py-2 hover:bg-ink-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-900">
                      {m.teamA.shortName} vs {m.teamB.shortName}
                    </span>
                    <span className="text-xs text-ink-400">
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
    </div>
  )
}

const FORM_TONE: Record<FormOutcome, { bg: string; label: string }> = {
  W: { bg: '#16a34a', label: 'W' },
  L: { bg: '#dc2626', label: 'L' },
  T: { bg: '#d97706', label: 'T' },
  N: { bg: '#94a3b8', label: 'N' },
}

function FormChip({ outcome }: { outcome: FormOutcome }) {
  const c = FORM_TONE[outcome]
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: c.bg }}
    >
      {c.label}
    </span>
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
      className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-4 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tone}1a`, color: tone }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-ink-400">
          {label}
        </div>
        <div className="truncate font-semibold text-ink-900">{name}</div>
        <div className="text-xs text-ink-500">{line}</div>
      </div>
    </Link>
  )
}
