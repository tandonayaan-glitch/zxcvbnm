/* ==================================================================
 * AI Engine — provider-independent types and context builders (Phase 18).
 * Pure, no I/O; the actual network call lives in services/ai.service.ts,
 * and the actual provider call (if any) lives in the Worker's /ai handler.
 *
 * The whole point of this file: every AI feature is fed EXACTLY the
 * platform's own deterministic output (a MatchReport, a
 * PerformanceScoreBreakdown, career-intelligence data) — never raw
 * unprocessed data, and never anything invented here. An AI provider, once
 * configured, would be asked to summarize/narrate this context, not to
 * produce statistics of its own. See worker/src/handlers/ai.ts for the
 * matching server-side contract and its own note on why the provider call
 * itself isn't implemented without a real key to build against.
 * ================================================================== */
import type { MatchReport } from './matchReport'
import type { PerformanceScoreBreakdown } from './performanceScore'
import type { FormTrend } from './careerIntelligence'
import type { DevelopmentArea } from './playerDevelopment'

export type AIFeature =
  | 'match_report_narrative'
  | 'coaching_summary'
  | 'tactical_recommendation'
  | 'commentary'
  | 'opponent_scouting_summary'

export type AIResponseStatus = 'not_configured' | 'ok' | 'error'

export interface AIResponse {
  status: AIResponseStatus
  /** Only present when status === 'ok'. Always the provider's own text — this layer never
   *  fills this in with a placeholder or fabricated string. */
  output?: string
  message?: string
}

export interface MatchReportNarrativeContext {
  feature: 'match_report_narrative'
  context: { report: MatchReport }
}

export interface CoachingSummaryContext {
  feature: 'coaching_summary'
  context: { performanceScore: PerformanceScoreBreakdown; formTrend: FormTrend | null; developmentAreas: DevelopmentArea[] }
}

export type AIRequest = MatchReportNarrativeContext | CoachingSummaryContext

export function buildMatchReportNarrativeRequest(report: MatchReport): MatchReportNarrativeContext {
  return { feature: 'match_report_narrative', context: { report } }
}

export function buildCoachingSummaryRequest(
  performanceScore: PerformanceScoreBreakdown,
  formTrend: FormTrend | null,
  developmentAreas: DevelopmentArea[],
): CoachingSummaryContext {
  return { feature: 'coaching_summary', context: { performanceScore, formTrend, developmentAreas } }
}

/** Basic shape/length sanity check on a provider's output before it's ever shown to a user —
 *  the "safe output validation" the brief asks for. Deliberately minimal: this platform has no
 *  provider to have seen real output from yet, so anything more specific (a schema, banned
 *  phrases) would be guessing. Rejects empty/whitespace-only or implausibly long output. */
export function isValidAIOutput(output: string | undefined): output is string {
  if (typeof output !== 'string') return false
  const trimmed = output.trim()
  return trimmed.length > 0 && trimmed.length <= 8000
}
