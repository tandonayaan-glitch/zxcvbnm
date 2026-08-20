import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/primitives'
import { formatRate } from '@/lib/format'
import type { StandingsRow } from '@/types'

/** Shared by the public Tournament page and the Tournament Dashboard's standings
 *  widget — same shape, same rendering, no reason to duplicate it. */
export function StandingsTable({
  rows,
  teamNameById,
}: {
  rows: StandingsRow[]
  teamNameById: Map<string, string>
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <th className="px-3 py-2.5 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">Team</th>
            <th className="px-2 py-2.5 text-right font-semibold">P</th>
            <th className="px-2 py-2.5 text-right font-semibold">W</th>
            <th className="px-2 py-2.5 text-right font-semibold">L</th>
            <th className="px-2 py-2.5 text-right font-semibold">T</th>
            <th className="px-2 py-2.5 text-right font-semibold">Pts</th>
            <th className="px-3 py-2.5 text-right font-semibold">NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className="border-b border-ink-50 dark:border-ink-800">
              <td className="px-3 py-2.5 text-ink-400 dark:text-ink-500">{i + 1}</td>
              <td className="px-3 py-2.5">
                <Link
                  to={`/team/${r.teamId}`}
                  className="font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                >
                  {teamNameById.get(r.teamId) ?? r.teamName}
                </Link>
              </td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.played}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.won}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.lost}</td>
              <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.tied}</td>
              <td className="px-2 py-2.5 text-right font-bold text-ink-900 dark:text-ink-50">{r.points}</td>
              <td className="px-3 py-2.5 text-right text-ink-600 dark:text-ink-400">{formatRate(r.nrr)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-ink-400 dark:text-ink-500">
                No teams in this tournament yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
