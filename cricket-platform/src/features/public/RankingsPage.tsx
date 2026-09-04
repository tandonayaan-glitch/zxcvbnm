import { useMemo, useState } from 'react'
import { Trophy, Radio } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, PageLoader, EmptyState, Select } from '@/components/ui/primitives'
import { LeaderboardCard } from '@/components/stats/LeaderboardCard'
import { usePlatformStats } from '@/hooks/usePlatformStats'
import { useAsync } from '@/hooks/useAsync'
import { listUsers } from '@/services/users.service'
import { buildRankings, filterLeaderboardsByLocation, knownLocations, buildScorerLeaderboard } from '@/domain/rankings'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import type { MatchFormat } from '@/types'

const FORMATS: (MatchFormat | 'all')[] = ['all', 'T20', 'ODI', 'T10', 'THE_HUNDRED', 'CUSTOM']

/**
 * Global player and scorer rankings — real, derived-only data (aggregated match stats +
 * location strings players actually entered), filterable by format and location. No performance
 * score is invented: this reuses the same `buildLeaderboards()` engine the Stats page uses.
 */
export function RankingsPage() {
  useDocumentMeta('Rankings — CricketHub', 'Player and scorer rankings across CricketHub.')
  const { loading, matches, players, playerMap } = usePlatformStats()
  const users = useAsync(listUsers, [])
  const [tab, setTab] = useState<'players' | 'officials'>('players')
  const [format, setFormat] = useState<MatchFormat | 'all'>('all')
  const [location, setLocation] = useState('all')

  const locations = useMemo(() => knownLocations(players), [players])

  const boards = useMemo(() => {
    const built = buildRankings(matches, { format }, 25)
    return filterLeaderboardsByLocation(built, players, location)
  }, [matches, players, format, location])

  const scorerRows = useMemo(() => buildScorerLeaderboard(matches), [matches])
  const userById = useMemo(
    () => new Map((users.data ?? []).map((u) => [u.id, u])),
    [users.data],
  )

  if (loading) return <PageLoader label="Loading rankings…" />

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Rankings"
        subtitle="Derived from completed matches on this platform — never a hardcoded or fabricated list."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setTab('players')}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === 'players' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}
        >
          <Trophy size={14} className="mr-1 inline" /> Players
        </button>
        <button
          onClick={() => setTab('officials')}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === 'officials' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}
        >
          <Radio size={14} className="mr-1 inline" /> Scorers
        </button>
      </div>

      {tab === 'players' && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Select value={format} onChange={(e) => setFormat(e.target.value as MatchFormat | 'all')} className="max-w-[10rem]">
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f === 'all' ? 'All formats' : f}
                </option>
              ))}
            </Select>
            <Select value={location} onChange={(e) => setLocation(e.target.value)} className="max-w-[12rem]">
              <option value="all">All locations</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          {boards.length === 0 ? (
            <EmptyState title="No ranking data yet" description="Complete some matches to see rankings here." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {boards.map((b, i) => (
                <LeaderboardCard key={b.key} board={b} players={playerMap} limit={10} tone={i} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'officials' && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {scorerRows.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink-400">No scored matches yet.</p>
            )}
            {scorerRows.map((row, i) => (
              <div key={row.uid} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 text-sm font-semibold text-ink-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">
                    {userById.get(row.uid)?.displayName ?? 'Unknown scorer'}
                  </div>
                  <div className="text-xs text-ink-500 dark:text-ink-400">
                    {row.completedMatchesScored} completed · {row.matchesScored} total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
