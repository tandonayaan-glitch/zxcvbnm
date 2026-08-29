/**
 * Delete every image in the Cloudflare R2 bucket behind the media Worker.
 *
 *   node scripts/wipe-r2.mjs --worker https://crickethub-media-worker.<sub>.workers.dev
 *   node scripts/wipe-r2.mjs --worker <url> --yes
 *
 * Enumerates objects through the Worker's own public GET /list?folder=<f>
 * endpoint (unauthenticated by design — see worker/src/handlers/list.ts), then
 * deletes each with `npx wrangler r2 object delete`, which uses your existing
 * `wrangler login` (or CLOUDFLARE_API_TOKEN). Run from anywhere; wrangler is
 * invoked inside cricket-platform/worker/ where it's installed.
 *
 * Folders swept: players, teams, clubs, tournaments, users, matches
 * (worker/src/limits.ts KNOWN_FOLDERS).
 *
 * The r2Objects / imageUsage Firestore bookkeeping for these files is cleared
 * separately by wipe-orphans.mjs.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_DIR = resolve(ROOT, 'worker')
const argv = process.argv.slice(2)
const APPLY = argv.includes('--yes')
const workerUrl = (() => {
  const i = argv.indexOf('--worker')
  return i >= 0 ? argv[i + 1]?.replace(/\/$/, '') : null
})()
const bucket = (() => {
  const i = argv.indexOf('--bucket')
  if (i >= 0) return argv[i + 1]
  const m = readFileSync(resolve(WORKER_DIR, 'wrangler.toml'), 'utf8').match(/bucket_name\s*=\s*"([^"]+)"/)
  return m ? m[1] : 'crickethub-media'
})()

if (!workerUrl) {
  console.error('Required: --worker <deployed media Worker base URL>')
  console.error('  e.g. node scripts/wipe-r2.mjs --worker https://crickethub-media-worker.YOURSUB.workers.dev')
  process.exit(1)
}

const FOLDERS = ['players', 'teams', 'clubs', 'tournaments', 'users', 'matches']

function curlJson(url) {
  const cfg = ['silent', 'show-error', 'fail-with-body', `url = "${url}"`]
  let out
  try {
    out = execFileSync('curl', ['-K', '-'], { input: cfg.join('\n') + '\n', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    out = e.stdout || ''
    if (!out) throw new Error(`curl failed: ${e.stderr || e.message}`)
  }
  try {
    return JSON.parse(out)
  } catch {
    throw new Error(`non-JSON from ${url}: ${out.slice(0, 300)}`)
  }
}

function wrangler(args) {
  execFileSync('npx', ['wrangler', ...args], { cwd: WORKER_DIR, stdio: 'inherit', shell: true })
}

const keys = []
for (const folder of FOLDERS) {
  const j = curlJson(`${workerUrl}/list?folder=${folder}`)
  if (j.error) throw new Error(`/list?folder=${folder} -> ${j.error}`)
  const paths = (j.items ?? []).map((it) => it.path)
  console.log(`${folder.padEnd(12)} ${paths.length}`)
  keys.push(...paths)
}
console.log(`\nbucket : ${bucket}\ntotal  : ${keys.length} objects`)

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to delete every object above via wrangler.')
  process.exit(0)
}

let done = 0
for (const key of keys) {
  wrangler(['r2', 'object', 'delete', `${bucket}/${key}`, '--remote'])
  done++
  console.log(`  ${done}/${keys.length}  ${key}`)
}
console.log('\nDone. Re-run without --yes to confirm all folders now list 0.')
