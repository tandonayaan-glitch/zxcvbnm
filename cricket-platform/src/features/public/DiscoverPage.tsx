import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Shield, Building2, Trophy, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, PageLoader, EmptyState, Avatar, Select, Input } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listClubs } from '@/services/clubs.service'
import { listTournaments } from '@/services/tournaments.service'
import { listAllMatches } from '@/services/matches.service'
import { filterPlayers, filterTeams, filterClubs, filterTournaments } from '@/domain/discovery'
import { knownLocations } from '@/domain/rankings'
import { aggregatePlayerStats } from '@/domain/stats'
import { careerPerformanceScore } from '@/domain/performanceScore'
import type { Player } from '@/types'

type Tab = 'players' | 'teams' | 'clubs' | 'tournaments'

/** Unified discovery — players, teams, clubs, tournaments, one search box and a shared set of
 *  filters, per the platform brief's explicit "one discovery engine, not five" instruction.
 *  Venue/umpire/scorer/commentator discovery are not built (no venue-as-entity or
 *  official-directory model exists yet — see ROADMAP_V6_PLATFORM.md). */
export function DiscoverPage() {
  useDocumentMeta('Discover — CricketHub', 'Find players, teams, clubs, and tournaments.')
  const players = useAsync(listPlayers, [])
  const teams = useAsync(listTeams, [])
  const clubs = useAsync(listClubs, [])
  const tournaments = useAsync(listTournaments, [])
  const matches = useAsync(listAllMatches, [])

  const [tab, setTab] = useState<Tab>('players')
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('any')
  const [skillLevel, setSkillLevel] = useState<Player['skillLevel'] | 'any'>('any')
  const [role, setRole] = useState<Player['role'] | 'any'>('any')
  const [sortByPerformance, setSortByPerformance] = useState(false)

  const locations = useMemo(() => knownLocations(players.data ?? []), [players.data])

  // Scouting: real Performance Score per player, from completed-match stats already loaded
  // platform-wide — same domain function used on the player's own Career Intelligence tab, so
  // the number shown here always agrees with the one on the player's own page.
  const scoreByPlayerId = useMemo(() => {
    const stats = aggregatePlayerStats(matches.data ?? [])
    const map = new Map<string, number>()
    for (const [pid, s] of stats) map.set(pid, careerPerformanceScore(s).total)
    return map
  }, [matches.data])

  const filteredPlayers = useMemo(() => {
    const base = filterPlayers(players.data ?? [], { query, location, skillLevel, role })
    if (!sortByPerformance) return base
    return [...base].sort((a, b) => (scoreByPlayerId.get(b.id) ?? 0) - (scoreByPlayerId.get(a.id) ?? 0))
  }, [players.data, query, location, skillLevel, role, sortByPerformance, scoreByPlayerId])
  const filteredTeams = useMemo(() => filterTeams(teams.data ?? [], query), [teams.data, query])
  const filteredClubs = useMemo(() => filterClubs(clubs.data ?? [], query), [clubs.data, query])
  const filteredTournaments = useMemo(
    () => filterTournaments(tournaments.data ?? [], query),
    [tournaments.data, query],
  )

  const loading = players.loading || teams.loading || clubs.loading || tournaments.loading

  const tabs: { key: Tab; label: string; icon: typeof Users; count: number }[] = [
    { key: 'players', label: 'Players', icon: Users, count: filteredPlayers.length },
    { key: 'teams', label: 'Teams', icon: Shield, count: filteredTeams.length },
    { key: 'clubs', label: 'Clubs', icon: Building2, count: filteredClubs.length },
    { key: 'tournaments', label: 'Tournaments', icon: Trophy, count: filteredTournaments.length },
  ]

  if (loading) return <PageLoader label="Loading…" />

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Discover" subtitle="Find players, teams, clubs, and tournaments on CricketHub." />

      <div className="mb-4 flex items-center gap-2">
        <Search size={16} className="text-ink-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="flex-1"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}
          >
            <t.icon size={14} /> {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'players' && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Select value={location} onChange={(e) => setLocation(e.target.value)} className="max-w-[10rem]">
              <option value="any">Any location</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
            <Select
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value as typeof skillLevel)}
              className="max-w-[10rem]"
            >
              <option value="any">Any skill level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
            <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="max-w-[10rem]">
              <option value="any">Any role</option>
              <option value="batter">Batter</option>
              <option value="bowler">Bowler</option>
              <option value="all_rounder">All-rounder</option>
              <option value="wicket_keeper">Wicket-keeper</option>
            </Select>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-1.5 text-sm dark:border-ink-700">
              <input
                type="checkbox"
                checked={sortByPerformance}
                onChange={(e) => setSortByPerformance(e.target.checked)}
              />
              Sort by Performance Score
            </label>
          </div>
          {filteredPlayers.length === 0 ? (
            <EmptyState title="No players match" icon={<Users size={28} />} />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredPlayers.map((p) => (
                <Link key={p.id} to={`/player/${p.id}`}>
                  <Card className="flex items-center gap-3 p-3 hover:border-brand-300">
                    <Avatar name={p.displayName} src={p.photoURL} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink-900 dark:text-ink-50">{p.displayName}</div>
                      <div className="truncate text-xs text-ink-500 dark:text-ink-400">
                        {p.role.replace('_', ' ')}
                        {p.location ? ` · ${p.location}` : ''}
                      </div>
                    </div>
                    {(scoreByPlayerId.get(p.id) ?? 0) > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                        {scoreByPlayerId.get(p.id)}
                      </span>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'teams' &&
        (filteredTeams.length === 0 ? (
          <EmptyState title="No teams match" icon={<Shield size={28} />} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredTeams.map((t) => (
              <Link key={t.id} to={`/team/${t.id}`}>
                <Card className="flex items-center gap-3 p-3 hover:border-brand-300">
                  <Avatar name={t.name} src={t.logoURL} size={40} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink-900 dark:text-ink-50">{t.name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">{t.playerIds.length} players</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}

      {tab === 'clubs' &&
        (filteredClubs.length === 0 ? (
          <EmptyState title="No clubs match" icon={<Building2 size={28} />} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredClubs.map((c) => (
              <Link key={c.id} to={`/club/${c.id}`}>
                <Card className="flex items-center gap-3 p-3 hover:border-brand-300">
                  <Avatar name={c.name} src={c.logoURL} size={40} />
                  <div className="min-w-0 truncate font-medium text-ink-900 dark:text-ink-50">{c.name}</div>
                </Card>
              </Link>
            ))}
          </div>
        ))}

      {tab === 'tournaments' &&
        (filteredTournaments.length === 0 ? (
          <EmptyState title="No tournaments match" icon={<Trophy size={28} />} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredTournaments.map((t) => (
              <Link key={t.id} to={`/tournament/${t.id}`}>
                <Card className="flex items-center gap-3 p-3 hover:border-brand-300">
                  <Avatar name={t.name} src={t.bannerURL} size={40} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink-900 dark:text-ink-50">{t.name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">{t.status}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}
    </div>
  )
}
