import { useRef, useState, type DragEvent } from 'react'
import { Image as ImageIcon, Trash2, HardDrive, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, Button, Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import {
  listFolderImages,
  deleteUploadedImage,
  uploadImage,
  ImageUploadError,
  type StoredImage,
} from '@/services/storage.service'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listClubs } from '@/services/clubs.service'
import { listTournaments } from '@/services/tournaments.service'
import { listUsers } from '@/services/users.service'
import { formatBytes, formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'

type Folder = 'players' | 'teams' | 'clubs' | 'tournaments' | 'users'

const FOLDERS: { key: Folder; label: string }[] = [
  { key: 'players', label: 'Player photos' },
  { key: 'teams', label: 'Team logos' },
  { key: 'clubs', label: 'Club logos' },
  { key: 'tournaments', label: 'Tournament banners' },
  { key: 'users', label: 'User avatars' },
]

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/** Which entities reference an image URL in this folder, so unused uploads (deleted entity,
 *  or replaced photo whose old file was never cleaned up) can be flagged for removal. */
async function inUseUrls(folder: Folder): Promise<Set<string>> {
  switch (folder) {
    case 'players':
      return new Set((await listPlayers()).map((p) => p.photoURL).filter(Boolean) as string[])
    case 'teams':
      return new Set((await listTeams()).map((t) => t.logoURL).filter(Boolean) as string[])
    case 'clubs':
      return new Set((await listClubs()).map((c) => c.logoURL).filter(Boolean) as string[])
    case 'tournaments':
      return new Set(
        (await listTournaments()).map((t) => t.bannerURL).filter(Boolean) as string[],
      )
    case 'users':
      return new Set((await listUsers()).map((u) => u.photoURL).filter(Boolean) as string[])
  }
}

export function MediaLibraryPage() {
  const toast = useToast()
  const [folder, setFolder] = useState<Folder>('players')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmImg, setConfirmImg] = useState<StoredImage | null>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const data = useAsync(async () => {
    const [images, used] = await Promise.all([listFolderImages(folder), inUseUrls(folder)])
    return { images, used }
  }, [folder])

  const totals = useAsync(async () => {
    const perFolder = await Promise.all(FOLDERS.map((f) => listFolderImages(f.key)))
    const all = perFolder.flat()
    return { count: all.length, bytes: all.reduce((s, i) => s + i.size, 0) }
  }, [])

  const folderLabel = FOLDERS.find((f) => f.key === folder)?.label ?? folder

  /** Upload one or more picked/dropped images into the currently-open folder,
   *  reusing the same `uploadImage()` (client resize/compress → R2 Worker) that
   *  every other image field in the app uses. Per-file errors are surfaced but
   *  never abort the batch; the gallery refreshes once at the end. */
  async function ingest(files: FileList | File[] | null) {
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))
    if (picked.length === 0) return
    if (uploading) return
    setUploading({ done: 0, total: picked.length })
    let ok = 0
    for (let i = 0; i < picked.length; i++) {
      try {
        await uploadImage(picked[i], folder)
        ok++
      } catch (e) {
        toast.error(
          `${picked[i].name}: ${
            e instanceof ImageUploadError ? e.message : e instanceof Error ? e.message : 'upload failed'
          }`,
        )
      }
      setUploading({ done: i + 1, total: picked.length })
    }
    setUploading(null)
    if (ok > 0) {
      toast.success(`Uploaded ${ok} image${ok === 1 ? '' : 's'} to ${folderLabel}`)
      data.refetch()
      totals.refetch()
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    void ingest(e.dataTransfer.files)
  }

  /** Runs from <ConfirmDialog>; rethrows so the dialog shows the real reason inline and stays
   *  open rather than the button appearing to do nothing. */
  async function doDelete(img: StoredImage) {
    setDeleting(img.path)
    try {
      await deleteUploadedImage(img.url)
      toast.success('Image deleted')
      data.refetch()
      totals.refetch()
    } finally {
      setDeleting(null)
    }
  }

  const images = data.data?.images ?? []
  const used = data.data?.used ?? new Set<string>()
  const unusedCount = images.filter((i) => !used.has(i.url)).length

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Media library"
        subtitle="Every image uploaded to storage, grouped by where it's used. Upload new images or delete unused uploads to free up space."
        actions={
          <div className="flex items-center gap-3">
            {!totals.loading && totals.data && (
              <span className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
                <HardDrive size={15} />
                {totals.data.count} images · {formatBytes(totals.data.bytes)}
              </span>
            )}
            <Button
              onClick={() => inputRef.current?.click()}
              loading={!!uploading}
              disabled={!!uploading}
            >
              <Upload size={16} />
              {uploading ? `Uploading ${uploading.done}/${uploading.total}…` : 'Upload'}
            </Button>
          </div>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void ingest(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFolder(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              folder === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-xl border-2 border-dashed p-4 transition-colors',
          dragOver
            ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30'
            : 'border-transparent',
        )}
      >
        {data.loading ? (
          <PageLoader />
        ) : images.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={40} />}
            title="No images in this folder"
            description={`Drop images here or use Upload to add ${folderLabel.toLowerCase()}.`}
            action={
              <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={!!uploading}>
                <Upload size={15} /> Upload images
              </Button>
            }
          />
        ) : (
          <>
            {unusedCount > 0 && (
              <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                {unusedCount} unused {unusedCount === 1 ? 'image' : 'images'} in this folder — no
                current player, team, club, tournament, or user references it.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((img) => {
                const isUnused = !used.has(img.url)
                return (
                  <Card key={img.path} className="overflow-hidden p-0">
                    <div className="relative aspect-square bg-ink-100 dark:bg-ink-800">
                      <img
                        src={img.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {isUnused && (
                        <span className="absolute left-1.5 top-1.5">
                          <Badge tone="amber">Unused</Badge>
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 p-2">
                      <p className="text-xs text-ink-500 dark:text-ink-400">
                        {formatBytes(img.size)} · {formatDate(img.createdAt)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        block
                        loading={deleting === img.path}
                        disabled={!!deleting}
                        onClick={() => setConfirmImg(img)}
                      >
                        <Trash2 size={13} /> Delete
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmImg}
        title="Delete image"
        message="Delete this image permanently? This cannot be undone, and anything still using it will lose its picture."
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          if (confirmImg) await doDelete(confirmImg)
        }}
        onClose={() => setConfirmImg(null)}
      />
    </div>
  )
}
