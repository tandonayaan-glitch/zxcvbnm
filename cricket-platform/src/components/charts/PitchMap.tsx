import { Card } from '@/components/ui/primitives'
import { BOWLING_LENGTHS, BOWLING_LINES, type PitchMapCell } from '@/domain/pitchMap'
import type { BowlingLength, BowlingLine } from '@/types'

const LINE_LABELS: Record<BowlingLine, string> = {
  wide_leg: 'Wide leg',
  leg: 'Leg',
  stump: 'Stumps',
  outside_off: 'Outside off',
  wide_off: 'Wide off',
}
const LENGTH_LABELS: Record<BowlingLength, string> = {
  full_toss: 'Full toss',
  yorker: 'Yorker',
  full: 'Full',
  good: 'Good',
  short: 'Short',
  bouncer: 'Bouncer',
}

/* Bowling line x length heatmap — a grid, not a literal pitch drawing, so
 * every cell stays legible regardless of how sparse the data is. Cell
 * shade scales with balls bowled there; the number shown is runs conceded. */
export function PitchMap({ cells }: { cells: PitchMapCell[] }) {
  const maxBalls = Math.max(1, ...cells.map((c) => c.balls))
  const byKey = new Map(cells.map((c) => [`${c.line}|${c.length}`, c]))

  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold text-ink-800 dark:text-ink-200">
        Bowling line &amp; length
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th className="p-1" />
              {BOWLING_LINES.map((line) => (
                <th key={line} className="p-1 font-medium text-ink-500 dark:text-ink-400">
                  {LINE_LABELS[line]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BOWLING_LENGTHS.map((length) => (
              <tr key={length}>
                <td className="p-1 text-right font-medium text-ink-500 dark:text-ink-400">
                  {LENGTH_LABELS[length]}
                </td>
                {BOWLING_LINES.map((line) => {
                  const cell = byKey.get(`${line}|${length}`)
                  const balls = cell?.balls ?? 0
                  const opacity = balls > 0 ? 0.15 + 0.65 * (balls / maxBalls) : 0
                  return (
                    <td key={line} className="p-1">
                      <div
                        className="mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-md text-ink-800 dark:text-ink-100"
                        style={{ backgroundColor: `rgba(34,197,94,${opacity})` }}
                        title={
                          balls > 0
                            ? `${balls} balls · ${cell!.runs} runs · ${cell!.wickets} wkts`
                            : 'No deliveries tagged here'
                        }
                      >
                        {balls > 0 ? (
                          <>
                            <span className="text-xs font-semibold">{cell!.runs}</span>
                            {cell!.wickets > 0 && (
                              <span className="text-[9px] text-red-600">{cell!.wickets}W</span>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-300 dark:text-ink-700">·</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink-400 dark:text-ink-500">
        Shade = balls bowled there · number = runs conceded · W = wickets
      </p>
    </Card>
  )
}
