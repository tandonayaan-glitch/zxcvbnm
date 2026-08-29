/**
 * Remove every user account from the live project EXCEPT the master admin.
 *
 *   node scripts/wipe-users.mjs           # dry run: lists what would be deleted
 *   node scripts/wipe-users.mjs --yes     # actually deletes
 *
 * Keeps only the master admin (role === 'MASTER_ADMIN'). Deletes, permanently:
 *   - users/{uid}            for every non-master account
 *   - usernameLookup/{name}  whose uid is a deleted account
 *
 * Does NOT touch Firebase Auth (the email/password logins) — Firestore has no
 * access to that. It also leaves per-user side docs (notifications, userPrefs,
 * subscriptions, adminRequests) which this script only *counts* for you.
 *
 * Counts go over the Firestore REST API (per CLAUDE.md — the Node SDK's gRPC is
 * blocked here). Deletes use `firebase firestore:delete` with the authenticated
 * Firebase CLI's owner credentials (bypasses security rules).
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

async function listCol(col, params = '') {
  const out = []
  let pageToken = ''
  do {
    const url = `${BASE}/${col}?key=${API_KEY}&pageSize=300${params}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`list ${col}: ${res.status} ${await res.text()}`)
    const json = await res.json()
    for (const d of json.documents ?? []) out.push({ id: d.name.split('/').pop(), fields: d.fields ?? {} })
    pageToken = json.nextPageToken ?? ''
  } while (pageToken)
  return out
}

const S = (f) => (f ? f.stringValue ?? '' : '')

function fbDelete(path) {
  // `shell: true` so Windows can launch firebase.cmd (Node >=20 rejects .cmd via execFileSync otherwise)
  execFileSync(
    'firebase',
    ['firestore:delete', path, '--force', '--project', PROJECT],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  )
}

const users = await listCol('users', '&mask.fieldPaths=username&mask.fieldPaths=role')
const lookups = await listCol('usernameLookup', '&mask.fieldPaths=uid')

const masters = users.filter((u) => S(u.fields.role) === 'MASTER_ADMIN')
if (masters.length !== 1) {
  console.error(`Expected exactly 1 MASTER_ADMIN, found ${masters.length}. Aborting.`)
  process.exit(1)
}
const keepUid = masters[0].id
const doomedUsers = users.filter((u) => u.id !== keepUid)
const doomedUids = new Set(doomedUsers.map((u) => u.id))
const doomedLookups = lookups.filter((l) => doomedUids.has(S(l.fields.uid)))

console.log(`project : ${PROJECT}`)
console.log(`keeping : ${S(masters[0].fields.username)} (${keepUid}) — MASTER_ADMIN\n`)
console.log(`users to delete        : ${doomedUsers.length}`)
doomedUsers.forEach((u) => console.log(`  users/${u.id}  ${S(u.fields.username)}  ${S(u.fields.role)}`))
console.log(`usernameLookup to delete: ${doomedLookups.length}`)
doomedLookups.forEach((l) => console.log(`  usernameLookup/${l.id}`))

// Orphan side-data — counted only, not deleted.
for (const col of ['notifications', 'userPrefs', 'subscriptions', 'adminRequests', 'recoveryAttempts']) {
  try {
    const rows = await listCol(col, '&mask.fieldPaths=userId&mask.fieldPaths=uid')
    const related = rows.filter((r) => doomedUids.has(r.id) || doomedUids.has(S(r.fields.userId)) || doomedUids.has(S(r.fields.uid)))
    console.log(`orphan ${col.padEnd(18)}: ${related.length} / ${rows.length} total  (left in place)`)
  } catch (e) {
    console.log(`orphan ${col.padEnd(18)}: n/a (${String(e.message).split('\n')[0]})`)
  }
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --yes to permanently delete users + usernameLookup above.')
  process.exit(0)
}

console.log('\nDeleting users ...')
for (const u of doomedUsers) fbDelete(`users/${u.id}`)
console.log('\nDeleting usernameLookup ...')
for (const l of doomedLookups) fbDelete(`usernameLookup/${l.id}`)

const afterUsers = await listCol('users', '&mask.fieldPaths=username&mask.fieldPaths=role')
console.log(`\nDone. users remaining: ${afterUsers.length}`)
afterUsers.forEach((u) => console.log(`  ${S(u.fields.username)}  ${S(u.fields.role)}`))
