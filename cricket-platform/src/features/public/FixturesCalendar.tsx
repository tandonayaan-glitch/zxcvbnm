import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Match } from '@/types'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_DOT: Record<string, string> = {
  live: 'bg-red-500',
  innings_break: 'bg-red-500',
  completed: 'bg-ink-400 dark:bg-ink-500',
  abandoned: 'bg-ink-400 dark:bg-ink-500',
  setup: 'bg-amber-500',
}

function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** A real month-grid calendar (not a placeholder list) for a tournament's fixtures — matches with
 *  no `scheduledAt` don't appear here (there's no day to place them on). Starts on the month of
 *  the earliest scheduled match, or the current month if none are scheduled yet. */
export function FixturesCalendar({ matches }: { matches: Match[] }) {
  const scheduled = useMemo(() => matches.filter((m) => m.scheduledAt), [matches])

  const initialMonth = useMemo(() => {
    if (scheduled.length === 0) return new Date()
    const earliest = Math.min(...scheduled.map((m) => m.scheduledAt!))
    return new Date(earliest)
  }, [scheduled])

  const [viewYear, setViewYear] = useState(initialMonth.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth())

  const byDay = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of scheduled) {
      const key = dateKey(m.scheduledAt!)
      const list = map.get(key) ?? []
      list.push(m)
      map.set(key, list)
    }
    return map
  }, [scheduled])

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startWeekday = firstOfMonth.getDay()
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-ink-800 dark:text-ink-200">
          {firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={`empty-${i}`} />
          const key = `${viewYear}-${viewMonth}-${day}`
          const dayMatches = byDay.get(key) ?? []
          return (
            <div
              key={key}
              className="min-h-[64px] rounded-md border border-ink-100 dark:border-ink-800 p-1 text-left"
            >
              <div className="text-[11px] text-ink-400 dark:text-ink-500">{day}</div>
              <div className="space-y-0.5">
                {dayMatches.slice(0, 2).map((m) => (
                  <Link
                    key={m.id}
                    to={`/match/${m.id}`}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] hover:bg-ink-50 dark:hover:bg-ink-800"
                    title={`${m.teamA.name} vs ${m.teamB.name}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[m.status] ?? 'bg-ink-300'}`}
                    />
                    <span className="truncate text-ink-700 dark:text-ink-300">
                      {m.teamA.shortName} v {m.teamB.shortName}
                    </span>
                  </Link>
                ))}
                {dayMatches.length > 2 && (
                  <div className="px-1 text-[10px] text-ink-400 dark:text-ink-500">
                    +{dayMatches.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
