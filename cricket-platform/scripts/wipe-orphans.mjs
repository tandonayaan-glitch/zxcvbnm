/**
 * Sweep per-user "side" collections after a user wipe. With only the master
 * admin left, every doc in these collections is orphaned, so each is cleared
 * whole:
 *   - notifications          (notification-center entries)
 *   - userPrefs              (cross-device appearance / a11y prefs)
 *   - subscriptions          (mock billing)
 *   - adminRequests          (tournament-manager promotion requests)
 *   - invitationRoleGrants   (rules-only role-grant mirrors)
 *   - teamInvitationGrants   (rules-only team-grant mirrors)
 *   - invitations            (pending role invites)
 *   - teamInvitations        (pending team-roster invites)
 *
 * The master admin's own prefs / notification history go too — both are
 * regenerated on next login / use, so this is harmless.
 *
 * Left intact: auditLogs, recoveryAttempts (audit trails), settings,
 * featureFlags, clientErrors.
 *
 *   node scripts/wipe-orphans.mjs           # dry run: lists targets
 *   node scripts/wipe-orphans.mjs --yes     # actually deletes
 *
 * Deletes use `firebase firestore:delete` with the authenticated Firebase CLI's
 * owner credentials (bypasses security rules).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

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
]

function projectId() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  const m = raw.match(/^\s*VITE_FIREBASE_PROJECT_ID\s*=\s*(.+)\s*$/m)
  if (!m) throw new Error('VITE_FIREBASE_PROJECT_ID not found in .env.local')
  return m[1].trim()
}

const PROJECT = projectId()

function fbDelete(path) {
  // `shell: true` so Windows can launch firebase.cmd (Node >=20 rejects .cmd via execFileSync otherwise)
  execFileSync(
    'firebase',
    ['firestore:delete', path, '--recursive', '--force', '--project', PROJECT],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  )
}

console.log(`project : ${PROJECT}`)
console.log(`targets : ${TARGETS.join(', ')}\n`)

if (!APPLY) {
  console.log('Dry run. Re-run with --yes to recursively delete every collection above.')
  process.exit(0)
}

for (const col of TARGETS) {
  console.log(`Deleting \`${col}\` (recursive) ...`)
  fbDelete(col)
}
console.log('\nDone.')
