/**
 * Delete every object in the project's Firebase Storage bucket.
 *
 *   node scripts/wipe-storage.mjs           # dry run: lists objects, deletes nothing
 *   node scripts/wipe-storage.mjs --yes     # actually deletes
 *   node scripts/wipe-storage.mjs --yes --bucket cricket-platform-b03bc.appspot.com
 *
 * Covers the legacy pre-R2-migration images (players/, teams/, clubs/,
 * tournaments/, matches/, users/) AND the tournament PDF attachments under
 * tournamentDocuments/ (which were never migrated off Firebase Storage).
 *
 * Uses the GCS JSON API with the Firebase CLI's stored OAuth token — same
 * auth + curl approach as wipe-auth-users.mjs (Node fetch can't see a
 * TLS-intercepting corporate proxy's root CA; system curl can). Run
 * `firebase login` first if the CLI is not authenticated.
 *
 * Bucket defaults to VITE_FIREBASE_STORAGE_BUCKET from .env.local. If listing
 * 404s, try the older name with --bucket <project-id>.appspot.com.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const APPLY = argv.includes('--yes')
const bucketArg = (() => {
  const i = argv.indexOf('--bucket')
  return i >= 0 ? argv[i + 1] : null
})()

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
const ENV = env()
const BUCKET = bucketArg || ENV.VITE_FIREBASE_STORAGE_BUCKET
if (!BUCKET) throw new Error('No bucket: set VITE_FIREBASE_STORAGE_BUCKET in .env.local or pass --bucket')

/** One curl call, configured from stdin so no secret hits argv. Returns parsed JSON (or {} for 204). */
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
  if (!t) throw new Error('No Firebase CLI tokens — run `firebase login` first.')
  if (t.access_token && t.expires_at && t.expires_at > Date.now() + 60_000) return t.access_token
  const j = curlJson({
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    form: { grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: CLI_CLIENT_ID, client_secret: CLI_CLIENT_SECRET },
  })
  if (!j.access_token) throw new Error(`token refresh failed: ${JSON.stringify(j)}`)
  return j.access_token
}

const token = accessToken()
const AUTH = { Authorization: `Bearer ${token}` }
const api = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o`

// List every object (paginated).
const objects = []
let pageToken = ''
do {
  const j = curlJson({ url: `${api}?maxResults=1000&fields=items(name,size),nextPageToken` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''), headers: AUTH })
  if (j.error) throw new Error(`list failed (${j.error.code}): ${j.error.message}` + (j.error.code === 404 ? `\n  bucket "${BUCKET}" not found — try --bucket ${(ENV.VITE_FIREBASE_PROJECT_ID || 'PROJECT')}.appspot.com` : ''))
  for (const o of j.items ?? []) objects.push({ name: o.name, size: Number(o.size || 0) })
  pageToken = j.nextPageToken ?? ''
} while (pageToken)

const byFolder = {}
let totalBytes = 0
for (const o of objects) {
  const f = o.name.split('/')[0]
  byFolder[f] = (byFolder[f] || 0) + 1
  totalBytes += o.size
}
console.log(`bucket  : ${BUCKET}`)
console.log(`objects : ${objects.length}  (${(totalBytes / 1048576).toFixed(1)} MB)`)
for (const [f, n] of Object.entries(byFolder)) console.log(`  ${f}/  ${n}`)

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to permanently delete every object above.')
  process.exit(0)
}

let done = 0
for (const o of objects) {
  const j = curlJson({ method: 'DELETE', url: `${api}/${encodeURIComponent(o.name)}`, headers: AUTH })
  if (j && j.error) throw new Error(`delete ${o.name} failed (${j.error.code}): ${j.error.message}`)
  done++
  if (done % 25 === 0 || done === objects.length) console.log(`  deleted ${done}/${objects.length}`)
}

const check = curlJson({ url: `${api}?maxResults=1&fields=items(name)`, headers: AUTH })
console.log(`\nDone. objects remaining: ${(check.items ?? []).length}`)
