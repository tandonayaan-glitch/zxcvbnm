import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Badge,
  Card,
  EmptyState,
  LiveBadge,
  PageLoader,
} from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import { useAsync } from '@/hooks/useAsync'
import { listAllMatches } from '@/services/matches.service'
import { listTeams } from '@/services/teams.service'
import { listTournaments } from '@/services/tournaments.service'
import { formatDate } from '@/lib/format'
import type { Match } from '@/types'

type MatchFilter = 'all' | 'live' | 'upcoming' | 'completed'

const MATCH_FILTERS: { key: MatchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

function matchWhen(m: Match): number {
  return m.completedAt ?? m.scheduledAt ?? m.createdAt
}

export function PublicBrowsePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'matches'
  const matches = useAsync(listAllMatches, [])
  const teams = useAsync(listTeams, [])
  const tournaments = useAsync(listTournaments, [])
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all')

  const filteredMatches = useMemo(() => {
    const all = matches.data ?? []
    const isLive = (m: Match) =>
      m.status === 'live' || m.status === 'innings_break'
    const pass = (m: Match) =>
      matchFilter === 'all' ||
      (matchFilter === 'live' && isLive(m)) ||
      (matchFilter === 'upcoming' && m.status === 'setup') ||
      (matchFilter === 'completed' && m.status === 'completed')
    // Live first, then by most recent activity.
    return all
      .filter(pass)
      .sort(
        (a, b) =>
          Number(isLive(b)) - Number(isLive(a)) || matchWhen(b) - matchWhen(a),
      )
  }, [matches.data, matchFilter])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-ink-900">Browse</h1>
      <Tabs
        className="mb-4"
        active={tab}
        onChange={(k) => setParams({ tab: k })}
        tabs={[
          { key: 'matches', label: 'Matches' },
          { key: 'tournaments', label: 'Tournaments' },
          { key: 'teams', label: 'Teams' },
        ]}
      />

      {tab === 'matches' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {MATCH_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setMatchFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                matchFilter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-300 text-ink-600 hover:bg-ink-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'matches' &&
        (matches.loading ? (
          <PageLoader />
        ) : filteredMatches.length === 0 ? (
          <EmptyState
            title={
              (matches.data ?? []).length === 0
                ? 'No matches yet'
                : 'No matches match this filter'
            }
          />
        ) : (
          <div className="space-y-2">
            {filteredMatches.map((m) => {
              const live = m.status === 'live' || m.status === 'innings_break'
              return (
                <Link key={m.id} to={`/match/${m.id}`}>
                  <Card className="flex items-center justify-between p-3.5 hover:border-brand-300">
                    <div>
                      <div className="font-medium text-ink-900">
                        {m.teamA.name} vs {m.teamB.name}
                      </div>
                      <div className="text-sm text-ink-500">
                        {m.format} · {formatDate(m.scheduledAt ?? m.createdAt)}
                      </div>
                      {m.result && (
                        <div className="text-sm text-pitch-700">
                          {m.result.summary}
                        </div>
                      )}
                    </div>
                    {live ? (
                      <LiveBadge />
                    ) : (
                      <Badge tone={m.status === 'completed' ? 'gray' : 'amber'}>
                        {m.status}
                      </Badge>
                    )}
                  </Card>
                </Link>
              )
            })}
          </div>
        ))}

      {tab === 'tournaments' &&
        (tournaments.loading ? (
          <PageLoader />
        ) : (tournaments.data ?? []).length === 0 ? (
          <EmptyState title="No tournaments yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(tournaments.data ?? []).map((t) => (
              <Link key={t.id} to={`/tournament/${t.id}`}>
                <Card className="p-4 hover:border-brand-300">
                  <div className="font-semibold text-ink-900">{t.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-ink-500">
                    <Badge tone={t.status === 'ongoing' ? 'green' : 'gray'}>
                      {t.status}
                    </Badge>
                    <span>{t.teamIds.length} teams</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}

      {tab === 'teams' &&
        (teams.loading ? (
          <PageLoader />
        ) : (teams.data ?? []).length === 0 ? (
          <EmptyState title="No teams yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(teams.data ?? []).map((t) => (
              <Link key={t.id} to={`/team/${t.id}`}>
                <Card className="flex items-center gap-3 p-4 hover:border-brand-300">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white"
                    style={{ backgroundColor: t.primaryColor }}
                  >
                    {t.shortName}
                  </div>
                  <div>
                    <div className="font-medium text-ink-900">{t.name}</div>
                    <div className="text-xs text-ink-400">
                      {t.playerIds.length} players
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}
    </div>
  )
}
