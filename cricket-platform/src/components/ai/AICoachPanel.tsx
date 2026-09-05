import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, Button } from '@/components/ui/primitives'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import { requestAIInsight } from '@/services/ai.service'
import { buildCoachingSummaryRequest } from '@/domain/ai'
import type { PerformanceScoreBreakdown } from '@/domain/performanceScore'
import type { FormTrend } from '@/domain/careerIntelligence'
import type { DevelopmentArea } from '@/domain/playerDevelopment'

/**
 * AI Coach — the one user-facing demonstration of the AI Engine's full request/response
 * lifecycle (Phase 18): loading, error, and "not configured" states, all real. Hidden entirely
 * behind the `ai_coach` feature flag (off by default, and no such flag exists until a master
 * admin creates one in Feature Flags) so this never ships as a visible dead button — turning the
 * flag on shows a real control that calls the real Worker endpoint, which honestly reports that
 * no AI provider is configured today rather than faking a response.
 */
export function AICoachPanel({
  performanceScore,
  formTrend,
  developmentAreas,
}: {
  performanceScore: PerformanceScoreBreakdown
  formTrend: FormTrend | null
  developmentAreas: DevelopmentArea[]
}) {
  const enabled = useFeatureFlag('ai_coach')
  const [state, setState] = useState<'idle' | 'loading' | 'not_configured' | 'error' | 'ok'>('idle')
  const [message, setMessage] = useState('')
  const [output, setOutput] = useState('')

  if (!enabled) return null

  async function ask() {
    setState('loading')
    const res = await requestAIInsight(buildCoachingSummaryRequest(performanceScore, formTrend, developmentAreas))
    if (res.status === 'ok' && res.output) {
      setOutput(res.output)
      setState('ok')
    } else if (res.status === 'not_configured') {
      setMessage(res.message ?? 'AI is not configured for this environment yet.')
      setState('not_configured')
    } else {
      setMessage(res.message ?? 'Something went wrong.')
      setState('error')
    }
  }

  return (
    <Card className="p-4">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-ink-900 dark:text-ink-50">
        <Sparkles size={15} /> AI Coach
      </h3>
      <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
        Would summarize the Performance Score and Development data above in plain language —
        never invents statistics of its own.
      </p>
      {state === 'idle' && (
        <Button size="sm" onClick={ask}>
          Ask AI Coach
        </Button>
      )}
      {state === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 size={14} className="animate-spin" /> Asking…
        </div>
      )}
      {state === 'not_configured' && (
        <p className="text-sm text-ink-500 dark:text-ink-400">{message}</p>
      )}
      {state === 'error' && <p className="text-sm text-red-600">{message}</p>}
      {state === 'ok' && <p className="text-sm text-ink-700 dark:text-ink-300">{output}</p>}
    </Card>
  )
}
