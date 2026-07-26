import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ImageIcon, Trash2, Upload, Loader2, X } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import {
  listFolderImages,
  uploadImage,
  deleteUploadedImage,
  ImageUploadError,
  type StoredImage,
} from '@/services/storage.service'

/**
 * Match-scoped photo gallery. Read-only for public visitors; scorers/admins for this match get
 * an upload control and a delete button per photo. Uses the same `matches/{id}` Storage folder
 * convention as every other entity's media (`players/{id}`, `teams/{id}`, etc.).
 */
export function MatchGallery({ matchId, canManage }: { matchId: string; canManage: boolean }) {
  const toast = useToast()
  const folder = `matches/${matchId}`
  const images = useAsync(() => listFolderImages(folder), [folder])
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<StoredImage | null>(null)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightbox])

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    let failed = 0
    for (const file of files) {
      try {
        await uploadImage(file, folder)
      } catch (err) {
        failed++
        toast.error(err instanceof ImageUploadError ? err.message : `Upload failed for ${file.name}`)
      }
    }
    setUploading(false)
    images.refetch()
    if (failed < files.length) {
      toast.success(`Uploaded ${files.length - failed} photo${files.length - failed === 1 ? '' : 's'}`)
    }
  }

  async function handleDelete(img: StoredImage) {
    if (!confirm('Remove this photo from the gallery?')) return
    setDeletingPath(img.path)
    try {
      await deleteUploadedImage(img.url)
      toast.success('Photo removed')
      images.refetch()
      if (lightbox?.path === img.path) setLightbox(null)
    } catch {
      toast.error('Could not remove photo')
    } finally {
      setDeletingPath(null)
    }
  }

  const photos = images.data ?? []
  if (!canManage && !images.loading && photos.length === 0) return null

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ImageIcon size={18} className="text-ink-500" /> Match photos
          </span>
        }
        subtitle={canManage ? 'Visible to everyone; only you can add or remove photos.' : undefined}
        action={
          canManage ? (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Add photos
            </button>
          ) : undefined
        }
      />
      <CardBody>
        {canManage && (
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
        )}
        {images.loading ? (
          <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">Loading photos…</p>
        ) : photos.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
            {canManage ? 'No photos yet — add the first one.' : 'No photos yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.map((img) => (
              <div key={img.path} className="group relative aspect-square overflow-hidden rounded-lg">
                <button
                  onClick={() => setLightbox(img)}
                  className="block h-full w-full"
                  aria-label="View photo"
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
                {canManage && (
                  <button
                    onClick={() => handleDelete(img)}
                    disabled={deletingPath === img.path}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-100"
                  >
                    {deletingPath === img.path ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X size={20} />
          </button>
          <img
            src={lightbox.url}
            alt=""
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Card>
  )
}
