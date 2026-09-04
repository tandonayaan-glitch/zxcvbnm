import type { Env } from './types'
import { getDocWithMeta, commitWithPreconditions, type GuardedUpdate } from './firestore'
import { getServiceAccountAccessToken } from './serviceAccountAuth'
import { LIMITS } from './limits'

const MAX_RETRIES = 5

/** Two independent quota pools share this same reserve/release machinery: 'image' (the
 *  original 100MB/user, 9.9GB global caps) and 'video' (match recordings/uploads, its own
 *  larger caps) — kept separate so video never eats into the small image allowance. */
export type UsageScope = 'image' | 'video'

function scopeCollection(scope: UsageScope): string {
  return scope === 'video' ? 'videoUsage' : 'imageUsage'
}
function scopeObjectCollection(scope: UsageScope): string {
  return scope === 'video' ? 'r2VideoObjects' : 'r2Objects'
}
function scopeLimits(scope: UsageScope): { perUser: number; global: number } {
  return scope === 'video'
    ? { perUser: LIMITS.MAX_VIDEO_BYTES_PER_USER, global: LIMITS.MAX_VIDEO_BYTES_GLOBAL }
    : { perUser: LIMITS.MAX_BYTES_PER_USER, global: LIMITS.MAX_BYTES_GLOBAL }
}
function userUsagePath(scope: UsageScope, uid: string): string {
  return `${scopeCollection(scope)}/${uid}`
}
function globalUsagePath(scope: UsageScope): string {
  return `${scopeCollection(scope)}/_global`
}
function objectDocPath(scope: UsageScope, objectId: string): string {
  return `${scopeObjectCollection(scope)}/${objectId}`
}

export class LimitExceededError extends Error {
  scope: 'user' | 'global'
  constructor(scope: 'user' | 'global', message: string) {
    super(message)
    this.scope = scope
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}

/**
 * Atomically checks the per-user (100MB) and global (9.9GB) caps and, if both pass,
 * reserves `sizeBytes` against both counters plus creates the `r2Objects/{objectId}`
 * tracking doc — one Firestore `:commit` call, so a concurrent upload can never observe
 * (or act on) a half-updated state. Retries on optimistic-concurrency conflicts (two
 * uploads racing for the same counter docs). Throws `LimitExceededError` if either cap
 * would be exceeded — nothing is written in that case.
 *
 * MUST be called, and must succeed, BEFORE the actual R2 write (see handlers/upload.ts) —
 * reserving quota first means the counters can never understate real usage even if the R2
 * write fails afterward; the worst case is a reservation that gets rolled back by
 * `releaseUsage`, not a cap silently exceeded.
 */
export async function reserveUsage(
  env: Env,
  scope: UsageScope,
  uid: string,
  objectId: string,
  key: string,
  folder: string,
  sizeBytes: number,
): Promise<void> {
  const { perUser, global } = scopeLimits(scope)
  const kind = scope === 'video' ? 'video' : 'image'
  const token = await getServiceAccountAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY)
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const [userDoc, globalDoc] = await Promise.all([
      getDocWithMeta(env.FIREBASE_PROJECT_ID, token, userUsagePath(scope, uid)),
      getDocWithMeta(env.FIREBASE_PROJECT_ID, token, globalUsagePath(scope)),
    ])
    const userTotal = typeof userDoc.fields.totalBytes === 'number' ? userDoc.fields.totalBytes : 0
    const globalTotal = typeof globalDoc.fields.totalBytes === 'number' ? globalDoc.fields.totalBytes : 0

    if (userTotal + sizeBytes > perUser) {
      throw new LimitExceededError(
        'user',
        `This account has reached its ${mb(perUser)} ${kind} storage allowance.`,
      )
    }
    if (globalTotal + sizeBytes > global) {
      throw new LimitExceededError(
        'global',
        `CricketHub has reached its platform-wide ${kind} storage allowance. Please try again later.`,
      )
    }

