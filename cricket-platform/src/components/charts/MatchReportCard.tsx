import { Link } from 'react-router-dom'
import { FileText, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/primitives'
import { buildMatchReport } from '@/domain/matchReport'
import type { Delivery, Match } from '@/types'

/** Deterministic post-match report — every line traces back to the scorecard, never an
 *  AI-generated narrative. See domain/matchReport.ts for the full assembly. */
export function MatchReportCard({
  match,
  deliveries,
  name,
}: {
  match: Match
  deliveries: Delivery[]
  name: (id?: string | null) => string
}) {
  if (match.status !== 'completed') return null
  const report = buildMatchReport(match, deliveries)

  return (
    <Card className="mb-4">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <FileText size={16} /> Match report
          </span>
        }
      />
      <CardBody className="space-y-4">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{report.resultSummary}</p>

        {(report.topPerformers.batter || report.topPerformers.bowler) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {report.topPerformers.batter && (
              <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Top batter</div>
                <Link to={`/player/${report.topPerformers.batter.playerId}`} className="font-medium text-brand-700 hover:underline">
                  {name(report.topPerformers.batter.playerId)}
                </Link>{' '}
                — {report.topPerformers.batter.runs}
                {!report.topPerformers.batter.out ? '*' : ''} ({report.topPerformers.batter.balls})
              </div>
            )}
            {report.topPerformers.bowler && (
              <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Top bowler</div>
                <Link to={`/player/${report.topPerformers.bowler.playerId}`} className="font-medium text-brand-700 hover:underline">
                  {name(report.topPerformers.bowler.playerId)}
                </Link>{' '}
                — {report.topPerformers.bowler.wickets}/{report.topPerformers.bowler.runs}
              </div>
            )}
          </div>
        )}

        {report.expectedVsActual && (
          <div className="rounded-lg border border-ink-100 p-3 text-sm dark:border-ink-800">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              {report.expectedVsActual.delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              Expected vs actual
            </div>
            Projected {report.expectedVsActual.projectedFromPowerplay} from the powerplay trajectory; finished on{' '}
            {report.expectedVsActual.actual} ({report.expectedVsActual.delta >= 0 ? '+' : ''}
            {report.expectedVsActual.delta}).
          </div>
        )}

        {report.biggestSwing && Math.abs(report.biggestSwing.delta) >= 10 && (
          <div className="rounded-lg border border-ink-100 p-3 text-sm dark:border-ink-800">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Biggest win-probability swing</div>
            Over {report.biggestSwing.fromOver}→{report.biggestSwing.toOver}: {report.biggestSwing.fromProbability}% →{' '}
            {report.biggestSwing.toProbability}% ({report.biggestSwing.delta >= 0 ? '+' : ''}
            {report.biggestSwing.delta} pts for the chasing side).
          </div>
        )}

        {report.inningsReports.map((ir) => (
          <div key={ir.inningsIndex} className="rounded-lg border border-ink-100 p-3 text-sm dark:border-ink-800">
            <div className="mb-1 font-medium text-ink-900 dark:text-ink-50">
              {ir.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name} — {ir.totalRuns}/{ir.wickets}
            </div>
            <ul className="list-inside list-disc space-y-0.5 text-ink-600 dark:text-ink-400">
              {ir.summary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ))}

        {report.underperformers.length > 0 && (
          <div className="rounded-lg border border-ink-100 p-3 text-sm dark:border-ink-800">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Starts that didn't convert</div>
            <ul className="space-y-0.5">
              {report.underperformers.map((u) => (
                <li key={u.playerId}>
                  <Link to={`/player/${u.playerId}`} className="text-brand-700 hover:underline">
                    {name(u.playerId)}
                  </Link>{' '}
                  — {u.note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.fielding.length > 0 && (
          <div className="rounded-lg border border-ink-100 p-3 text-sm dark:border-ink-800">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <Users size={13} /> Fielding
            </div>
            <ul className="space-y-0.5">
              {report.fielding.map((f) => (
                <li key={f.playerId}>
                  <Link to={`/player/${f.playerId}`} className="text-brand-700 hover:underline">
                    {name(f.playerId)}
                  </Link>{' '}
                  — {f.catches}c {f.runOuts}ro {f.stumpings}st
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
