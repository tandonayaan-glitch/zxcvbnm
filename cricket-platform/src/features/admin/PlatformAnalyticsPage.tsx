import { useMemo } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardBody, PageLoader, StatCard } from '@/components/ui/primitives'
import { GrowthChart } from '@/components/charts/GrowthChart'
import { useAsync } from '@/hooks/useAsync'
import { listUsers } from '@/services/users.service'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listClubs } from '@/services/clubs.service'
import { listTournaments } from '@/services/tournaments.service'
import { listAllMatches } from '@/services/matches.service'
import {
  signupsPerDay,
  matchesPerDay,
  createdSince,
  activeClubIds,
  activeScorerIds,
} from '@/domain/platformAnalytics'

const DAY_MS = 24 * 60 * 60 * 1000

export function PlatformAnalyticsPage() {
  const users = useAsync(listUsers, [])
  const players = useAsync(listPlayers, [])
  const teams = useAsync(listTeams, [])
  const clubs = useAsync(listClubs, [])
  const tournaments = useAsync(listTournaments, [])
  const matches = useAsync(listAllMatches, [])

  const loading =
    users.loading || players.loading || teams.loading || clubs.loading || tournaments.loading || matches.loading

  const signups = useMemo(() => signupsPerDay(users.data ?? [], 30), [users.data])
  const matchesDaily = useMemo(() => matchesPerDay(matches.data ?? [], 30), [matches.data])

  const since30d = Date.now() - 30 * DAY_MS
  const activeClubs = useMemo(
    () => activeClubIds(clubs.data ?? [], teams.data ?? [], matches.data ?? [], since30d),
    [clubs.data, teams.data, matches.data, since30d],
  )
  const activeScorers = useMemo(
    () => activeScorerIds(matches.data ?? [], since30d),
    [matches.data, since30d],
  )

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Platform analytics"
        subtitle="Growth and activity beyond cricket statistics — derived from existing records, not a separate tracking system."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total users" value={(users.data ?? []).length} tone="blue" />
        <StatCard label="Total players" value={(players.data ?? []).length} tone="green" />
        <StatCard label="Total teams" value={(teams.data ?? []).length} tone="amber" />
        <StatCard label="Total matches" value={(matches.data ?? []).length} tone="purple" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="New users (30d)" value={createdSince(users.data ?? [], since30d)} tone="blue" />
        <StatCard label="New players (30d)" value={createdSince(players.data ?? [], since30d)} tone="green" />
        <StatCard label="Matches (30d)" value={createdSince(matches.data ?? [], since30d)} tone="purple" />
        <StatCard label="New tournaments (30d)" value={createdSince(tournaments.data ?? [], since30d)} tone="amber" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Active clubs (30d)" value={activeClubs.size} tone="green" />
        <StatCard label="Active scorers (30d)" value={activeScorers.size} tone="blue" />
      </div>

      <div className="space-y-4">
        <GrowthChart title="New user signups — last 30 days" data={signups} />
        <GrowthChart title="Matches created — last 30 days" data={matchesDaily} />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="What this doesn't measure"
          subtitle="Read before drawing conclusions from the numbers above."
        />
        <CardBody className="text-sm text-ink-600 dark:text-ink-400">
          <p>
            There's no session/login log in this client-only app, so true Daily/Monthly Active
            Users (unique people who opened the app) aren't tracked — the figures above are
            derived entirely from existing timestamped records (accounts, players, teams,
            tournaments, matches), not from a separate analytics/tracking pipeline. "Active club"
            means a club with a team that played a match in the window; "active scorer" means a
            distinct scorer credited on a match in the window — both real proxies from real data,
            not logins.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
