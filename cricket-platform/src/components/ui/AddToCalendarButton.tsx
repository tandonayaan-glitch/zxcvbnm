import { CalendarPlus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { matchToICS } from '@/domain/calendarExport'
import { exportSlug } from '@/domain/matchExport'
import { downloadBlob } from '@/lib/download'
import { useToast } from '@/components/ui/toast'
import type { Match } from '@/types'

/**
 * Downloads a single-event .ics file for a scheduled match. Renders nothing
 * when the match has no `scheduledAt` — there's nothing to put on a
 * calendar yet, same "render nothing rather than a disabled control"
 * convention as the sponsor strip and photo galleries.
 */
export function AddToCalendarButton({
  match,
  className,
}: {
  match: Match
  className?: string
}) {
  const toast = useToast()
  if (!match.scheduledAt) return null

  function onClick() {
    const ics = matchToICS(match)
    if (!ics) {
      toast.error('This match has no scheduled time yet')
      return
    }
    downloadBlob(`${exportSlug(match)}.ics`, ics, 'text/calendar;charset=utf-8')
  }

  return (
    <button
      onClick={onClick}
      aria-label="Add to calendar"
      title="Add to calendar"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-300 bg-white text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
        className,
      )}
    >
      <CalendarPlus size={15} />
    </button>
  )
}
