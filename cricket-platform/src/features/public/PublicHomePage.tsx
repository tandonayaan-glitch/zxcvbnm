import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Trophy, ChevronRight, Radio } from 'lucide-react'
import {
  Card,
  CardBody,
  CardHeader,
  LiveBadge,
  Badge,
  PageLoader,
} from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import {
  listAllMatches,
  subscribeLiveMatches,
} from '@/services/matches.service'
import { listTournaments } from '@/services/tournaments.service'
import { ballsToOvers, formatDate } from '@/lib/format'
import type { Match } from '@/types'

export function PublicHomePage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [live, setLive] = useState<Match[]>([])
  const allMatches = useAsync(listAllMatches, [])
  const tournaments = useAsync(listTournaments, [])

  useEffect(() => {
    const unsub = subscribeLiveMatches(setLive)
    return () => unsub()
  }, [])

  const recent = (allMatches.data ?? [])
    .filter((m) => m.status === 'completed')
    .slice(0, 6)
  const upcoming = (allMatches.data ?? [])
    .filter((m) => m.status === 'setup')
    .slice(0, 6)

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            Follow live cricket, ball by ball
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-200">
            Live scores, full scorecards, player & team stats, and tournament
            standings — all in one place.
          </p>
          <form onSubmit={onSearch} className="mx-auto mt-6 max-w-md">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search players, teams, tournaments…"
                className="w-full rounded-xl border-0 bg-white py-3 pl-11 pr-4 text-ink-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Live */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink-900">
            <Radio size={18} className="text-red-500" /> Live matches
          </h2>
          {live.length === 0 ? (
            <Card className="p-6 text-center text-ink-500">
              No live matches right now. Check back soon!
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {live.map((m) => (
                <LiveMatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Recent results */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-ink-900">
              Recent results
            </h2>
            {allMatches.loading ? (
              <PageLoader />
            ) : recent.length === 0 ? (
              <Card className="p-5 text-center text-ink-500">
                No completed matches yet.
              </Card>
            ) : (
              <div className="space-y-2">
                {recent.map((m) => (
                  <Link key={m.id} to={`/match/${m.id}`}>
                    <Card className="flex items-center justify-between p-3.5 hover:border-brand-300">
                      <div>
                        <div className="font-semibold text-ink-900">
                          {m.teamA.shortName} vs {m.teamB.shortName}
                        </div>
                        <div className="text-sm text-pitch-700">
                          {m.result?.summary}
                        </div>
                      </div>
                      <span className="text-xs text-ink-400">
                        {formatDate(m.completedAt)}
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming + tournaments */}
          <section className="space-y-6">
            <div>
              <h2 className="mb-3 text-lg font-bold text-ink-900">Upcoming</h2>
              {upcoming.length === 0 ? (
                <Card className="p-5 text-center text-ink-500">
                  Nothing scheduled.
                </Card>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((m) => (
                    <Link key={m.id} to={`/match/${m.id}`}>
                      <Card className="flex items-center justify-between p-3.5 hover:border-brand-300">
                        <div>
                          <div className="font-medium text-ink-900">
                            {m.teamA.shortName} vs {m.teamB.shortName}
                          </div>
                          <div className="text-xs text-ink-500">
                            {formatDate(m.scheduledAt ?? m.createdAt)} · {m.format}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-ink-400" />
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Trophy size={18} className="text-amber-500" /> Tournaments
                  </span>
                }
              />
              <CardBody className="space-y-2">
                {(tournaments.data ?? []).length === 0 ? (
                  <p className="text-center text-sm text-ink-500">
                    No tournaments yet.
                  </p>
                ) : (
                  (tournaments.data ?? []).slice(0, 5).map((t) => (
                    <Link
                      key={t.id}
                      to={`/tournament/${t.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-ink-50"
                    >
                      <span className="font-medium text-ink-800">{t.name}</span>
                      <Badge tone={t.status === 'ongoing' ? 'green' : 'gray'}>
                        {t.status}
                      </Badge>
                    </Link>
                  ))
                )}
              </CardBody>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}

function LiveMatchCard({ match: m }: { match: Match }) {
  return (
    <Link to={`/match/${m.id}`}>
      <Card className="overflow-hidden hover:border-red-300">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2">
          <LiveBadge />
          <span className="text-xs text-ink-400">{m.format}</span>
        </div>
        <CardBody className="space-y-2">
          {m.innings.map((inn, i) => {
            const short =
              inn.battingTeamId === m.teamA.id
                ? m.teamA.shortName
                : m.teamB.shortName
            return (
              <div key={i} className="flex items-center justify-between">
                <span className="font-semibold text-ink-900">{short}</span>
                <span className="font-bold text-ink-900">
                  {inn.totalRuns}/{inn.wickets}{' '}
                  <span className="text-sm font-normal text-ink-500">
                    ({ballsToOvers(inn.legalBalls, m.ballsPerOver)})
                  </span>
                </span>
              </div>
            )
          })}
          {m.innings.length === 0 && (
            <div className="text-sm text-ink-500">
              {m.teamA.name} vs {m.teamB.name}
            </div>
          )}
        </CardBody>
      </Card>
    </Link>
  )
}
