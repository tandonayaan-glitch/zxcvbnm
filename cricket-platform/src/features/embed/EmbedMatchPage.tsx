import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LiveBadge, Badge } from '@/components/ui/primitives'
import { subscribeMatch } from '@/services/matches.service'
import { ballsToOvers, formatRate, runRate } from '@/lib/format'
import type { Match } from '@/types'

/**
 * Chrome-free compact live score card, meant to be `<iframe>`d elsewhere — no app shell, no nav,
 * no footer. Deliberately a smaller, self-contained summary rather than reusing `MatchPage`'s
 * private `LivePanel` (which assumes the surrounding header/card chrome this page doesn't have).
 */
export function EmbedMatchPage() {
  const { id = '' } = useParams()
  const [match, setMatch] = useState<Match | null>(null)

  useEffect(() => subscribeMatch(id, setMatch), [id])

  if (!match) {
    return <div className="p-4 text-sm text-ink-500 dark:text-ink-400">Loading…</div>
  }

  const live = match.status === 'live' || match.status === 'innings_break'
  const inn = live || match.status === 'completed' ? match.innings[match.currentInnings] : null
  const battingShort =
    inn && inn.battingTeamId === match.teamA.id ? match.teamA.shortName : match.teamB.shortName

  return (
    <div className="min-h-screen bg-white p-4 font-sans dark:bg-ink-950">
      <div className="mb-2 flex items-center justify-between">
        {live ? (
          <LiveBadge />
        ) : match.status === 'completed' ? (
          <Badge tone="gray">Completed</Badge>
        ) : match.status === 'abandoned' ? (
          <Badge tone="red">Abandoned</Badge>
        ) : (
          <Badge tone="amber">Upcoming</Badge>
        )}
        <a
          href={`/match/${id}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          CricketHub ↗
        </a>
      </div>
      <div className="text-base font-bold text-ink-900 dark:text-ink-50">
        {match.teamA.name} vs {match.teamB.name}
      </div>
      {inn && (
        <div className="mt-1">
          <div className="text-2xl font-extrabold text-ink-900 dark:text-ink-50">
            {battingShort} {inn.totalRuns}/{inn.wickets}
          </div>
          <div className="text-sm text-ink-500 dark:text-ink-400">
            {ballsToOvers(inn.legalBalls, match.ballsPerOver)} ov · CRR{' '}
            {formatRate(runRate(inn.totalRuns, inn.legalBalls, match.ballsPerOver))}
          </div>
        </div>
      )}
      {match.result && (
        <div className="mt-2 text-sm font-semibold text-pitch-700 dark:text-pitch-400">
          {match.result.summary}
        </div>
      )}
    </div>
  )
}
