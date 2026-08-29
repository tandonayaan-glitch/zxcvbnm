/**
 * Delete every Firebase Authentication account EXCEPT the master admin.
 *
 *   node scripts/wipe-auth-users.mjs           # dry run: lists accounts, deletes nothing
 *   node scripts/wipe-auth-users.mjs --yes     # actually deletes
 *
 * Firestore tooling cannot touch the Auth service, so this talks to the Identity
 * Toolkit Admin API directly. It authenticates by reusing the Firebase CLI's own
 * stored OAuth credentials:
 *
 *   ~/.config/configstore/firebase-tools.json  ->  tokens.{access_token,refresh_token}
 *
 * If the access token is stale it is refreshed against Google's token endpoint
 * using firebase-tools' public "installed application" client id/secret (these
 * are committed in the open-source firebase-tools repo and are not confidential
 * by OAuth's own definition for native apps). Nothing leaves your machine except
 * the calls to *.googleapis.com for your own project. Run `firebase login` first
 * if the CLI is not authenticated.
 *
 * HTTP goes through the system `curl`, not Node's fetch — behind a TLS-
 * intercepting corporate proxy, curl trusts the OS/corp root CA while Node's
 * bundled CA list does not. Token and refresh_token are passed to curl via a
 * stdin config (`curl -K -`) so they never appear in argv.
 *
 * The account to keep is resolved from Firestore: users where role ==
 * 'MASTER_ADMIN'. Everything else is deleted via accounts:batchDelete.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--yes')

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
const { VITE_FIREBASE_PROJECT_ID: PROJECT, VITE_FIREBASE_API_KEY: API_KEY } = env()

/**
 * One curl invocation, configured entirely from stdin so no secret hits argv.
 * `opts`: { method, url, headers:{}, form:{}, json:<obj> }. Returns parsed JSON.
 */
function curlJson(opts) {
  const cfg = ['silent', 'show-error', 'fail-with-body', `url = "${opts.url}"`]
  if (opts.method) cfg.push(`request = "${opts.method}"`)
  for (const [k, v] of Object.entries(opts.headers ?? {})) cfg.push(`header = "${k}: ${v}"`)
  if (opts.json !== undefined) {
    cfg.push('header = "Content-Type: application/json"')
    cfg.push(`data = ${JSON.stringify(JSON.stringify(opts.json))}`)
  }
  for (const [k, v] of Object.entries(opts.form ?? {})) cfg.push(`data-urlencode = "${k}=${v}"`)

  let out
  try {
    out = execFileSync('curl', ['-K', '-'], {
      input: cfg.join('\n') + '\n',
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (e) {
    out = e.stdout || ''
    if (!out) throw new Error(`curl failed: ${e.stderr || e.message}`)
  }
  try {
    return JSON.parse(out)
  } catch {
    throw new Error(`non-JSON response: ${out.slice(0, 400)}`)
  }
}

function accessToken() {
  const cfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json')
  const t = JSON.parse(readFileSync(cfgPath, 'utf8')).tokens
  if (!t) throw new Error('No Firebase CLI tokens found — run `firebase login` first.')
  if (t.access_token && t.expires_at && t.expires_at > Date.now() + 60_000) return t.access_token
  const j = curlJson({
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    form: {
      grant_type: 'refresh_token',
      refresh_token: t.refresh_token,
      client_id: CLI_CLIENT_ID,
      client_secret: CLI_CLIENT_SECRET,
    },
  })
  if (!j.access_token) throw new Error(`token refresh failed: ${JSON.stringify(j)}`)
  return j.access_token
}

function masterUid() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users` +
    `?key=${API_KEY}&pageSize=1000&mask.fieldPaths=role&mask.fieldPaths=username`
  const j = curlJson({ url })
  const masters = (j.documents ?? []).filter((d) => d.fields?.role?.stringValue === 'MASTER_ADMIN')
  if (masters.length !== 1) throw new Error(`expected 1 MASTER_ADMIN in Firestore, found ${masters.length}`)
  return { uid: masters[0].name.split('/').pop(), username: masters[0].fields?.username?.stringValue }
}

function listAuthUsers(token) {
  const users = []
  let pageToken = ''
  do {
    const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchGet?maxResults=500` +
      (pageToken ? `&nextPageToken=${encodeURIComponent(pageToken)}` : '')
    const j = curlJson({ url, headers: { Authorization: `Bearer ${token}` } })
    if (j.error) throw new Error(`batchGet failed: ${JSON.stringify(j.error)}`)
    users.push(...(j.userInfo ?? []))
    pageToken = j.nextPageToken ?? ''
  } while (pageToken)
  return users
}

const token = accessToken()
const keep = masterUid()
const all = listAuthUsers(token)
const doomed = all.filter((u) => u.localId !== keep.uid)

console.log(`project : ${PROJECT}`)
console.log(`keeping : ${keep.username} (${keep.uid})\n`)
console.log(`auth accounts total : ${all.length}`)
console.log(`to delete           : ${doomed.length}`)
for (const u of doomed) console.log(`  ${u.localId}  ${u.email ?? '(no email)'}`)

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to permanently delete the accounts above.')
  process.exit(0)
}

// accounts:batchDelete takes up to 1000 localIds per call.
for (let i = 0; i < doomed.length; i += 1000) {
  const localIds = doomed.slice(i, i + 1000).map((u) => u.localId)
  const j = curlJson({
    method: 'POST',
    url: `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchDelete`,
    headers: { Authorization: `Bearer ${token}` },
    json: { localIds, force: true },
  })
  if (j.error) throw new Error(`batchDelete failed: ${JSON.stringify(j.error)}`)
  const errs = j.errors ?? []
  console.log(`deleted ${localIds.length - errs.length}/${localIds.length}` +
    (errs.length ? `, ${errs.length} errors: ${JSON.stringify(errs)}` : ''))
}

const remaining = listAuthUsers(token)
console.log(`\nDone. auth accounts remaining: ${remaining.length}`)
for (const u of remaining) console.log(`  ${u.localId}  ${u.email ?? ''}`)
