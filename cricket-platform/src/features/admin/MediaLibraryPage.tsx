import { useMemo, useState } from 'react'
import { Image as ImageIcon, Trash2, HardDrive } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, Button, Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { listFolderImages, deleteUploadedImage, type StoredImage } from '@/services/storage.service'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listClubs } from '@/services/clubs.service'
import { listTournaments } from '@/services/tournaments.service'
import { listUsers } from '@/services/users.service'
import { formatBytes, formatDate } from '@/lib/format'

type Folder = 'players' | 'teams' | 'clubs' | 'tournaments' | 'users'

const FOLDERS: { key: Folder; label: string }[] = [
  { key: 'players', label: 'Player photos' },
  { key: 'teams', label: 'Team logos' },
  { key: 'clubs', label: 'Club logos' },
  { key: 'tournaments', label: 'Tournament banners' },
  { key: 'users', label: 'User avatars' },
]

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

  const data = useAsync(async () => {
    const [images, used] = await Promise.all([listFolderImages(folder), inUseUrls(folder)])
    return { images, used }
  }, [folder])

  const totals = useAsync(async () => {
    const perFolder = await Promise.all(FOLDERS.map((f) => listFolderImages(f.key)))
    const all = perFolder.flat()
    return { count: all.length, bytes: all.reduce((s, i) => s + i.size, 0) }
  }, [])

  async function doDelete(img: StoredImage) {
    if (!confirm('Delete this image permanently? This cannot be undone.')) return
    setDeleting(img.path)
    try {
      await deleteUploadedImage(img.url)
      toast.success('Image deleted')
      data.refetch()
      totals.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const images = data.data?.images ?? []
  const used = data.data?.used ?? new Set<string>()
  const unusedCount = useMemo(() => images.filter((i) => !used.has(i.url)).length, [images, used])

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Media library"
        subtitle="Every image uploaded to storage, grouped by where it's used. Delete unused uploads to free up space."
        actions={
          !totals.loading &&
          totals.data && (
            <span className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
              <HardDrive size={15} />
              {totals.data.count} images · {formatBytes(totals.data.bytes)}
            </span>
          )
        }
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

      {data.loading ? (
        <PageLoader />
      ) : images.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={40} />}
          title="No images in this folder"
          description="Uploads will appear here once someone adds a photo or logo."
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
                      onClick={() => doDelete(img)}
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
  )
}
