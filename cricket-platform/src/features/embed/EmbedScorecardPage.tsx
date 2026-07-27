import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ScorecardView } from '@/features/scorecard/ScorecardView'
import { useAsync } from '@/hooks/useAsync'
import { listPlayers } from '@/services/players.service'
import { subscribeMatch } from '@/services/matches.service'
import { subscribeDeliveries } from '@/services/scoring.service'
import type { Delivery, Match } from '@/types'

/** Chrome-free full scorecard, meant to be `<iframe>`d elsewhere — reuses the same
 *  `ScorecardView` the real match page renders, just without the app shell around it. */
export function EmbedScorecardPage() {
  const { id = '' } = useParams()
  const players = useAsync(listPlayers, [])
  const [match, setMatch] = useState<Match | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])

  useEffect(() => {
    const unsub = subscribeMatch(id, setMatch)
    const unsubD = subscribeDeliveries(id, setDeliveries)
    return () => {
      unsub()
      unsubD()
    }
  }, [id])

  if (!match || players.loading) {
    return <div className="p-4 text-sm text-ink-500 dark:text-ink-400">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-white p-4 font-sans dark:bg-ink-950">
      <ScorecardView match={match} players={players.data ?? []} deliveries={deliveries} />
      <a
        href={`/match/${id}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block text-center text-xs font-medium text-brand-600 hover:underline"
      >
        View full match on CricketHub ↗
      </a>
    </div>
  )
}
