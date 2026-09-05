import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, User, Shield, Trophy, Swords, Building2, Sparkles } from 'lucide-react'
import {
  Avatar,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { globalSearch, type SearchResults } from '@/services/search.service'
import { usePlatformStats } from '@/hooks/usePlatformStats'
import { runSmartSearch, smartSearchExamples } from '@/domain/smartSearch'

type SearchFilter = 'all' | 'players' | 'teams' | 'tournaments' | 'matches' | 'clubs'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<SearchFilter>('all')

  useEffect(() => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    setLoading(true)
    setFilter('all')
    globalSearch(q)
      .then(setResults)
      .finally(() => setLoading(false))
  }, [q])

  const show = (type: Exclude<SearchFilter, 'all'>) =>
    filter === 'all' || filter === type

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setParams(input.trim() ? { q: input.trim() } : {})
  }

  const total = results
    ? results.players.length +
      results.teams.length +
      results.tournaments.length +
      results.matches.length +
      results.clubs.length
    : 0

  // Smart Search — deterministic cricket-statistical queries ("most runs", "Team A vs Team B"),
  // layered on top of the plain entity search above. See domain/smartSearch.ts.
  const platformStats = usePlatformStats()
  const smartResult = useMemo(() => {
    if (!q.trim() || platformStats.loading) return null
    return runSmartSearch(q, {
      playerStats: platformStats.playerStats,
      players: platformStats.players,
      teams: platformStats.teams,
      matches: platformStats.matches,
    })
  }, [q, platformStats])
  const nameOf = (pid?: string) => (pid ? platformStats.playerMap.get(pid)?.displayName ?? pid : '')

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <form onSubmit={submit} className="mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500"
          />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search players, teams, tournaments, matches…"
            className="w-full rounded-xl border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 py-3 pl-11 pr-4 text-ink-900 dark:text-ink-50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </form>

      {loading ? (
        <PageLoader />
      ) : !results ? (
        <div>
          <EmptyState
            icon={<Search size={40} />}
            title="Search the platform"
            description="Find any player, team, tournament or match — or try a stat question."
          />
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {smartSearchExamples().map((ex) => (
              <button
                key={ex}
                onClick={() => setParams({ q: ex })}
                className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : total === 0 && !smartResult ? (
        <EmptyState title={`No results for "${q}"`} />
      ) : (
        <div className="space-y-6">
          {smartResult && (
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <Sparkles size={13} /> Smart Search — {smartResult.title}
              </div>
              <ol className="list-inside list-decimal space-y-1 text-sm">
                {smartResult.rows.map((r, i) => (
                  <li key={i}>
                    {r.playerId ? (
                      <>
                        <Link to={`/player/${r.playerId}`} className="text-brand-700 hover:underline">
                          {nameOf(r.playerId)}
                        </Link>
                        <span className="text-ink-500"> — {r.label}</span>
                      </>
                    ) : r.teamId ? (
                      <Link to={`/team/${r.teamId}`} className="text-brand-700 hover:underline">
                        {r.label}
                      </Link>
                    ) : (
                      <span>{r.label}</span>
                    )}
                    {r.value && <span className="text-ink-400"> ({r.value})</span>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-500 dark:text-ink-400">
              {total} result{total === 1 ? '' : 's'}
            </span>
            <span className="text-ink-300">·</span>
            {(
              [
                ['all', 'All', total],
                ['players', 'Players', results.players.length],
                ['teams', 'Teams', results.teams.length],
                ['tournaments', 'Tournaments', results.tournaments.length],
                ['matches', 'Matches', results.matches.length],
                ['clubs', 'Clubs', results.clubs.length],
              ] as [SearchFilter, string, number][]
            )
              .filter(([key, , count]) => key === 'all' || count > 0)
              .map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    filter === key
                      ? 'bg-brand-600 text-white'
                      : 'border border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'
                  }`}
                >
                  {label} {count}
                </button>
              ))}
          </div>

          {show('players') && results.players.length > 0 && (
            <Section title="Players" icon={<User size={16} />}>
              {results.players.map((p) => (
                <Link
                  key={p.id}
                  to={`/player/${p.id}`}
                  className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3 hover:border-brand-300"
                >
                  <Avatar name={p.fullName} src={p.photoURL} size={36} />
                  <div>
                    <div className="font-medium text-ink-900 dark:text-ink-50">{p.fullName}</div>
                    <div className="text-xs capitalize text-ink-400 dark:text-ink-500">
                      {p.role.replace('_', ' ')}
                    </div>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {show('teams') && results.teams.length > 0 && (
            <Section title="Teams" icon={<Shield size={16} />}>
              {results.teams.map((t) => (
                <Link
                  key={t.id}
                  to={`/team/${t.id}`}
                  className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3 hover:border-brand-300"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white"
                    style={{ backgroundColor: t.primaryColor }}
                  >
                    {t.shortName}
                  </div>
                  <span className="font-medium text-ink-900 dark:text-ink-50">{t.name}</span>
                </Link>
              ))}
            </Section>
          )}

          {show('tournaments') && results.tournaments.length > 0 && (
            <Section title="Tournaments" icon={<Trophy size={16} />}>
              {results.tournaments.map((t) => (
                <Link
                  key={t.id}
                  to={`/tournament/${t.id}`}
                  className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3 hover:border-brand-300"
                >
                  <Trophy size={20} className="text-amber-500" />
                  <span className="font-medium text-ink-900 dark:text-ink-50">{t.name}</span>
                </Link>
              ))}
            </Section>
          )}

          {show('clubs') && results.clubs.length > 0 && (
            <Section title="Clubs" icon={<Building2 size={16} />}>
              {results.clubs.map((c) => (
                <Link
                  key={c.id}
                  to={`/club/${c.id}`}
                  className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3 hover:border-brand-300"
                >
                  <Avatar name={c.name} src={c.logoURL} size={36} />
                  <span className="font-medium text-ink-900 dark:text-ink-50">{c.name}</span>
                </Link>
              ))}
            </Section>
          )}

          {show('matches') && results.matches.length > 0 && (
            <Section title="Matches" icon={<Swords size={16} />}>
              {results.matches.map((m) => (
                <Link
                  key={m.id}
                  to={`/match/${m.id}`}
                  className="flex items-center justify-between rounded-lg border border-ink-200 dark:border-ink-800 p-3 hover:border-brand-300"
                >
                  <span className="font-medium text-ink-900 dark:text-ink-50">
                    {m.teamA.name} vs {m.teamB.name}
                  </span>
                  <span className="text-xs capitalize text-ink-400 dark:text-ink-500">
                    {m.status}
                  </span>
                </Link>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {icon} {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
