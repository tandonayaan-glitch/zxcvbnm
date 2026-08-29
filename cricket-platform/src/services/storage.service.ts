import { ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata } from 'firebase/storage'
import { storage, auth } from '@/lib/firebase'
import { genId } from '@/lib/collections'

/*
 * Images now upload to Cloudflare R2 through the crickethub-media Worker (see
 * `worker/`) instead of Firebase Storage — see worker/README.md for the full design.
 * Documents (tournament PDFs) are explicitly NOT part of this migration and still use
 * Firebase Storage unchanged below; only image functions were touched.
 *
 * Existing images uploaded before this migration keep working exactly as before: their
 * URLs still point at Firebase Storage, which is untouched and not being deleted. Every
 * image-listing function below reads BOTH the legacy Firebase Storage folder AND the new
 * R2 folder and merges the results, so a gallery with a mix of old and new photos shows
 * all of them — not just the ones uploaded after cutover.
 */

const R2_WORKER_URL = (import.meta.env.VITE_R2_WORKER_URL ?? '').replace(/\/$/, '')
const R2_PUBLIC_BASE_URL = (import.meta.env.VITE_R2_PUBLIC_URL ?? '').replace(/\/$/, '')

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB — mirrors worker/src/limits.ts; keep both in sync
const MAX_DIMENSION = 800
const JPEG_QUALITY = 0.85
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export class ImageUploadError extends Error {}

/** Downscale + re-encode client-side before upload, so a phone photo doesn't ship a
 *  multi-megabyte original for what's displayed as a small avatar/logo. GIFs are passed
 *  through unresized to preserve animation. Unchanged from the Firebase Storage version —
 *  this step happens entirely in the browser, before the network request exists at all. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  return blob ?? file
}

async function firebaseIdToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new ImageUploadError('You must be signed in.')
  return user.getIdToken()
}

/** Validate, client-side resize/compress, and upload an image to Cloudflare R2 under
 *  `folder/`, returning its public URL. Size/type limits, per-user (100MB) and platform
 *  (9.9GB) storage caps are all re-enforced server-side by the Worker regardless of what
 *  passed here — this is a fast-fail UX layer, never the real gate. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageUploadError('Please choose a JPEG, PNG, WebP or GIF image.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageUploadError('Image is too large (max 5MB).')
  }
  if (!R2_WORKER_URL) {
    throw new ImageUploadError('Image uploads are not configured yet.')
  }

  const isGif = file.type === 'image/gif'
  const blob = isGif ? file : await resizeImage(file)
  const contentType = isGif ? 'image/gif' : 'image/jpeg'
  const ext = isGif ? 'gif' : 'jpg'
  const key = `${folder}/${genId('img_')}.${ext}`

  const token = await firebaseIdToken()
  const res = await fetch(`${R2_WORKER_URL}/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: blob,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ImageUploadError((body as { error?: string } | null)?.error ?? 'Upload failed.')
  }
  const { url } = (await res.json()) as { url: string }
  return url
}

/** Best-effort delete of a previously uploaded image — never throws. Branches on which
 *  backend actually hosts the file: an R2 URL goes through the Worker's authenticated
 *  delete (which also releases the usage-counter reservation); a legacy
 *  `firebasestorage.googleapis.com` URL still deletes via Firebase Storage exactly as
 *  before (that capability isn't being removed — this migration doesn't touch existing
 *  Firebase Storage files or the ability to manage them, it only changes where NEW
 *  uploads go). Anything else (an external link) is left alone either way. */
