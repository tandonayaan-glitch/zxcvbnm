import { cn } from '@/lib/cn'

export interface TabItem {
  key: string
  label: React.ReactNode
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        // Wrap onto a second row instead of hiding overflowing tabs behind a
        // horizontal scroll that a laptop mouse wheel can't reach and a tablet
        // gives no visible affordance for. `overflow-x-auto` stays as a last
        // resort for the rare case a single tab is wider than the container.
        'flex flex-wrap gap-1 overflow-x-auto border-b border-ink-200 dark:border-ink-800',
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            active === t.key
              ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
