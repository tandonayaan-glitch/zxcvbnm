import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Shield,
  Trophy,
  Swords,
  Plus,
  Radio,
  TrendingUp,
  Activity,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  LayoutGrid,
  RotateCcw,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  LiveBadge,
  PageLoader,
  StatCard,
} from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { listAllMatches } from '@/services/matches.service'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listTournaments } from '@/services/tournaments.service'
import { aggregatePlayerStats, topRunScorers, topWicketTakers } from '@/domain/stats'
import { useAuthStore, canScore, ownerScope } from '@/store/authStore'
import { ballsToOvers, formatDate } from '@/lib/format'
import {
  useDashboardLayoutStore,
  type DashboardColumn,
  type DashboardWidget,
} from '@/store/dashboardLayoutStore'
import { cn } from '@/lib/cn'

const WIDGET_LABELS: Record<DashboardWidget, string> = {
  live: 'Live matches',
  recent: 'Recent results',
  activity: 'Recent activity',
  upcoming: 'Upcoming',
  topRuns: 'Top run scorers',
  topWickets: 'Top wicket takers',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const matches = useAsync(listAllMatches, [])
  const players = useAsync(listPlayers, [])
  const teams = useAsync(listTeams, [])
  const tournaments = useAsync(listTournaments, [])
  const { layout, moveWidget, toggleHidden, reset } = useDashboardLayoutStore()
  const [customizing, setCustomizing] = useState(false)

  const loading =
    matches.loading || players.loading || teams.loading || tournaments.loading

  // Owner-scope every dataset: master admin sees all; a normal admin sees only
  // the players, teams, tournaments and matches they own.
  const scopedPlayers = (players.data ?? []).filter((p) => !scope || p.ownerId === scope)
  const scopedTeams = (teams.data ?? []).filter((t) => !scope || t.ownerId === scope)
  const scopedTournaments = (tournaments.data ?? []).filter(
    (t) => !scope || t.ownerId === scope,
  )

  const playerName = useMemo(() => {
    const map = new Map((players.data ?? []).map((p) => [p.id, p]))
    return (id: string) => map.get(id)
  }, [players.data])

  const all = (matches.data ?? []).filter((m) => !scope || m.ownerId === scope)
  const live = all.filter(
    (m) => m.status === 'live' || m.status === 'innings_break',
  )
  const upcoming = all
    .filter((m) => m.status === 'setup')
    .sort((a, b) => (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt))
    .slice(0, 5)
  const recent = all.filter((m) => m.status === 'completed').slice(0, 5)

  const stats = useMemo(() => aggregatePlayerStats(all), [all])
  const topBat = topRunScorers(stats, 5)
  const topBowl = topWicketTakers(stats, 5)

  if (loading) return <PageLoader />

  const widgets: Record<DashboardWidget, ReactNode> = {
    live: (
      <Card className="border-red-200">
        <CardHeader
          className="bg-red-50"
          title={
            <span className="flex items-center gap-2 text-red-700">
              <Radio size={18} className="text-red-500" /> Live matches
            </span>
          }
          subtitle={`${live.length} in progress`}
        />
        <CardBody className="space-y-3">
          {live.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
              No live matches right now.
            </p>
          ) : (
            live.map((m) => (
              <Link
                key={m.id}
                to={canScore(profile) ? `/scoring/${m.id}` : `/match/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-ink-200 dark:border-ink-800 p-3 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div>
                  <div className="mb-1">
                    <LiveBadge />
                  </div>
                  <div className="font-semibold text-ink-900 dark:text-ink-50">
                    {m.teamA.name} vs {m.teamB.name}
                  </div>
                  <div className="text-sm text-ink-600 dark:text-ink-400">
                    {m.innings.map((inn, i) => (
                      <span key={i} className="mr-3">
                        {inn.battingTeamId === m.teamA.id
                          ? m.teamA.shortName
                          : m.teamB.shortName}{' '}
                        {inn.totalRuns}/{inn.wickets} (
                        {ballsToOvers(inn.legalBalls, m.ballsPerOver)})
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight size={18} className="text-ink-400 dark:text-ink-500" />
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    ),
    recent: (
      <Card className="border-pitch-200">
        <CardHeader
          className="bg-pitch-50"
          title={<span className="text-pitch-800">Recent results</span>}
        />
        <CardBody className="space-y-2">
          {recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
              No completed matches yet.
            </p>
          ) : (
            recent.map((m) => (
              <Link
                key={m.id}
                to={`/match/${m.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <div>
                  <div className="font-medium text-ink-900 dark:text-ink-50">
                    {m.teamA.shortName} vs {m.teamB.shortName}
                  </div>
                  <div className="text-sm text-pitch-700">{m.result?.summary}</div>
                </div>
                <span className="text-xs text-ink-400 dark:text-ink-500">
                  {formatDate(m.completedAt)}
                </span>
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    ),
    activity: (
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Activity size={18} className="text-ink-500" /> Recent activity
            </span>
          }
        />
        <CardBody>
          <ActivityFeed max={12} filterable />
        </CardBody>
      </Card>
    ),
    upcoming: (
      <Card className="border-amber-200">
        <CardHeader className="bg-amber-50" title={<span className="text-amber-800">Upcoming</span>} />
        <CardBody className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="py-3 text-center text-sm text-ink-500 dark:text-ink-400">
              Nothing scheduled.
            </p>
          ) : (
            upcoming.map((m) => (
              <Link
                key={m.id}
                to={`/match/${m.id}`}
                className="block rounded-lg px-3 py-2 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <div className="font-medium text-ink-900 dark:text-ink-50">
                  {m.teamA.shortName} vs {m.teamB.shortName}
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400">
                  {formatDate(m.scheduledAt ?? m.createdAt)} · {m.format}
                </div>
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    ),
    topRuns: (
      <Card className="border-pitch-200">
        <CardHeader
          className="bg-pitch-50"
          title={
            <span className="flex items-center gap-2 text-pitch-800">
              <TrendingUp size={18} className="text-pitch-600" /> Top run scorers
            </span>
          }
        />
        <CardBody className="space-y-1">
          {topBat.length === 0 ? (
            <p className="py-2 text-center text-sm text-ink-500 dark:text-ink-400">No data yet.</p>
          ) : (
            topBat.map((r, i) => {
              const p = playerName(r.playerId)
              return (
                <Link
                  key={r.playerId}
                  to={`/player/${r.playerId}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <span className="w-4 text-sm text-ink-400 dark:text-ink-500">{i + 1}</span>
                  <Avatar name={p?.fullName ?? '?'} src={p?.photoURL} size={26} />
                  <span className="flex-1 text-sm text-ink-800 dark:text-ink-200">
                    {p?.displayName ?? 'Unknown'}
                  </span>
                  <Badge tone="green">{r.value}</Badge>
                </Link>
              )
            })
          )}
        </CardBody>
      </Card>
    ),
    topWickets: (
      <Card className="border-brand-200">
        <CardHeader
          className="bg-brand-50"
          title={
            <span className="flex items-center gap-2 text-brand-800">
              <Activity size={18} className="text-brand-600" /> Top wicket takers
            </span>
          }
        />
        <CardBody className="space-y-1">
          {topBowl.length === 0 ? (
            <p className="py-2 text-center text-sm text-ink-500 dark:text-ink-400">No data yet.</p>
          ) : (
            topBowl.map((r, i) => {
              const p = playerName(r.playerId)
              return (
                <Link
                  key={r.playerId}
                  to={`/player/${r.playerId}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <span className="w-4 text-sm text-ink-400 dark:text-ink-500">{i + 1}</span>
                  <Avatar name={p?.fullName ?? '?'} src={p?.photoURL} size={26} />
                  <span className="flex-1 text-sm text-ink-800 dark:text-ink-200">
                    {p?.displayName ?? 'Unknown'}
                  </span>
                  <Badge tone="blue">{r.value}</Badge>
                </Link>
              )
            })
          )}
        </CardBody>
      </Card>
    ),
  }

  function renderColumn(col: DashboardColumn, keys: DashboardWidget[]) {
    return keys.map((key, i) => {
      const hidden = layout.hidden.includes(key)
      if (hidden && !customizing) return null
      return (
        <div key={key} className={cn(hidden && customizing && 'opacity-40')}>
          {customizing && (
            <div className="mb-1.5 flex items-center justify-between rounded-lg border border-dashed border-ink-300 dark:border-ink-700 px-2 py-1 text-xs text-ink-500 dark:text-ink-400">
              <span className="flex items-center gap-1.5">
                <LayoutGrid size={12} /> {WIDGET_LABELS[key]}
              </span>
              <span className="flex items-center gap-1">
                <button
                  onClick={() => moveWidget(col, key, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${WIDGET_LABELS[key]} up`}
                  className="rounded p-1 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveWidget(col, key, 1)}
                  disabled={i === keys.length - 1}
                  aria-label={`Move ${WIDGET_LABELS[key]} down`}
                  className="rounded p-1 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => toggleHidden(key)}
                  aria-label={`${hidden ? 'Show' : 'Hide'} ${WIDGET_LABELS[key]}`}
                  className="rounded p-1 hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </span>
            </div>
          )}
          {widgets[key]}
        </div>
      )
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome, ${profile?.displayName?.split(' ')[0] ?? ''}`}
        subtitle="Here's what's happening across your cricket platform."
        actions={
          <div className="flex gap-2">
            <Button
              variant={customizing ? 'primary' : 'outline'}
              onClick={() => setCustomizing((v) => !v)}
            >
              <LayoutGrid size={16} /> {customizing ? 'Done' : 'Customize'}
            </Button>
            {customizing && (
              <Button variant="ghost" onClick={reset}>
                <RotateCcw size={16} /> Reset layout
              </Button>
            )}
            {canScore(profile) && (
              <Button onClick={() => navigate('/matches/new')}>
                <Plus size={16} /> New match
              </Button>
            )}
          </div>
        }
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link to="/players" className="block transition-transform hover:-translate-y-0.5">
          <StatCard label="Players" value={scopedPlayers.length} icon={<Users size={20} />} tone="blue" />
        </Link>
        <Link to="/teams" className="block transition-transform hover:-translate-y-0.5">
          <StatCard label="Teams" value={scopedTeams.length} icon={<Shield size={20} />} tone="green" />
        </Link>
        <Link to="/tournaments" className="block transition-transform hover:-translate-y-0.5">
          <StatCard label="Tournaments" value={scopedTournaments.length} icon={<Trophy size={20} />} tone="amber" />
        </Link>
        <Link to="/matches" className="block transition-transform hover:-translate-y-0.5">
          <StatCard label="Matches" value={all.length} icon={<Swords size={20} />} tone="purple" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">{renderColumn('left', layout.left)}</div>
        <div className="space-y-6">{renderColumn('right', layout.right)}</div>
      </div>
    </div>
  )
}
