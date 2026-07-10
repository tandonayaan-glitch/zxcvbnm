import { Card } from '@/components/ui/primitives'
import type { RadarAxis } from '@/domain/radar'

/* Six-axis radar/spider chart of a player's batting/bowling/fielding profile.
 * SVG, no external chart deps. Axes are normalised 0-100 against fixed
 * benchmarks (see domain/radar.ts) — a shape, not a ranking. */

const SIZE = 240
const CENTER = SIZE / 2
const MAX_R = 84

function pointFor(index: number, count: number, radius: number): [number, number] {
  const angle = -90 + (360 / count) * index
  const rad = (angle * Math.PI) / 180
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)]
}

export function PlayerRadar({ axes }: { axes: RadarAxis[] }) {
  const n = axes.length
  if (n < 3) return null

  const rings = [0.25, 0.5, 0.75, 1]
  const dataPoints = axes.map((a, i) => pointFor(i, n, (a.value / 100) * MAX_R))
  const dataPath = dataPoints.map((p) => p.join(',')).join(' ')

  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold text-ink-800">Player profile</h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label="Player radar profile">
        {rings.map((f) => {
          const pts = axes.map((_, i) => pointFor(i, n, f * MAX_R).join(',')).join(' ')
          return (
            <polygon
              key={f}
              points={pts}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          )
        })}
        {axes.map((_, i) => {
          const [x, y] = pointFor(i, n, MAX_R)
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          )
        })}
        <polygon
          points={dataPath}
          fill="#3b82f6"
          fillOpacity={0.25}
          stroke="#2563eb"
          strokeWidth={2}
        />
        {dataPoints.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#2563eb" />
        ))}
        {axes.map((a, i) => {
          const [lx, ly] = pointFor(i, n, MAX_R + 22)
          return (
            <text
              key={a.label}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={600}
              fill="#334155"
            >
              {a.label}
            </text>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        {axes.map((a) => (
          <span key={a.label}>
            {a.label}: <b className="text-ink-700">{a.raw}</b>
          </span>
        ))}
      </div>
    </Card>
  )
}
