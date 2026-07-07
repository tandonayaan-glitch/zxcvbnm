import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, User, Shield, Trophy, Swords } from 'lucide-react'
import {
  Avatar,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { globalSearch, type SearchResults } from '@/services/search.service'

type SearchFilter = 'all' | 'players' | 'teams' | 'tournaments' | 'matches'

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
      results.matches.length
    : 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <form onSubmit={submit} className="mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search players, teams, tournaments, matches…"
            className="w-full rounded-xl border border-ink-300 bg-white py-3 pl-11 pr-4 text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </form>

      {loading ? (
        <PageLoader />
      ) : !results ? (
        <EmptyState
          icon={<Search size={40} />}
          title="Search the platform"
          description="Find any player, team, tournament or match."
        />
      ) : total === 0 ? (
        <EmptyState title={`No results for "${q}"`} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-500">
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
                      : 'border border-ink-300 text-ink-600 hover:bg-ink-50'
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
                  className="flex items-center gap-3 rounded-lg border border-ink-200 p-3 hover:border-brand-300"
                >
                  <Avatar name={p.fullName} src={p.photoURL} size={36} />
                  <div>
                    <div className="font-medium text-ink-900">{p.fullName}</div>
                    <div className="text-xs capitalize text-ink-400">
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
                  className="flex items-center gap-3 rounded-lg border border-ink-200 p-3 hover:border-brand-300"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white"
                    style={{ backgroundColor: t.primaryColor }}
                  >
                    {t.shortName}
                  </div>
                  <span className="font-medium text-ink-900">{t.name}</span>
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
                  className="flex items-center gap-3 rounded-lg border border-ink-200 p-3 hover:border-brand-300"
                >
                  <Trophy size={20} className="text-amber-500" />
                  <span className="font-medium text-ink-900">{t.name}</span>
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
                  className="flex items-center justify-between rounded-lg border border-ink-200 p-3 hover:border-brand-300"
                >
                  <span className="font-medium text-ink-900">
                    {m.teamA.name} vs {m.teamB.name}
                  </span>
                  <span className="text-xs capitalize text-ink-400">
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
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-500">
        {icon} {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
