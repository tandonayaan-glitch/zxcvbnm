import { useMemo, useState } from 'react'
import { Play, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardBody, Badge } from '@/components/ui/primitives'
import { ShareButton } from '@/components/ui/ShareButton'
import { extractMatchHighlights, type HighlightType } from '@/domain/highlights'
import type { BallMeta, Delivery, Match, MatchVideo } from '@/types'

const TYPE_LABEL: Record<HighlightType, string> = {
  wicket: 'Wickets',
  six: 'Sixes',
  four: 'Fours',
  milestone: 'Milestones',
  big_over: 'Big overs',
  partnership: 'Partnerships',
  turning_point: 'Turning points',
}

const TYPE_TONE: Record<HighlightType, 'red' | 'green' | 'blue' | 'amber' | 'gray'> = {
  wicket: 'red',
  six: 'green',
  four: 'blue',
  milestone: 'amber',
  big_over: 'amber',
  partnership: 'blue',
  turning_point: 'gray',
}

/**
 * First-class, filterable Highlights view — real, data-based moments (wickets, boundaries,
 * milestones, turning points) that stand on their own from the scorecard, with a "Watch" button
 * that appears only when a real video exists AND that specific ball has a real recorded
 * timestamp (never a fabricated one). Works with zero video at all.
 */
export function HighlightsPanel({
  match,
  deliveries,
  ballMeta,
  name,
  activeVideo,
  onSeek,
}: {
  match: Match
  deliveries: Delivery[]
  ballMeta: BallMeta[]
  name: (id?: string | null) => string
  /** The currently-playing replay, if any — only a `live_recording` video's timestamps are
   *  guaranteed to correspond to this match's own ball-by-ball timeline. */
  activeVideo?: MatchVideo | null
  onSeek?: (sec: number) => void
}) {
  const [filter, setFilter] = useState<HighlightType | 'all'>('all')
  const highlights = useMemo(() => extractMatchHighlights(match, deliveries), [match, deliveries])
  const ballMetaById = useMemo(() => new Map(ballMeta.map((m) => [m.id, m])), [ballMeta])
  const filtered = filter === 'all' ? highlights : highlights.filter((h) => h.type === filter)
  const canSeek = activeVideo?.kind === 'live_recording' && !!onSeek

  const presentTypes = [...new Set(highlights.map((h) => h.type))]

  if (highlights.length === 0) return null

  return (
    <Card className="mb-4">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles size={16} /> Highlights
          </span>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}
          >
            All ({highlights.length})
          </button>
          {presentTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filter === t ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}
            >
              {TYPE_LABEL[t]} ({highlights.filter((h) => h.type === t).length})
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {filtered.map((h) => {
            const meta = h.deliveryId ? ballMetaById.get(h.deliveryId) : undefined
            const timestamp = meta?.videoTimestampSec
            return (
              <div
                key={h.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={TYPE_TONE[h.type]}>{TYPE_LABEL[h.type]}</Badge>
                    {h.displayOver && <span className="font-mono text-xs text-ink-500">{h.displayOver}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-ink-700 dark:text-ink-300">{h.description}</p>
                  {h.playerIds.length > 0 && (
                    <p className="text-xs text-ink-400">{h.playerIds.map((id) => name(id)).join(' · ')}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canSeek && timestamp != null && (
                    <button
                      onClick={() => onSeek!(timestamp)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                    >
                      <Play size={12} /> Watch
                    </button>
                  )}
                  <ShareButton variant="icon" title={`${TYPE_LABEL[h.type]} — ${match.title}`} />
                </div>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
