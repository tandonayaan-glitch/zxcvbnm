/* ==================================================================
 * Phase analysis (powerplay / middle / death) — pure, computed from a
 * single match's own delivery log, which the calling page already has
 * loaded. Deliberately NOT computed platform-wide across many matches:
 * that would mean reading every completed match's full delivery
 * subcollection, which this app's own performance rules (§63 in the
 * platform brief) rule out without real pagination/aggregation
 * infrastructure this project doesn't have yet.
 * ================================================================== */
import { resolvePowerplayOvers } from './matchRules'
import type { Delivery, Match } from '@/types'

export type Phase = 'powerplay' | 'middle' | 'death'

export interface PhaseLine {
  phase: Phase
  overs: string // "1-6" style range, for display
  runs: number
  wickets: number
  legalBalls: number
  runRate: number
}

/** Death overs = the last 20% of the innings (rounded up, min 1) — a common analytics
 *  convention, not the only one; documented here rather than left unexplained. */
function deathOversCount(totalOvers: number): number {
  return Math.max(1, Math.ceil(totalOvers * 0.2))
}

export function phaseForOver(overNumber0Based: number, totalOvers: number, powerplayOvers: number): Phase {
  const deathStart = totalOvers - deathOversCount(totalOvers)
  if (overNumber0Based < powerplayOvers) return 'powerplay'
  if (overNumber0Based >= deathStart) return 'death'
  return 'middle'
}

/** Breaks one innings' deliveries into powerplay/middle/death lines. Returns only the phases
 *  that actually occurred (a short/interrupted innings may never reach the death overs). */
export function inningsPhaseAnalysis(
  deliveries: Delivery[],
  inningsIndex: number,
  match: Match,
): PhaseLine[] {
  const totalOvers = match.oversPerInnings
  const powerplayOvers = resolvePowerplayOvers(match)
  const deathStart = totalOvers - deathOversCount(totalOvers)

  const lines = new Map<Phase, { runs: number; wickets: number; legalBalls: number }>()
  for (const d of deliveries) {
    if (d.inningsIndex !== inningsIndex) continue
    const phase = phaseForOver(d.overNumber, totalOvers, powerplayOvers)
    const line = lines.get(phase) ?? { runs: 0, wickets: 0, legalBalls: 0 }
    line.runs += d.totalRuns
    if (d.wicket) line.wickets += 1
    if (d.isLegal) line.legalBalls += 1
    lines.set(phase, line)
  }

  const ranges: Record<Phase, string> = {
    powerplay: `1-${powerplayOvers}`,
    middle: `${powerplayOvers + 1}-${deathStart}`,
    death: `${deathStart + 1}-${totalOvers}`,
  }

  return (['powerplay', 'middle', 'death'] as Phase[])
    .filter((p) => lines.has(p))
    .map((phase) => {
      const l = lines.get(phase)!
      return {
        phase,
        overs: ranges[phase],
        runs: l.runs,
        wickets: l.wickets,
        legalBalls: l.legalBalls,
        runRate: l.legalBalls > 0 ? Math.round((l.runs / l.legalBalls) * 6 * 100) / 100 : 0,
      }
    })
}
