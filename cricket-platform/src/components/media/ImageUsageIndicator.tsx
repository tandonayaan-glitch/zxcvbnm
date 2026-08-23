import { useAsync } from '@/hooks/useAsync'
import { getMyImageUsage } from '@/services/storage.service'

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/** Small "X of 100MB used" strip for the account settings page. Renders nothing while
 *  loading, on error, or if the R2 Worker isn't configured yet — this is a convenience
 *  display, not something that should ever block or clutter the page it sits on. The real
 *  enforcement happens server-side in the Worker regardless of whether this renders. */
export function ImageUsageIndicator() {
  const usage = useAsync(getMyImageUsage, [])
  if (usage.loading || !usage.data) return null

  const { usedBytes, limitBytes } = usage.data
  const pct = Math.min(100, Math.round((usedBytes / limitBytes) * 100))

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
        <span>Image storage</span>
        <span>
          {formatMB(usedBytes)} of {formatMB(limitBytes)} used
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div
          className={pct >= 90 ? 'h-full bg-red-500' : pct >= 70 ? 'h-full bg-amber-500' : 'h-full bg-brand-500'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
