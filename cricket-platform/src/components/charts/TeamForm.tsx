import { Card } from '@/components/ui/primitives'
import type { FormOutcome } from '@/domain/teamForm'

/* Runs-scored-per-match bar chart for a team, coloured by result. SVG, no
 * external chart deps. Oldest match on the left. */

// W uses the `pitch` CSS variable (not a literal) so the colour-blind
// palette's pitch -> teal override applies here too, consistent with every
// other pitch-* usage in the app.
const COLOR: Record<FormOutcome, string> = {
  W: 'var(--color-pitch-600)',
  L: '#dc2626',
  T: '#d97706',
  N: '#94a3b8',
}

export interface TeamFormPoint {
  matchId: string
  runs: number
  outcome: FormOutcome
  opponentShort: string
}

const W = 320
const H = 120
const PAD_X = 6
const PAD_TOP = 16
const PAD_BOTTOM = 18

export function TeamForm({ data }: { data: TeamFormPoint[] }) {
  if (data.length === 0) return null
  const max = Math.max(20, ...data.map((d) => d.runs))
  const slot = (W - PAD_X * 2) / Math.max(1, data.length)
  const barW = Math.min(30, slot * 0.6)
  const y = (v: number) =>
    PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * (1 - v / max)

  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold text-ink-800 dark:text-ink-200">
        Runs scored — recent matches
      </h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Runs scored in recent matches"
      >
        <line
          x1={PAD_X}
          y1={H - PAD_BOTTOM}
          x2={W - PAD_X}
          y2={H - PAD_BOTTOM}
          stroke="#e2e8f0"
        />
        {data.map((d, i) => {
          const cx = PAD_X + slot * i + slot / 2
          const top = y(d.runs)
          return (
            <g key={d.matchId}>
              <rect
                x={cx - barW / 2}
                y={d.runs > 0 ? top : H - PAD_BOTTOM - 1}
                width={barW}
                height={d.runs > 0 ? H - PAD_BOTTOM - top : 1}
                rx={2}
                fill={COLOR[d.outcome]}
              />
              <text
                x={cx}
                y={top - 3}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill="#334155"
              >
                {d.runs}
              </text>
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fontSize={8}
                fill="#94a3b8"
              >
                {d.opponentShort}
              </text>
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
