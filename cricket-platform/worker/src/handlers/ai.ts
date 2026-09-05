import type { Env } from '../types'
import { HttpError } from '../types'
import { verifyFirebaseIdToken, bearerToken } from '../authToken'

/**
 * AI Engine endpoint (platform brief Phase 18). Provider-independent by design: the request
 * body is always the same shape regardless of which provider (if any) is configured, and this
 * handler is the ONLY place that would ever hold a provider API key or call out to one.
 *
 * With no `AI_PROVIDER_API_KEY` bound (true in every environment today), this always returns
 * `{ status: 'not_configured' }` — a normal 200 response, not an error, so the client can render
 * an honest "AI isn't available yet" state rather than a failure. It never fabricates an AI
 * response, and it never silently pretends to call a provider that isn't there.
 *
 * `context` in the request body is expected to already be the platform's own deterministic
 * output (a MatchReport, a PerformanceScoreBreakdown, career-intelligence data, etc. — see
 * src/domain/ai.ts on the client) — this handler does not, and must not, invent or supplement
 * match data itself. When a provider is eventually wired in, it would be given exactly this
 * context and asked to narrate/summarize it, never to produce statistics of its own.
 */

export type AIFeature =
  | 'match_report_narrative'
  | 'coaching_summary'
  | 'tactical_recommendation'
  | 'commentary'
  | 'opponent_scouting_summary'

interface AIRequestBody {
  feature: AIFeature
  context: unknown
}

const KNOWN_FEATURES: AIFeature[] = [
  'match_report_narrative',
  'coaching_summary',
  'tactical_recommendation',
  'commentary',
  'opponent_scouting_summary',
]

export async function handleAI(request: Request, env: Env): Promise<Response> {
  // Every AI call is authenticated — never an open/anonymous endpoint, even once a real
  // provider is wired in, since provider calls cost real money per request.
  await verifyFirebaseIdToken(bearerToken(request), env.FIREBASE_PROJECT_ID)

  let body: AIRequestBody
  try {
    body = (await request.json()) as AIRequestBody
  } catch {
    throw new HttpError(400, 'Invalid JSON body.')
  }
  if (!body?.feature || !KNOWN_FEATURES.includes(body.feature)) {
    throw new HttpError(400, `Unknown or missing "feature". Expected one of: ${KNOWN_FEATURES.join(', ')}.`)
  }
  if (body.context == null) {
    throw new HttpError(400, 'Missing "context" — AI requests must carry the platform\'s own deterministic data.')
  }

  if (!env.AI_PROVIDER_API_KEY) {
    return Response.json({
      status: 'not_configured',
      message: 'No AI provider is configured for this environment yet.',
    })
  }

  // Reachable only once AI_PROVIDER_API_KEY is actually bound — not implemented, because doing
  // so today would mean guessing at a provider's request/response shape with no key to test
  // against, which risks shipping a call that silently fails or (worse) a fabricated response
  // dressed up as a real one. The one thing this handler must never do is return a made-up
  // `output` string here — better an honest "not implemented" than fake AI output.
  return Response.json(
    {
      status: 'error',
      message: 'An AI provider key is configured, but the provider call itself is not yet implemented.',
    },
    { status: 501 },
  )
}
