import { Heart } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useFavStore, type FavKind } from '@/store/favStore'

export function FollowButton({
  kind,
  id,
  className,
}: {
  kind: FavKind
  id: string
  className?: string
}) {
  const isFav = useFavStore((s) => s.favs[kind].includes(id))
  const toggle = useFavStore((s) => s.toggle)

  return (
    <button
      onClick={() => toggle(kind, id)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
        isFav
          ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400'
          : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
        className,
      )}
    >
      <Heart size={15} className={isFav ? 'fill-red-500 text-red-500' : ''} />
      {isFav ? 'Following' : 'Follow'}
    </button>
  )
}
