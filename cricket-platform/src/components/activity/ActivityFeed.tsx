import type { ReactNode } from 'react'
import { Users, Shield, Trophy, Swords, Building2, PlayCircle, CheckCircle2 } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { listActivity } from '@/services/activity.service'
import { formatDateTime } from '@/lib/format'
import type { ActivityLog } from '@/types'

const TYPE_ICON: Record<ActivityLog['type'], ReactNode> = {
  match_created: <Swords size={13} />,
  match_started: <PlayCircle size={13} />,
  match_completed: <CheckCircle2 size={13} />,
  player_created: <Users size={13} />,
  team_created: <Shield size={13} />,
  tournament_created: <Trophy size={13} />,
  club_created: <Building2 size={13} />,
}

/**
 * A timeline of platform activity. Pass `refId` to scope it to one team/player/
 * tournament/club, omit it for the platform-wide feed (used on the Dashboard).
 */
export function ActivityFeed({
  refId,
  max = 15,
  emptyLabel = 'No activity yet.',
}: {
  refId?: string
  max?: number
  emptyLabel?: string
}) {
  const feed = useAsync(() => listActivity({ refId, max }), [refId, max])

  if (feed.loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-ink-50 dark:bg-ink-800/60" />
  }

  const items = feed.data ?? []
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">{emptyLabel}</p>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            {TYPE_ICON[a.type]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-800 dark:text-ink-200">{a.message}</p>
            <p className="text-xs text-ink-400 dark:text-ink-500">{formatDateTime(a.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
