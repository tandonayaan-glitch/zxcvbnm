import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
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
