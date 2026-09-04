import { useState, type ReactNode } from 'react'
import {
  Users,
  Shield,
  Trophy,
  Swords,
  Building2,
  PlayCircle,
  CheckCircle2,
  Star,
  Award,
  Target,
} from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { listActivity } from '@/services/activity.service'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ActivityLog } from '@/types'

const TYPE_ICON: Record<ActivityLog['type'], ReactNode> = {
  match_created: <Swords size={15} />,
  match_started: <PlayCircle size={15} />,
  match_completed: <CheckCircle2 size={15} />,
  player_created: <Users size={15} />,
  team_created: <Shield size={15} />,
  tournament_created: <Trophy size={15} />,
  club_created: <Building2 size={15} />,
  century: <Star size={15} />,
  half_century: <Award size={15} />,
  five_wicket_haul: <Target size={15} />,
}

/** Smaller glyph for the inline filter chips. */
const CHIP_ICON: Record<ActivityLog['type'], ReactNode> = {
  match_created: <Swords size={13} />,
  match_started: <PlayCircle size={13} />,
  match_completed: <CheckCircle2 size={13} />,
  player_created: <Users size={13} />,
  team_created: <Shield size={13} />,
  tournament_created: <Trophy size={13} />,
  club_created: <Building2 size={13} />,
  century: <Star size={13} />,
  half_century: <Award size={13} />,
  five_wicket_haul: <Target size={13} />,
}

const TYPE_LABEL: Record<ActivityLog['type'], string> = {
  match_created: 'Match created',
  match_started: 'Match started',
  match_completed: 'Match completed',
  player_created: 'Player added',
  team_created: 'Team created',
  tournament_created: 'Tournament created',
  club_created: 'Club created',
  century: 'Century',
  half_century: 'Half-century',
  five_wicket_haul: 'Five-wicket haul',
}

/**
 * A timeline of platform activity. Pass `refId` to scope it to one team/player/
 * tournament/club, omit it for the platform-wide feed (used on the Dashboard).
 */
export function ActivityFeed({
  refId,
  max = 15,
  emptyLabel = 'No activity yet.',
  filterable = false,
}: {
  refId?: string
  max?: number
  emptyLabel?: string
  /** Show a per-type filter chip row above the feed. Off by default for small embedded widgets. */
  filterable?: boolean
}) {
  const feed = useAsync(() => listActivity({ refId, max }), [refId, max])
  const [activeType, setActiveType] = useState<ActivityLog['type'] | 'all'>('all')

  if (feed.loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-ink-50 dark:bg-ink-800/60" />
  }

  const items = feed.data ?? []
  const presentTypes = Array.from(new Set(items.map((a) => a.type)))
  const shown = activeType === 'all' ? items : items.filter((a) => a.type === activeType)

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">{emptyLabel}</p>
    )
  }

  return (
    <div className="space-y-3">
      {filterable && presentTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveType('all')}
            className={cn(
              'flex min-h-[2rem] shrink-0 items-center whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors',
              activeType === 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
            )}
          >
            All
          </button>
          {presentTypes.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={cn(
                'flex min-h-[2rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors',
                activeType === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
              )}
            >
              {CHIP_ICON[t]}
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      <div className="divide-y divide-ink-100 dark:divide-ink-800">
        {shown.map((a) => (
          <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
              {TYPE_ICON[a.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-ink-800 dark:text-ink-100">
                {a.message}
              </p>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                {formatDateTime(a.createdAt)}
              </p>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
            No activity of this type yet.
          </p>
        )}
      </div>
    </div>
  )
}
