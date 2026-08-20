import { useRef, useState } from 'react'
import { Trophy, LayoutDashboard } from 'lucide-react'
import { DashboardPage } from './DashboardPage'
import { useAsync } from '@/hooks/useAsync'
import { listTournaments } from '@/services/tournaments.service'
import { useAuthStore, canManageTournaments, ownsOrMaster } from '@/store/authStore'
import { PageLoader, Select } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const SWIPE_THRESHOLD_PX = 60

/**
 * Wraps `DashboardPage` with a Global / Tournament switcher for anyone who
 * manages at least one tournament — tab clicks (all sizes) plus a swipe
 * gesture (touch devices). Renders bare `DashboardPage` with none of this UI
 * for everyone else, so a normal user's dashboard is pixel-identical to
 * before this existed. Only one `DashboardPage` is ever mounted at a time —
 * each fetches its own data (`useAsync` has no cache), so mounting both
 * permanently would double every dashboard's Firestore reads.
 */
export function DashboardSwitcher() {
  const profile = useAuthStore((s) => s.profile)
  const tournaments = useAsync(listTournaments, [])
  const [view, setView] = useState<'global' | 'tournament'>('global')
  const [activeId, setActiveId] = useState<string | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  if (tournaments.loading) return <PageLoader />

  const myTournaments = (tournaments.data ?? []).filter(
    (t) => canManageTournaments(profile) && ownsOrMaster(profile, t.ownerId),
  )

  // Nothing to switch to — render exactly what DashboardPage always rendered.
  if (myTournaments.length === 0) return <DashboardPage />

  const active = myTournaments.find((t) => t.id === activeId) ?? myTournaments[0]

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // Ignore short, mostly-vertical, or scroll-driven gestures.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) setView('tournament') // swipe left -> tournament (reads left-to-right: Global, then Tournament)
    else setView('global') // swipe right -> global
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-ink-100 dark:bg-ink-800 p-1">
          <button
            onClick={() => setView('global')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'global'
                ? 'bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-50 shadow-sm'
                : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
            )}
          >
            <LayoutDashboard size={14} /> Global
          </button>
          <button
            onClick={() => setView('tournament')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'tournament'
                ? 'bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-50 shadow-sm'
                : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
            )}
          >
            <Trophy size={14} /> {myTournaments.length > 1 ? 'Tournament' : active.name}
          </button>
        </div>
        {view === 'tournament' && myTournaments.length > 1 && (
          <Select
            value={active.id}
            onChange={(e) => setActiveId(e.target.value)}
            className="w-auto"
          >
            {myTournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div key={view} className="animate-fade-in-opacity">
        {view === 'global' ? <DashboardPage /> : <DashboardPage tournamentId={active.id} />}
      </div>
    </div>
  )
}
