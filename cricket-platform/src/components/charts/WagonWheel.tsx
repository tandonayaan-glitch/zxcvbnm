import { Card } from '@/components/ui/primitives'
import type { WagonWheelZone } from '@/domain/wagonWheel'

/* Eight-sector wagon wheel: shot placement by runs, coloured by intensity.
 * SVG, no external chart deps — sector radius scales with runs scored in
 * that zone relative to the zone with the most runs. */

const SIZE = 240
const CENTER = SIZE / 2
const MAX_R = 100
const MIN_R = 18

function sectorPath(index: number, radius: number): string {
  const startAngle = -90 + index * 45
  const endAngle = startAngle + 45
  const toRad = (a: number) => (a * Math.PI) / 180
  const x1 = CENTER + radius * Math.cos(toRad(startAngle))
  const y1 = CENTER + radius * Math.sin(toRad(startAngle))
  const x2 = CENTER + radius * Math.cos(toRad(endAngle))
  const y2 = CENTER + radius * Math.sin(toRad(endAngle))
  return `M ${CENTER},${CENTER} L ${x1},${y1} A ${radius},${radius} 0 0 1 ${x2},${y2} Z`
}

export function WagonWheel({ zones }: { zones: WagonWheelZone[] }) {
  const maxRuns = Math.max(1, ...zones.map((z) => z.runs))

  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold text-ink-800 dark:text-ink-200">Wagon wheel</h3>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto w-full max-w-[240px]"
        role="img"
        aria-label="Wagon wheel of shot placement by runs"
      >
        <circle cx={CENTER} cy={CENTER} r={MAX_R} fill="none" stroke="#e2e8f0" strokeWidth={1} />
        {[0.33, 0.66].map((f) => (
          <circle
            key={f}
            cx={CENTER}
            cy={CENTER}
            r={MAX_R * f}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}
        {zones.map((z, i) => {
          const r = z.runs > 0 ? MIN_R + (MAX_R - MIN_R) * (z.runs / maxRuns) : 0
          if (r <= 0) return null
          return (
            <path
              key={z.zone}
              d={sectorPath(i, r)}
              fill="var(--color-pitch-500)"
              fillOpacity={0.25 + 0.6 * (z.runs / maxRuns)}
              stroke="var(--color-pitch-600)"
              strokeWidth={1}
            />
          )
        })}
        <circle cx={CENTER} cy={CENTER} r={2} fill="#94a3b8" />
      </svg>
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[11px] text-ink-500 dark:text-ink-400">
        {zones.map((z) => (
          <div key={z.zone}>
            <div className="font-semibold text-ink-700 dark:text-ink-300">{z.runs}</div>
            <div>{z.balls} balls</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
