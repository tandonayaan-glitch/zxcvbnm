/**
 * Clear every remaining non-cricket Firestore collection, leaving ONLY the
 * master admin's own account (users/ + usernameLookup/ are never touched).
 *
 *   node scripts/wipe-orphans.mjs           # dry run: lists targets + counts
 *   node scripts/wipe-orphans.mjs --yes     # actually deletes
 *
 * Wiped whole:
 *   per-user side data
 *     notifications, userPrefs, subscriptions, adminRequests,
 *     invitationRoleGrants, teamInvitationGrants, invitations, teamInvitations
 *   audit / diagnostics
 *     auditLogs, recoveryAttempts, clientErrors
 *   media Worker bookkeeping (see cricket-platform/worker/)
 *     r2Objects (per-file tracking), imageUsage (per-user + _global quota counters)
 *
 * Uses the Firestore REST API over `curl` — NOT `firebase firestore:delete`,
 * which needs gRPC (blocked behind a TLS-intercepting corporate proxy; see
 * CLAUDE.md). Auth is the Firebase CLI's stored OAuth token, refreshed if stale,
 * same approach as wipe-auth-users.mjs / wipe-storage.mjs. Run `firebase login`
 * (or `firebase.cmd login --reauth`) first if the CLI isn't authenticated.
 *
 * The OAuth token carries cloud-platform scope, so these deletes bypass security
 * rules. Idempotent: re-running on an already-empty collection just reports 0.
 *
 * NOT touched: users, usernameLookup (the master admin's docs), settings,
 * featureFlags. Firebase Storage / Cloudflare R2 are separate stores.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--yes')

const TARGETS = [
  'notifications',
  'userPrefs',
  'subscriptions',
  'adminRequests',
  'invitationRoleGrants',
  'teamInvitationGrants',
  'invitations',
  'teamInvitations',
  'auditLogs',
  'recoveryAttempts',
  'clientErrors',
  'r2Objects',
  'imageUsage',
]

// firebase-tools' public installed-app OAuth client (github.com/firebase/firebase-tools, src/api.ts)
const CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

function env() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  const o = {}
  for (const l of raw.split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) o[m[1]] = m[2].trim()
  }
  return o
}
const PROJECT = env().VITE_FIREBASE_PROJECT_ID
if (!PROJECT) throw new Error('VITE_FIREBASE_PROJECT_ID not found in .env.local')
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

/** One curl call, configured from stdin so no secret hits argv. Returns parsed JSON (or {} for empty/204). */
function curlJson(opts) {
  const cfg = ['silent', 'show-error', 'fail-with-body', `url = "${opts.url}"`]
  if (opts.method) cfg.push(`request = "${opts.method}"`)
  for (const [k, v] of Object.entries(opts.headers ?? {})) cfg.push(`header = "${k}: ${v}"`)
  for (const [k, v] of Object.entries(opts.form ?? {})) cfg.push(`data-urlencode = "${k}=${v}"`)
  let out
  try {
    out = execFileSync('curl', ['-K', '-'], { input: cfg.join('\n') + '\n', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    out = e.stdout || ''
    if (!out) throw new Error(`curl failed: ${e.stderr || e.message}`)
  }
  if (!out.trim()) return {}
  try {
    return JSON.parse(out)
  } catch {
    throw new Error(`non-JSON response: ${out.slice(0, 400)}`)
  }
}

function accessToken() {
  const t = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8')).tokens
  if (!t) throw new Error('No Firebase CLI tokens — run `firebase.cmd login --reauth` first.')
  if (t.access_token && t.expires_at && t.expires_at > Date.now() + 60_000) return t.access_token
  const j = curlJson({
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    form: { grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: CLI_CLIENT_ID, client_secret: CLI_CLIENT_SECRET },
  })
  if (!j.access_token) throw new Error(`token refresh failed: ${JSON.stringify(j)}`)
  return j.access_token
}

const AUTH = { Authorization: `Bearer ${accessToken()}` }

/** All document ids in a top-level collection. */
function listDocIds(col) {
  const ids = []
  let pageToken = ''
  do {
    const url = `${BASE}/${col}?pageSize=300&mask.fieldPaths=_none_` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const j = curlJson({ url, headers: AUTH })
    if (j.error) throw new Error(`list ${col} failed (${j.error.code}): ${j.error.message}`)
    for (const d of j.documents ?? []) ids.push(d.name.split('/').pop())
    pageToken = j.nextPageToken ?? ''
  } while (pageToken)
  return ids
}

const plan = TARGETS.map((col) => ({ col, ids: listDocIds(col) }))
console.log(`project : ${PROJECT}\n`)
let grand = 0
for (const { col, ids } of plan) {
  console.log(`${col.padEnd(22)} ${ids.length}`)
  grand += ids.length
}
console.log(`${''.padEnd(22)} ----\n${'total'.padEnd(22)} ${grand}`)

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to permanently delete every document above.')
  process.exit(0)
}

let done = 0
for (const { col, ids } of plan) {
  if (!ids.length) continue
  console.log(`\nDeleting ${col} (${ids.length}) ...`)
  for (const id of ids) {
    const j = curlJson({ method: 'DELETE', url: `${BASE}/${col}/${encodeURIComponent(id)}`, headers: AUTH })
    if (j && j.error) throw new Error(`delete ${col}/${id} failed (${j.error.code}): ${j.error.message}`)
    done++
  }
}

// verify
let left = 0
for (const col of TARGETS) left += listDocIds(col).length
console.log(`\nDeleted ${done}. Remaining across all ${TARGETS.length} collections: ${left}`)