export async function deleteUploadedImage(url: string): Promise<void> {
  try {
    if (R2_PUBLIC_BASE_URL && url.startsWith(R2_PUBLIC_BASE_URL)) {
      const key = url.slice(R2_PUBLIC_BASE_URL.length + 1)
      const token = await firebaseIdToken()
      await fetch(`${R2_WORKER_URL}/delete?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      return
    }
    if (url.includes('firebasestorage')) {
      await deleteObject(ref(storage, url))
    }
  } catch {
    /* ignore, same convention as before */
  }
}

/** The signed-in user's own current image-storage usage, for the "X of 100MB used"
 *  display. Returns `null` if not signed in or the Worker isn't configured, rather than
 *  throwing — this is a display, not a gate. */
export async function getMyImageUsage(): Promise<{ usedBytes: number; limitBytes: number } | null> {
  if (!R2_WORKER_URL || !auth.currentUser) return null
  try {
    const token = await firebaseIdToken()
    const res = await fetch(`${R2_WORKER_URL}/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return (await res.json()) as { usedBytes: number; limitBytes: number }
  } catch {
    return null
  }
}

export interface StoredImage {
  path: string
  url: string
  size: number
  createdAt: number
}

const MAX_DOC_BYTES = 10 * 1024 * 1024 // 10MB — documents run bigger than a resized photo
const ACCEPTED_DOC_TYPES = ['application/pdf']

export class DocumentUploadError extends Error {}

export interface StoredDocument {
  path: string
  url: string
  name: string
  size: number
  createdAt: number
}

/** Validate and upload a PDF (rulebook, fixture sheet, etc.) to Firebase Storage under
 *  `folder/`, returning its public download URL. Unchanged — documents are explicitly
 *  not part of the R2 migration; only images moved. No resize/compress step — unlike
 *  images, a PDF is uploaded as-is. */
export async function uploadDocument(file: File, folder: string): Promise<string> {
  if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
    throw new DocumentUploadError('Please choose a PDF file.')
  }
  if (file.size > MAX_DOC_BYTES) {
    throw new DocumentUploadError('Document is too large (max 10MB).')
  }
  const fileRef = ref(storage, `${folder}/${genId('doc_')}-${file.name}`)
  await uploadBytes(fileRef, file, { contentType: 'application/pdf' })
  return getDownloadURL(fileRef)
}

/** Best-effort delete of a previously uploaded document — never throws, same convention as
 *  `deleteUploadedImage`. Unchanged — documents stay on Firebase Storage. */
export async function deleteUploadedDocument(url: string): Promise<void> {
  try {
    if (!url.includes('firebasestorage')) return
    await deleteObject(ref(storage, url))
  } catch {
    /* ignore */
  }
}

/** `listAll()` can hang indefinitely (rather than resolving to an empty list, or rejecting)
 *  when a prefix has never had an object uploaded to it — observed directly against this
 *  project's Storage bucket. Race it against a timeout so a never-touched folder shows as
 *  empty instead of hanging the media library page forever. */
async function listAllWithTimeout(folderRef: ReturnType<typeof ref>) {
  const timeout = new Promise<{ items: []; prefixes: [] }>((resolve) =>
    setTimeout(() => resolve({ items: [], prefixes: [] }), 8000),
  )
  return Promise.race([listAll(folderRef), timeout])
}

/*
 * Circuit breaker for the legacy Firebase Storage image listing.
 *
 * Image hosting has moved to R2; the only reason to still call Firebase Storage's
 * `listAll()` is to surface photos uploaded *before* that cutover. In any environment
 * whose Storage bucket has no CORS rule for the app's origin — every local dev setup,
 * and every deployment that finished the R2 migration and dropped its Storage CORS
 * config — that call fails at the network layer (`ERR_FAILED` / CORS), which the browser
 * logs itself once per request. It's caught (galleries still render their R2 images),
 * but a page that lists several folders at once (the Media Library fires five in
 * parallel) turns that into a wall of identical console errors.
 *
 * Two things keep it to at most one failed request per browser session:
 *  - a single shared "can we even list Storage?" probe that every caller awaits, so a
 *    burst of parallel folder listings makes one network call between them, not one each;
 *  - the negative result is remembered in `sessionStorage`, so subsequent navigations
 *    and reloads in the same tab don't re-probe. A fresh tab/session probes once more,
 *    so a newly-added CORS rule is picked up without a code change.
 */
const STORAGE_LIST_BREAKER_KEY = 'ch_fb_storage_list_unavailable'

function storageListBreakerTripped(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_LIST_BREAKER_KEY) === '1'
  } catch {
    return false
  }
}

function tripStorageListBreaker() {
  try {
    sessionStorage.setItem(STORAGE_LIST_BREAKER_KEY, '1')
  } catch {
    /* private mode / storage disabled — the in-memory promise below still de-dupes */
  }
}

