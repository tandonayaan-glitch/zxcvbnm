/**
 * Minimal Firestore REST v1 client — just what this Worker needs, nothing more.
 * Two access modes:
 *  - `getPublicDoc`: a plain, unauthenticated GET. Only ever used for `/users/{uid}`, which
 *    `firestore.rules` already sets to `allow read: if true` — no privilege involved.
 *  - `commitWithPreconditions` (+ `getDocWithMeta`): authenticated with the service-account
 *    access token from `serviceAccountAuth.ts`, which BYPASSES `firestore.rules` entirely.
 *    Used only for `imageUsage`/`r2Objects`, which are locked to `allow write: if false` for
 *    every client-facing request — this Worker is the only writer, by construction.
 *
 * Atomicity for the usage counters doesn't use Firestore's `:beginTransaction` RPC — instead
 * it reads each document's `updateTime` and commits with a `currentDocument` precondition
 * (`updateTime` must still match, or the doc must still not exist). Firestore's `:commit` is
 * atomic across every write in one call, so two documents (a user's counter + the global
 * counter) plus the object-tracking write/delete all land together or not at all. On a
 * precondition mismatch (someone else wrote to one of these docs in the meantime), the
 * caller re-reads and retries — the same optimistic-concurrency pattern a real
 * `runTransaction()` uses internally, just spelled out explicitly over REST.
 */

export type FieldValue = string | number | boolean

interface DocMeta {
  /** Full resource name, needed for `commit`'s `document`/`currentDocument` targets. */
  name: string
  fields: Record<string, FieldValue>
  /** `undefined` means the document does not exist yet. */
  updateTime: string | undefined
}

function docsRoot(projectId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
}

function fullName(projectId: string, path: string): string {
  return `projects/${projectId}/databases/(default)/documents/${path}`
}

function encodeFields(obj: Record<string, FieldValue>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') fields[k] = { stringValue: v }
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v }
    else fields[k] = { integerValue: String(Math.trunc(v)) }
  }
  return fields
}

function decodeFields(fields: Record<string, Record<string, unknown>> | undefined): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {}
  for (const [k, v] of Object.entries(fields ?? {})) {
    if ('stringValue' in v) out[k] = v.stringValue as string
    else if ('booleanValue' in v) out[k] = v.booleanValue as boolean
    else if ('integerValue' in v) out[k] = Number(v.integerValue as string)
    else if ('doubleValue' in v) out[k] = Number(v.doubleValue as number)
  }
  return out
}

/** Plain, unauthenticated GET — public data only (see file header). */
export async function getPublicDoc(
  projectId: string,
  path: string,
): Promise<Record<string, FieldValue> | null> {
  const res = await fetch(`${docsRoot(projectId)}/${path}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore public read failed: ${res.status} ${await res.text()}`)
  const doc = (await res.json()) as { fields?: Record<string, Record<string, unknown>> }
  return decodeFields(doc.fields)
}

/** Authenticated GET, returning enough metadata (`updateTime`) to commit a guarded write
 *  against this exact version of the document afterward. */
export async function getDocWithMeta(
  projectId: string,
  accessToken: string,
  path: string,
): Promise<DocMeta> {
  const name = fullName(projectId, path)
  const res = await fetch(`${docsRoot(projectId)}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) return { name, fields: {}, updateTime: undefined }
  if (!res.ok) throw new Error(`Firestore read failed: ${res.status} ${await res.text()}`)
  const doc = (await res.json()) as {
    fields?: Record<string, Record<string, unknown>>
    updateTime: string
  }
  return { name, fields: decodeFields(doc.fields), updateTime: doc.updateTime }
}

export interface GuardedUpdate {
  path: string
  fields: Record<string, FieldValue>
  /** `updateTime` from a prior `getDocWithMeta` call, or `undefined` if the doc didn't exist
   *  yet — the precondition Firestore checks before applying this write. */
  previousUpdateTime: string | undefined
}

export interface GuardedDelete {
  path: string
}

/** A single `:commit` call is atomic across every write it contains — this is what makes
 *  "update two counters and create/delete one tracking doc" a single all-or-nothing
 *  operation without needing a full multi-document transaction RPC. Throws with a
 *  `CONFLICT` marker on precondition failure (caller should re-read and retry); throws
 *  plainly on any other failure. */
export async function commitWithPreconditions(
  projectId: string,
  accessToken: string,
  updates: GuardedUpdate[],
  deletes: GuardedDelete[] = [],
): Promise<void> {
  const writes = [
    ...updates.map((u) => ({
      update: { name: fullName(projectId, u.path), fields: encodeFields(u.fields) },
      currentDocument:
        u.previousUpdateTime === undefined
          ? { exists: false }
          : { updateTime: u.previousUpdateTime },
    })),
    // Unconditional — nothing else ever writes to an r2Objects tracking doc after it's
    // created, so there's no concurrent-modification case to guard against here, and a
    // delete of an already-gone doc is harmless (idempotent) rather than an error.
    ...deletes.map((d) => ({ delete: fullName(projectId, d.path) })),
  ]
  const res = await fetch(`${docsRoot(projectId)}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
  if (res.status === 409 || res.status === 400) {
    const text = await res.text()
    if (/FAILED_PRECONDITION|ABORTED|already exists|precondition/i.test(text)) {
      throw new Error(`CONFLICT: ${text}`)
    }
    throw new Error(`Firestore commit failed: ${res.status} ${text}`)
  }
  if (!res.ok) {
    throw new Error(`Firestore commit failed: ${res.status} ${await res.text()}`)
  }
}
