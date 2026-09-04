import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, X } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/**
 * Chrome for a full-screen workflow/tool that runs OUTSIDE the app shell (live
 * scoring, and anything similar added later). It deliberately doesn't render the
 * sidebar — a focused tool wants the space — but it guarantees the one thing a
 * full-screen tool must never omit: a always-visible, unambiguous way OUT.
 *
 * "Exit" here means "leave this tool", not "sign out" and not "go back one
 * history entry" — it navigates to a known-safe home screen (`exitTo`) that is
 * always reachable for anyone allowed into the tool. The scoring engine persists
 * every ball as it happens, so leaving is always safe; a tool with unsaved local
 * state should gate the click itself before calling this.
 */
export function WorkflowShell({
  title,
  exitTo,
  exitLabel = 'Exit',
  children,
}: {
  title?: ReactNode
  exitTo: string
  exitLabel?: string
  children: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b border-ink-200 bg-white/95 px-4 pt-safe backdrop-blur dark:border-ink-800 dark:bg-ink-900/95">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pitch-500 text-white">
            <Trophy size={18} />
          </span>
          <span className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">
            {title ?? 'CricketHub'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(exitTo)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-300 px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <X size={16} /> {exitLabel}
        </button>
      </header>
      <main className="flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}
