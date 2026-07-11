import { Sun, Moon } from 'lucide-react'
import { usePrefsStore, useResolvedDark } from '@/store/prefsStore'
import { cn } from '@/lib/cn'

/** Horizontal light/dark slider switch. Toggles between explicit "light" and
 * "dark" (the fuller Light/Dark/System control lives on the Settings page). */
export function ThemeToggle() {
  const set = usePrefsStore((s) => s.set)
  const isDark = useResolvedDark()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onClick={() => set('theme', isDark ? 'light' : 'dark')}
      className="relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border border-ink-300 bg-ink-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-ink-700 dark:bg-ink-800"
    >
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform duration-200',
          isDark ? 'translate-x-9 bg-ink-900' : 'translate-x-1',
        )}
      >
        {isDark ? (
          <Moon size={13} className="text-brand-300" />
        ) : (
          <Sun size={13} className="text-amber-500" />
        )}
      </span>
    </button>
  )
}
