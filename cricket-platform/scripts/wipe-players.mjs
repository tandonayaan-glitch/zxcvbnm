/**
 * Hard-wipe every player and its derived cache from the live Firestore project.
 *
 *   node scripts/wipe-players.mjs           # dry run: prints counts, deletes nothing
 *   node scripts/wipe-players.mjs --yes     # actually deletes
 *
 * Deletes, permanently and with no trash/undo:
 *   - all docs in `players`
 *   - all docs in `playerStats`   (leaderboard cache; rebuildable via "Recompute")
 *   - `entityVersions` docs with entityType == 'player'  (pre-edit snapshots)
 *
 * Match docs keep their denormalized player names / playerIds, and team docs keep
 * their playerIds arrays — those now point at deleted players by design.
 *
 * Reads/counts go over the Firestore REST API (per CLAUDE.md — the Node SDK's
 * gRPC is blocked here). Deletes are done via `firebase firestore:delete`, which
 * uses the already-authenticated Firebase CLI's owner credentials and bypasses
 * security rules.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--yes')

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

/** Page through a top-level collection, returning every doc's short id. */
async function listIds(col, extraParams = '') {
  const ids = []
  let pageToken = ''
  do {
    const url = `${BASE}/${col}?key=${API_KEY}&pageSize=300${extraParams}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`list ${col}: ${res.status} ${await res.text()}`)
    const json = await res.json()
    for (const d of json.documents ?? []) {
      ids.push({ id: d.name.split('/').pop(), fields: d.fields ?? {} })
    }
    pageToken = json.nextPageToken ?? ''
  } while (pageToken)
  return ids
}

function fbDelete(path) {
  // `shell: true` so Windows can launch firebase.cmd (Node >=20 rejects .cmd via execFileSync otherwise)
  execFileSync(
    'firebase',
    ['firestore:delete', path, '--recursive', '--force', '--project', PROJECT],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  )
}

const players = await listIds('players', '&mask.fieldPaths=fullName')
const playerStats = await listIds('playerStats', '&mask.fieldPaths=_none_')
const versions = await listIds('entityVersions', '&mask.fieldPaths=entityType')
const playerVersions = versions.filter(
  (v) => v.fields?.entityType?.stringValue === 'player',
)

console.log(`project        : ${PROJECT}`)
console.log(`players        : ${players.length}`)
console.log(`playerStats    : ${playerStats.length}`)
console.log(`player versions: ${playerVersions.length}`)

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to permanently delete the above.')
  process.exit(0)
}

console.log('\nDeleting `players` ...')
fbDelete('players')
console.log('Deleting `playerStats` ...')
if (playerStats.length) fbDelete('playerStats')
for (const v of playerVersions) {
  console.log(`Deleting entityVersions/${v.id} ...`)
  fbDelete(`entityVersions/${v.id}`)
}

// Verify
const after = await listIds('players', '&mask.fieldPaths=_none_')
const afterStats = await listIds('playerStats', '&mask.fieldPaths=_none_')
console.log(`\nDone. players now: ${after.length}, playerStats now: ${afterStats.length}`)
