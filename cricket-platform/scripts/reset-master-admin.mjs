/**
 * Delete the stranded master-admin Firestore docs (users/{uid} +
 * usernameLookup/{username}) so the app's first-run master bootstrap can run
 * again. Use this ONLY when the master admin's Firebase Auth login no longer
 * exists and you intend to recreate it by registering the reserved username in
 * the app.
 *
 *   node scripts/reset-master-admin.mjs           # dry run: shows what it'd delete
 *   node scripts/reset-master-admin.mjs --yes     # delete
 *
 * After running with --yes: open the app, go to Sign up, register username
 * `ayaan` (MASTER_ADMIN_USERNAME) with a fresh password — registerUser() sees no
 * master exists and grants MASTER_ADMIN.
 *
 * REST API over curl + the Firebase CLI's OAuth token (cloud-platform scope,
 * bypasses rules). Run `firebase.cmd login --reauth` first if needed.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--yes')

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
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

function curlJson(opts) {
  const cfg = ['silent', 'show-error', 'fail-with-body', `url = "${opts.url}"`]
  if (opts.method) cfg.push(`request = "${opts.method}"`)
  for (const [k, v] of Object.entries(opts.headers ?? {})) cfg.push(`header = "${k}: ${v}"`)
  for (const [k, v] of Object.entries(opts.form ?? {})) cfg.push(`data-urlencode = "${k}=${v}"`)
  let out
  try {
    out = execFileSync('curl', ['-K', '-'], { input: cfg.join('\n') + '\n', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  } catch (e) {
    out = e.stdout || ''
    if (!out) throw new Error(`curl failed: ${e.stderr || e.message}`)
  }
  if (!out.trim()) return {}
  try { return JSON.parse(out) } catch { throw new Error(`non-JSON response: ${out.slice(0, 400)}`) }
}

function accessToken() {
  const t = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8')).tokens
  if (!t) throw new Error('No Firebase CLI tokens — run `firebase.cmd login --reauth` first.')
  if (t.access_token && t.expires_at && t.expires_at > Date.now() + 60_000) return t.access_token
  const j = curlJson({
    method: 'POST', url: 'https://oauth2.googleapis.com/token',
    form: { grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: CLI_CLIENT_ID, client_secret: CLI_CLIENT_SECRET },
  })
  if (!j.access_token) throw new Error(`token refresh failed: ${JSON.stringify(j)}`)
  return j.access_token
}

const AUTH = { Authorization: `Bearer ${accessToken()}` }
const RESERVED = 'ayaan' // MASTER_ADMIN_USERNAME (src/lib/constants.ts)

function docExists(path) {
  const j = curlJson({ url: `${BASE}/${path}?mask.fieldPaths=_none_`, headers: AUTH })
  return !j.error
}

const list = curlJson({ url: `${BASE}/users?pageSize=300&mask.fieldPaths=role&mask.fieldPaths=username`, headers: AUTH })
if (list.error) throw new Error(`list users failed (${list.error.code}): ${list.error.message}`)
const masters = (list.documents ?? [])
  .map((d) => ({ uid: d.name.split('/').pop(), role: d.fields?.role?.stringValue, username: d.fields?.username?.stringValue }))
  .filter((u) => u.role === 'MASTER_ADMIN')

// Paths to remove: every MASTER_ADMIN user doc + its lookup, plus the reserved
// username lookup even if its user doc is already gone (an orphan still blocks
// re-registration).
const paths = []
for (const m of masters) {
  paths.push(`users/${m.uid}`)
  if (m.username) paths.push(`usernameLookup/${m.username}`)
}
if (!paths.includes(`usernameLookup/${RESERVED}`) && docExists(`usernameLookup/${RESERVED}`)) {
  paths.push(`usernameLookup/${RESERVED}`)
}

console.log(`project : ${PROJECT}`)
console.log(`total users      : ${(list.documents ?? []).length}`)
console.log(`master-admin docs: ${masters.length}`)
console.log(`will delete       : ${paths.length ? paths.join(', ') : '(nothing)'}`)

if (paths.length === 0) {
  console.log('\nNothing to do — no MASTER_ADMIN doc and no stray usernameLookup/ayaan.')
  process.exit(0)
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to delete the paths above.')
  process.exit(0)
}

for (const path of paths) {
  const j = curlJson({ method: 'DELETE', url: `${BASE}/${path}`, headers: AUTH })
  if (j && j.error) throw new Error(`delete ${path} failed (${j.error.code}): ${j.error.message}`)
  console.log(`deleted ${path}`)
}
console.log('\nDone. Now register username `ayaan` in the app to re-bootstrap the master admin.')
