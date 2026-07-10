import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CalendarRange, Trophy, Award } from 'lucide-react'
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { getSeason } from '@/services/seasons.service'
import { getClub } from '@/services/clubs.service'
import { listTournaments } from '@/services/tournaments.service'
import { listAllMatches } from '@/services/matches.service'
import { listPlayers } from '@/services/players.service'
import { aggregatePlayerStats, topRunScorers, topWicketTakers } from '@/domain/stats'
import { formatDate } from '@/lib/format'
import type { SeasonStatus, TournamentStatus } from '@/types'

const SEASON_TONE: Record<SeasonStatus, 'green' | 'amber' | 'gray'> = {
  ongoing: 'green',
  upcoming: 'amber',
  completed: 'gray',
}
const TOURNAMENT_TONE: Record<TournamentStatus, 'green' | 'amber' | 'gray'> = {
  ongoing: 'green',
  upcoming: 'amber',
  completed: 'gray',
}

export function SeasonPage() {
  const { id = '' } = useParams()
  const season = useAsync(() => getSeason(id), [id])
  const tournaments = useAsync(listTournaments, [])
  const matches = useAsync(listAllMatches, [])
  const players = useAsync(listPlayers, [])

  const seasonTournaments = useMemo(
    () => (tournaments.data ?? []).filter((t) => t.seasonId === id),
    [tournaments.data, id],
  )
  const seasonTournamentIds = useMemo(
    () => new Set(seasonTournaments.map((t) => t.id)),
    [seasonTournaments],
  )
  const seasonMatches = useMemo(
    () =>
      (matches.data ?? []).filter(
        (m) => m.tournamentId && seasonTournamentIds.has(m.tournamentId),
      ),
    [matches.data, seasonTournamentIds],
  )
  const stats = useMemo(() => aggregatePlayerStats(seasonMatches), [seasonMatches])
  const club = useAsync(
    () => (season.data?.clubId ? getClub(season.data.clubId) : Promise.resolve(null)),
    [season.data?.clubId],
  )
  const playerName = (pid: string) =>
    (players.data ?? []).find((p) => p.id === pid)?.displayName ?? 'Unknown'

  if (season.loading) return <PageLoader />
  if (!season.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<CalendarRange size={40} />} title="Season not found" />
      </div>
    )

  const s = season.data
  const topRuns = topRunScorers(stats, 5)
  const topWickets = topWicketTakers(stats, 5)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Card className="mb-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <CalendarRange size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-ink-900">{s.name}</h1>
              <div className="mt-0.5 flex items-center gap-2 text-sm text-ink-500">
                <Badge tone={SEASON_TONE[s.status]}>{s.status}</Badge>
                <span>
                  {formatDate(s.startDate)} – {formatDate(s.endDate)}
                </span>
                {club.data && (
                  <Link to={`/club/${club.data.id}`} className="hover:text-brand-700">
                    · {club.data.name}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
        {s.description && (
          <p className="mt-3 text-sm text-ink-600">{s.description}</p>
        )}
      </Card>

      {(topRuns.length > 0 || topWickets.length > 0) && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <Award size={16} /> Hall of fame
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <LeaderCard title="Most runs" tone="green" rows={topRuns} playerName={playerName} />
            <LeaderCard
              title="Most wickets"
              tone="blue"
              rows={topWickets}
              playerName={playerName}
            />
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Trophy size={16} /> Tournaments ({seasonTournaments.length})
      </div>
      {seasonTournaments.length === 0 ? (
        <p className="text-sm text-ink-500">No tournaments in this season yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seasonTournaments.map((t) => (
            <Link key={t.id} to={`/tournament/${t.id}`}>
              <Card className="p-4 hover:border-brand-300">
                <div className="flex items-start justify-between">
                  <span className="font-medium text-ink-900">{t.name}</span>
                  <Badge tone={TOURNAMENT_TONE[t.status]}>{t.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-ink-500">
                  {formatDate(t.startDate)} – {formatDate(t.endDate)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderCard({
  title,
  tone,
  rows,
  playerName,
}: {
  title: string
  tone: 'green' | 'blue'
  rows: { playerId: string; value: number }[]
  playerName: (id: string) => string
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2.5 font-semibold text-ink-900">
        {title}
      </div>
      <div className="divide-y divide-ink-50">
        {rows.length === 0 && (
          <p className="px-4 py-4 text-center text-sm text-ink-400">No data yet.</p>
        )}
        {rows.map((r, i) => (
          <Link
            key={r.playerId}
            to={`/player/${r.playerId}`}
            className="flex items-center gap-3 px-4 py-2 hover:bg-ink-50"
          >
            <span className="w-4 text-sm text-ink-400">{i + 1}</span>
            <Avatar name={playerName(r.playerId)} size={26} />
            <span className="flex-1 text-sm text-ink-800">{playerName(r.playerId)}</span>
            <Badge tone={tone}>{r.value}</Badge>
          </Link>
        ))}
      </div>
    </Card>
  )
}
