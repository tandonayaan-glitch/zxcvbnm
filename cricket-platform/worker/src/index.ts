import type { Env } from './types'
import { HttpError } from './types'
import { handleUpload } from './handlers/upload'
import { handleDelete } from './handlers/deleteObject'
import { handleList } from './handlers/list'
import { handleUsage } from './handlers/usage'

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  }
}

function withCors(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(response.headers)
  for (const [k, v] of Object.entries(headers)) merged.set(k, v)
  return new Response(response.body, { status: response.status, headers: merged })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const url = new URL(request.url)
    try {
      let response: Response
      if (request.method === 'POST' && url.pathname === '/upload') {
        response = await handleUpload(request, env)
      } else if (request.method === 'POST' && url.pathname === '/delete') {
        response = await handleDelete(request, env)
      } else if (request.method === 'GET' && url.pathname === '/list') {
        response = await handleList(request, env)
      } else if (request.method === 'GET' && url.pathname === '/usage') {
        response = await handleUsage(request, env)
      } else {
        response = Response.json({ error: 'Not found.' }, { status: 404 })
      }
      return withCors(response, cors)
    } catch (err) {
      if (err instanceof HttpError) {
        return withCors(Response.json({ error: err.message }, { status: err.status }), cors)
      }
      console.error('Unhandled error', err)
      return withCors(Response.json({ error: 'Internal error.' }, { status: 500 }), cors)
    }
  },
} satisfies ExportedHandler<Env>
