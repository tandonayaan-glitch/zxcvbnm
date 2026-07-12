import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useWriteQueueStore } from '@/store/writeQueueStore'
import { cn } from '@/lib/cn'

/**
 * Shows the writes this app has issued and not yet had acknowledged, per
 * write — not a view into the Firestore SDK's private offline queue (which
 * has no public enumeration API), but this app's own record, tied to each
 * write's own commit promise. Renders nothing when the queue is empty.
 */
export function SyncQueuePanel({ className }: { className?: string }) {
  const writes = useWriteQueueStore((s) => s.writes)
  if (writes.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-ink-200 bg-white p-2 text-xs shadow-sm dark:border-ink-700 dark:bg-ink-900',
        className,
      )}
    >
      <div className="mb-1 font-semibold text-ink-500 dark:text-ink-400">
        Sync queue ({writes.length})
      </div>
      <ul className="space-y-1">
        {writes.map((w) => (
          <li key={w.id} className="flex items-center gap-1.5">
            {w.status === 'pending' && (
              <Loader2 size={12} className="shrink-0 animate-spin text-amber-500" />
            )}
            {w.status === 'synced' && (
              <CheckCircle2 size={12} className="shrink-0 text-pitch-600" />
            )}
            {w.status === 'failed' && (
              <XCircle size={12} className="shrink-0 text-red-600" />
            )}
            <span className="truncate text-ink-700 dark:text-ink-300">{w.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
