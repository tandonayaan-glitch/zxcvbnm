import { useParams, Link } from 'react-router-dom'
import { Building2, Trophy, CalendarRange, Shield, Activity } from 'lucide-react'
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { useAsync } from '@/hooks/useAsync'
import { getClub } from '@/services/clubs.service'
import { listTeams } from '@/services/teams.service'
import { listTournaments } from '@/services/tournaments.service'
import { listSeasons } from '@/services/seasons.service'
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

export function ClubPage() {
  const { id = '' } = useParams()
  const club = useAsync(() => getClub(id), [id])
  const teams = useAsync(listTeams, [])
  const tournaments = useAsync(listTournaments, [])
  const seasons = useAsync(listSeasons, [])

  if (club.loading) return <PageLoader />
  if (!club.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<Building2 size={40} />} title="Club not found" />
      </div>
    )

  const c = club.data
  const clubTeams = (teams.data ?? []).filter((t) => t.clubId === id)
  const clubTournaments = (tournaments.data ?? []).filter((t) => t.clubId === id)
  const clubSeasons = (seasons.data ?? []).filter((s) => s.clubId === id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Card className="mb-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} src={c.logoURL} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">{c.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
              {c.shortName && <span>{c.shortName}</span>}
              {c.homeVenue && <span>· {c.homeVenue}</span>}
            </div>
          </div>
        </div>
        {c.description && (
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">{c.description}</p>
        )}
      </Card>

      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-200">
        <Shield size={16} /> Teams ({clubTeams.length})
      </div>
      {clubTeams.length === 0 ? (
        <p className="mb-6 text-sm text-ink-500 dark:text-ink-400">No teams assigned to this club yet.</p>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubTeams.map((t) => (
            <Link key={t.id} to={`/team/${t.id}`}>
              <Card className="flex items-center gap-3 p-4 hover:border-brand-300">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white"
                  style={{ backgroundColor: t.primaryColor }}
                >
                  {t.shortName}
                </div>
                <span className="font-medium text-ink-900 dark:text-ink-50">{t.name}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-200">
        <CalendarRange size={16} /> Seasons ({clubSeasons.length})
      </div>
      {clubSeasons.length === 0 ? (
        <p className="mb-6 text-sm text-ink-500 dark:text-ink-400">No seasons for this club yet.</p>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubSeasons.map((s) => (
            <Link key={s.id} to={`/season/${s.id}`}>
              <Card className="flex items-center justify-between p-4 hover:border-brand-300">
                <span className="font-medium text-ink-900 dark:text-ink-50">{s.name}</span>
                <Badge tone={SEASON_TONE[s.status]}>{s.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-200">
        <Trophy size={16} /> Tournaments ({clubTournaments.length})
      </div>
      {clubTournaments.length === 0 ? (
        <p className="text-sm text-ink-500 dark:text-ink-400">No tournaments for this club yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubTournaments.map((t) => (
            <Link key={t.id} to={`/tournament/${t.id}`}>
              <Card className="p-4 hover:border-brand-300">
                <div className="flex items-start justify-between">
                  <span className="font-medium text-ink-900 dark:text-ink-50">{t.name}</span>
                  <Badge tone={TOURNAMENT_TONE[t.status]}>{t.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                  {formatDate(t.startDate)} – {formatDate(t.endDate)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-200">
        <Activity size={16} /> Activity
      </div>
      <Card className="p-4">
        <ActivityFeed refId={id} max={10} />
      </Card>
    </div>
  )
}
