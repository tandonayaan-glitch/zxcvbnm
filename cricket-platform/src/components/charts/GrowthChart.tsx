import { Card } from '@/components/ui/primitives'
import type { DailyCount } from '@/domain/platformAnalytics'

/* Generic daily-activity bar chart (signups, matches per day, etc). SVG, no external chart deps —
 * matches the pattern already used by TeamForm/PlayerForm. */

const W = 640
const H = 140
const PAD_X = 6
const PAD_TOP = 14
const PAD_BOTTOM = 18

export function GrowthChart({ title, data }: { title: string; data: DailyCount[] }) {
  if (data.length === 0) return null
  const max = Math.max(1, ...data.map((d) => d.count))
  const slot = (W - PAD_X * 2) / data.length
  const barW = Math.max(1, Math.min(14, slot * 0.7))
  const y = (v: number) => PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * (1 - v / max)

  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold text-ink-800 dark:text-ink-200">{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        <line x1={PAD_X} y1={H - PAD_BOTTOM} x2={W - PAD_X} y2={H - PAD_BOTTOM} stroke="#e2e8f0" />
        {data.map((d, i) => {
          const cx = PAD_X + slot * i + slot / 2
          const top = y(d.count)
          return (
            <rect
              key={d.date}
              x={cx - barW / 2}
              y={d.count > 0 ? top : H - PAD_BOTTOM - 1}
              width={barW}
              height={d.count > 0 ? H - PAD_BOTTOM - top : 1}
              rx={1}
              fill="var(--color-brand-500)"
            >
              <title>
                {d.date}: {d.count}
              </title>
            </rect>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400 dark:text-ink-500">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </Card>
  )
}