    const updates: GuardedUpdate[] = [
      {
        path: userUsagePath(scope, uid),
        fields: { totalBytes: userTotal + sizeBytes, updatedAt: Date.now() },
        previousUpdateTime: userDoc.updateTime,
      },
      {
        path: globalUsagePath(scope),
        fields: { totalBytes: globalTotal + sizeBytes, updatedAt: Date.now() },
        previousUpdateTime: globalDoc.updateTime,
      },
      {
        path: objectDocPath(scope, objectId),
        fields: { key, ownerId: uid, size: sizeBytes, folder, createdAt: Date.now() },
        previousUpdateTime: undefined, // must not already exist
      },
    ]
    try {
      await commitWithPreconditions(env.FIREBASE_PROJECT_ID, token, updates)
      return
    } catch (err) {
      if (isConflict(err) && attempt < MAX_RETRIES - 1) {
        await sleep(50 * (attempt + 1))
        continue
      }
      throw err
    }
  }
}

/**
 * Compensating action for when `reserveUsage` succeeded but the actual R2 write then
 * failed — reverses the reservation and removes the tracking doc, so the counters don't
 * overstate real usage forever. Best-effort with its own retries; if it still fails after
 * retrying, the counters are left *conservatively too high* (never too low) — the safe
 * direction, since it can only make headroom look smaller than it really is, never let
 * anyone exceed the real cap.
 */
export async function releaseUsage(
  env: Env,
  scope: UsageScope,
  uid: string,
  objectId: string,
  sizeBytes: number,
): Promise<void> {
  const token = await getServiceAccountAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY)
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const [userDoc, globalDoc] = await Promise.all([
      getDocWithMeta(env.FIREBASE_PROJECT_ID, token, userUsagePath(scope, uid)),
      getDocWithMeta(env.FIREBASE_PROJECT_ID, token, globalUsagePath(scope)),
    ])
    const userTotal = typeof userDoc.fields.totalBytes === 'number' ? userDoc.fields.totalBytes : 0
    const globalTotal = typeof globalDoc.fields.totalBytes === 'number' ? globalDoc.fields.totalBytes : 0
    const updates: GuardedUpdate[] = [
      {
        path: userUsagePath(scope, uid),
        fields: { totalBytes: Math.max(0, userTotal - sizeBytes), updatedAt: Date.now() },
        previousUpdateTime: userDoc.updateTime,
      },
      {
        path: globalUsagePath(scope),
        fields: { totalBytes: Math.max(0, globalTotal - sizeBytes), updatedAt: Date.now() },
        previousUpdateTime: globalDoc.updateTime,
      },
    ]
    try {
      await commitWithPreconditions(env.FIREBASE_PROJECT_ID, token, updates, [
        { path: objectDocPath(scope, objectId) },
      ])
      return
    } catch (err) {
      if (isConflict(err) && attempt < MAX_RETRIES - 1) {
        await sleep(50 * (attempt + 1))
        continue
      }
      throw err
    }
  }
}

/** Looks up who uploaded a given key and how large it was, so a delete can release the
 *  right amount from the right user's counter. Returns `null` if there's no tracking doc
 *  (e.g. a file that predates this system, or was already cleaned up) — the caller still
 *  deletes the R2 object either way, it just has nothing to release from the counters. */
export async function getTrackedObject(
  env: Env,
  scope: UsageScope,
  objectId: string,
): Promise<{ ownerId: string; size: number } | null> {
  const token = await getServiceAccountAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY)
  const doc = await getDocWithMeta(env.FIREBASE_PROJECT_ID, token, objectDocPath(scope, objectId))
  if (doc.updateTime === undefined) return null
  const { ownerId, size } = doc.fields
  if (typeof ownerId !== 'string' || typeof size !== 'number') return null
  return { ownerId, size }
}

/** Read-only: the caller's own current usage + remaining allowance, for the frontend's
 *  usage display. */
export async function getUserUsage(
  env: Env,
  scope: UsageScope,
  uid: string,
): Promise<{ usedBytes: number; limitBytes: number }> {
  const token = await getServiceAccountAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY)
  const doc = await getDocWithMeta(env.FIREBASE_PROJECT_ID, token, userUsagePath(scope, uid))
  const usedBytes = typeof doc.fields.totalBytes === 'number' ? doc.fields.totalBytes : 0
  return { usedBytes, limitBytes: scopeLimits(scope).perUser }
}

function isConflict(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('CONFLICT')
}
