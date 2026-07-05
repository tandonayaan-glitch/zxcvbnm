import { Card } from '@/components/ui/primitives'
import type { PlayerMatchPerformance } from '@/types'

/* Recent-form mini charts for a player, rendered as SVG from the match-by-match
 * performance log (no external chart deps). Batting = runs per innings; bowling
 * = wickets per innings. Newest innings on the right. */

const MAX_INNINGS = 12
const W = 320
const H = 120
const PAD_X = 6
const PAD_TOP = 16
const PAD_BOTTOM = 18

function batColor(runs: number, out: boolean): string {
  if (runs >= 50) return '#d97706' // milestone
  if (runs >= 30) return '#16a34a'
  if (!out && runs > 0) return '#22c55e'
  return '#86efac'
}

function Bars({
  values,
  labels,
  color,
  maxHint,
  markNotOut,
}: {
  values: number[]
  labels: string[]
  color: (v: number, i: number) => string
  maxHint: number
  markNotOut?: boolean[]
}) {
  const max = Math.max(maxHint, ...values)
  const n = values.length
  const areaW = W - PAD_X * 2
  const slot = areaW / Math.max(1, n)
  const barW = Math.min(28, slot * 0.6)
  const y = (v: number) => PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * (1 - v / max)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Recent form"
    >
      <line
        x1={PAD_X}
        y1={H - PAD_BOTTOM}
        x2={W - PAD_X}
        y2={H - PAD_BOTTOM}
        stroke="#e2e8f0"
      />
      {values.map((v, i) => {
        const cx = PAD_X + slot * i + slot / 2
        const top = y(v)
        const barH = H - PAD_BOTTOM - top
        return (
          <g key={i}>
            <rect
              x={cx - barW / 2}
              y={v > 0 ? top : H - PAD_BOTTOM - 1}
              width={barW}
              height={v > 0 ? barH : 1}
              rx={2}
              fill={v > 0 ? color(v, i) : '#e2e8f0'}
            />
            <text
              x={cx}
              y={top - 3}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill="#334155"
            >
              {values[i]}
              {markNotOut?.[i] ? '*' : ''}
            </text>
            <text
              x={cx}
              y={H - 6}
              textAnchor="middle"
              fontSize={8}
              fill="#94a3b8"
            >
              {labels[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function PlayerForm({
  performances,
}: {
  performances: PlayerMatchPerformance[]
}) {
  // performances arrive newest-first; take the most recent, show oldest→newest.
  const recent = performances.slice(0, MAX_INNINGS).reverse()

  const batInns = recent.filter((p) => p.batting)
  const bowlInns = recent.filter((p) => p.bowling)
  if (batInns.length === 0 && bowlInns.length === 0) return null

  const last5Bat = performances
    .filter((p) => p.batting)
    .slice(0, 5)
    .map((p) => p.batting!.runs)
  const last5Sum = last5Bat.reduce((a, b) => a + b, 0)

  const last5Bowl = performances
    .filter((p) => p.bowling)
    .slice(0, 5)
    .reduce((a, p) => a + (p.bowling!.wickets ?? 0), 0)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {batInns.length > 0 && (
        <Card className="p-4">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink-800">
              Batting form
            </h3>
            <span className="text-xs text-ink-500">
              last 5: {last5Sum} run{last5Sum === 1 ? '' : 's'}
            </span>
          </div>
          <Bars
            values={batInns.map((p) => p.batting!.runs)}
            labels={batInns.map((p) => p.opponent.slice(0, 3))}
            markNotOut={batInns.map((p) => !p.batting!.out)}
            color={(v, i) => batColor(v, batInns[i].batting!.out)}
            maxHint={30}
          />
        </Card>
      )}
      {bowlInns.length > 0 && (
        <Card className="p-4">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink-800">
              Bowling form
            </h3>
            <span className="text-xs text-ink-500">
              last 5: {last5Bowl} wkt{last5Bowl === 1 ? '' : 's'}
            </span>
          </div>
          <Bars
            values={bowlInns.map((p) => p.bowling!.wickets)}
            labels={bowlInns.map((p) => p.opponent.slice(0, 3))}
            color={(v) => (v >= 3 ? '#7c3aed' : v >= 1 ? '#2563eb' : '#bfdbfe')}
            maxHint={3}
          />
        </Card>
      )}
    </div>
  )
}
