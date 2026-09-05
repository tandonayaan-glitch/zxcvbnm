import { auth } from '@/lib/firebase'
import type { AIRequest, AIResponse } from '@/domain/ai'
import { isValidAIOutput } from '@/domain/ai'

// Same Worker as storage.service.ts's R2 endpoints (VITE_R2_WORKER_URL) — the AI Engine's /ai
// route lives on it too rather than standing up a second Worker for one endpoint.
const AI_WORKER_URL = (import.meta.env.VITE_R2_WORKER_URL ?? '').replace(/\/$/, '')

/**
 * Calls the AI Engine. Provider-independent on this side too — the caller passes a
 * `domain/ai.ts`-built request and gets back a plain status, never anything provider-specific.
 * Never throws for the "no provider configured" case (that's an expected, common response, not
 * an error) — only for genuine failures (not signed in, network error, malformed response).
 */
export async function requestAIInsight(request: AIRequest): Promise<AIResponse> {
  if (!AI_WORKER_URL) {
    return { status: 'not_configured', message: 'The media/AI Worker is not configured for this environment.' }
  }
  const user = auth.currentUser
  if (!user) {
    return { status: 'error', message: 'You must be signed in to request an AI insight.' }
  }

  try {
    const token = await user.getIdToken()
    const res = await fetch(`${AI_WORKER_URL}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(request),
    })
    const data = (await res.json()) as AIResponse
    if (data.status === 'ok' && !isValidAIOutput(data.output)) {
      // The provider returned something implausible (empty, or absurdly long) — treat it as a
      // failure rather than showing a user something that slipped past basic sanity checks.
      return { status: 'error', message: 'The AI response did not pass validation.' }
    }
    return data
  } catch {
    return { status: 'error', message: 'Could not reach the AI service.' }
  }
}
