import { ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { genId } from '@/lib/collections'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_DIMENSION = 800
const JPEG_QUALITY = 0.85
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export class ImageUploadError extends Error {}

/** Downscale + re-encode client-side before upload, so a phone photo doesn't ship a
 *  multi-megabyte original for what's displayed as a small avatar/logo. GIFs are passed
 *  through unresized to preserve animation. */
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

/** Validate, client-side resize/compress, and upload an image to Firebase Storage
 *  under `folder/`, returning its public download URL. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageUploadError('Please choose a JPEG, PNG, WebP or GIF image.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageUploadError('Image is too large (max 5MB).')
  }

  if (file.type === 'image/gif') {
    const fileRef = ref(storage, `${folder}/${genId('img_')}.gif`)
    await uploadBytes(fileRef, file, { contentType: 'image/gif' })
    return getDownloadURL(fileRef)
  }

  const blob = await resizeImage(file)
  const fileRef = ref(storage, `${folder}/${genId('img_')}.jpg`)
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(fileRef)
}

/** Best-effort delete of a previously uploaded image — never throws. The URL might be
 *  an external link (not ours to delete) or already gone. */
export async function deleteUploadedImage(url: string): Promise<void> {
  try {
    if (!url.includes('firebasestorage')) return
    await deleteObject(ref(storage, url))
  } catch {
    /* ignore */
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
 *  `folder/`, returning its public download URL. No resize/compress step — unlike images,
 *  a PDF is uploaded as-is. */
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
 *  `deleteUploadedImage`. */
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

/** List every image under a given upload folder (`players`, `teams`, `clubs`, `tournaments`,
 *  `users`), for the media library's housekeeping view. */
export async function listFolderImages(folder: string): Promise<StoredImage[]> {
  const folderRef = ref(storage, folder)
  const { items } = await listAllWithTimeout(folderRef)
  const results = await Promise.all(
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
  return results.sort((a, b) => b.createdAt - a.createdAt)
}

/** List every document under a given upload folder (e.g. `tournamentDocuments/{id}`). Strips
 *  the generated `doc_xxxxx-` id prefix back off the filename for display. */
export async function listFolderDocuments(folder: string): Promise<StoredDocument[]> {
  const folderRef = ref(storage, folder)
  const { items } = await listAllWithTimeout(folderRef)
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
}
