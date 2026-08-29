/**
 * Full competition reset for the live Firestore project — deletes matches,
 * tournaments, teams, and every cached/derived record built from them.
 *
 *   node scripts/wipe-competition.mjs           # dry run: prints counts, deletes nothing
 *   node scripts/wipe-competition.mjs --yes     # actually deletes
 *
 * Deletes, permanently and with no trash/undo (each --recursive, so nested
 * subcollections go too):
 *   - matches           (+ deliveries / ballMeta / reactions subcollections)
 *   - tournaments        (+ standings subcollection = per-tournament rankings)
 *   - teams
 *   - teamStats          (team leaderboard cache)
 *   - activity           (activity feed)
 *   - entityVersions     (pre-edit snapshots)
 *
 * Leaves user accounts, settings, and auth untouched. Run wipe-players.mjs first
 * if you also want players / playerStats gone.
 *
 * Counts go over the Firestore REST API (per CLAUDE.md — the Node SDK's gRPC is
 * blocked here). Deletes use `firebase firestore:delete`, which runs with the
 * already-authenticated Firebase CLI's owner credentials and bypasses rules.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--yes')

const TARGETS = ['matches', 'tournaments', 'teams', 'teamStats', 'activity', 'entityVersions']

function readEnv() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const env = readEnv()
const PROJECT = env.VITE_FIREBASE_PROJECT_ID
const API_KEY = env.VITE_FIREBASE_API_KEY
if (!PROJECT || !API_KEY) {
  console.error('Missing VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_API_KEY in .env.local')
  process.exit(1)
}
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

async function countCol(col) {
  let total = 0
  let pageToken = ''
  do {
    const url = `${BASE}/${col}?key=${API_KEY}&pageSize=300&mask.fieldPaths=_none_` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`count ${col}: ${res.status} ${await res.text()}`)
    const json = await res.json()
    total += (json.documents ?? []).length
    pageToken = json.nextPageToken ?? ''
  } while (pageToken)
  return total
}

function fbDelete(path) {
  // `shell: true` so Windows can launch firebase.cmd (Node >=20 rejects .cmd via execFileSync otherwise)
  execFileSync(
    'firebase',
    ['firestore:delete', path, '--recursive', '--force', '--project', PROJECT],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  )
}

console.log(`project : ${PROJECT}\n`)
for (const col of TARGETS) {
  console.log(`${col.padEnd(16)} ${await countCol(col)}`)
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to permanently delete the above (recursively).')
  process.exit(0)
}

for (const col of TARGETS) {
  console.log(`\nDeleting \`${col}\` (recursive) ...`)
  fbDelete(col)
}

console.log('\nVerifying ...')
for (const col of TARGETS) {
  console.log(`${col.padEnd(16)} ${await countCol(col)}`)
}
console.log('\nDone.')
