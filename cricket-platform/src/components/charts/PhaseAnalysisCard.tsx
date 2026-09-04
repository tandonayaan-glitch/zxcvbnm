import { Card, CardHeader, CardBody } from '@/components/ui/primitives'
import { inningsPhaseAnalysis } from '@/domain/phaseAnalysis'
import type { Delivery, Match } from '@/types'

const PHASE_LABEL: Record<string, string> = {
  powerplay: 'Powerplay',
  middle: 'Middle overs',
  death: 'Death overs',
}

/** Real powerplay/middle/death breakdown for one innings, computed from that innings' own
 *  already-loaded deliveries — see domain/phaseAnalysis.ts for why this stays match-scoped
 *  rather than platform-wide. */
export function PhaseAnalysisCard({
  match,
  deliveries,
  inningsIndex,
  teamName,
}: {
  match: Match
  deliveries: Delivery[]
  inningsIndex: number
  teamName: string
}) {
  const lines = inningsPhaseAnalysis(deliveries, inningsIndex, match)
  if (lines.length === 0) return null

  return (
    <Card>
      <CardHeader title={`Phase breakdown — ${teamName}`} />
      <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {lines.map((l) => (
          <div key={l.phase} className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {PHASE_LABEL[l.phase]}
            </div>
            <div className="text-xs text-ink-400">Overs {l.overs}</div>
            <div className="mt-1 text-lg font-bold text-ink-900 dark:text-ink-50">
              {l.runs}/{l.wickets}
            </div>
            <div className="text-xs text-ink-500 dark:text-ink-400">RR {l.runRate.toFixed(2)}</div>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}