let storageListProbe: Promise<boolean> | null = null

/** Resolves `true` once if Firebase Storage listing works from this origin, `false`
 *  (and trips the session breaker) the first time it doesn't. Shared by every caller, so
 *  a burst of parallel folder listings costs one probe request between them. A CORS/network
 *  failure and a hang (the SDK retrying a broken call) both count as "unavailable" — the
 *  timeout here *rejects*, unlike `listAllWithTimeout`'s, which resolves-empty. */
function canListFirebaseStorage(): Promise<boolean> {
  if (!storage || storageListBreakerTripped()) return Promise.resolve(false)
  if (!storageListProbe) {
    const probeTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('storage list probe timed out')), 6000),
    )
    storageListProbe = Promise.race([listAll(ref(storage, 'players')), probeTimeout])
      .then(() => true)
      .catch(() => {
        tripStorageListBreaker()
        return false
      })
  }
  return storageListProbe
}

/** Legacy images already sitting in Firebase Storage from before the R2 migration — kept
 *  working, not deleted, not migrated by this change. Returns `[]` (never throws) when
 *  Storage isn't configured or the session breaker has tripped. */
async function listLegacyFirebaseImages(folder: string): Promise<StoredImage[]> {
  if (!(await canListFirebaseStorage())) return []
  try {
    const { items } = await listAllWithTimeout(ref(storage, folder))
    return await Promise.all(
      items.map(async (item) => {
        const [url, meta] = await Promise.all([getDownloadURL(item), getMetadata(item)])
        return {
          path: item.fullPath,
          url,
          size: meta.size,
          createdAt: new Date(meta.timeCreated).getTime(),
        }
      }),
    )
  } catch {
    tripStorageListBreaker()
    return []
  }
}

/** Images uploaded to R2 since the migration. Unauthenticated — listing isn't privileged,
 *  matching this app's public-read posture for every other piece of cricket data. Resolves
 *  to an empty list (not a throw) if the Worker isn't configured or unreachable, so a
 *  gallery still renders its legacy Firebase Storage photos even if R2 is having a bad day. */
async function listR2Images(folder: string): Promise<StoredImage[]> {
  if (!R2_WORKER_URL) return []
  try {
    const res = await fetch(`${R2_WORKER_URL}/list?folder=${encodeURIComponent(folder)}`)
    if (!res.ok) return []
    const { items } = (await res.json()) as { items: StoredImage[] }
    return items
  } catch {
    return []
  }
}

/** List every image under a given upload folder (`players`, `teams`, `clubs`, `tournaments`,
 *  `users`, or a per-entity gallery subfolder), merging legacy Firebase Storage results with
 *  new R2 results so nothing already uploaded appears to vanish. */
export async function listFolderImages(folder: string): Promise<StoredImage[]> {
  const [legacy, fresh] = await Promise.all([
    listLegacyFirebaseImages(folder).catch(() => [] as StoredImage[]),
    listR2Images(folder),
  ])
  return [...legacy, ...fresh].sort((a, b) => b.createdAt - a.createdAt)
}

/** List every document under a given upload folder (e.g. `tournamentDocuments/{id}`). Strips
 *  the generated `doc_xxxxx-` id prefix back off the filename for display. Documents stay on
 *  Firebase Storage — but the same origin/CORS reality as image listing applies, so this
 *  goes through the shared probe and resolves to `[]` (never throws) when Storage listing
 *  isn't reachable, rather than surfacing an error boundary on the documents panel. */
export async function listFolderDocuments(folder: string): Promise<StoredDocument[]> {
  if (!(await canListFirebaseStorage())) return []
  try {
    const { items } = await listAllWithTimeout(ref(storage, folder))
    const results = await Promise.all(
      items.map(async (item) => {
        const [url, meta] = await Promise.all([getDownloadURL(item), getMetadata(item)])
        return {
          path: item.fullPath,
          url,
          name: item.name.replace(/^doc_[a-z0-9]+-/, ''),
          size: meta.size,
          createdAt: new Date(meta.timeCreated).getTime(),
        }
      }),
    )
    return results.sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    tripStorageListBreaker()
    return []
  }
}
