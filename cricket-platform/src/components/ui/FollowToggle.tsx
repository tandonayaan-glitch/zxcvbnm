import { useEffect, useState } from 'react'
import { Bell, BellPlus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { subscribeIsFollowing, subscribeFollowerCount, followEntity, unfollowEntity } from '@/services/follow.service'
import type { FollowTargetType } from '@/types'

/**
 * Real, backend-tracked follow (distinct from the local-only `<FollowButton>`/`favStore`
 * favorites bookmark) — this is what powers the Following feed and would power notifications.
 * Follower count is a real live count from the `follows` collection, never a placeholder number.
 */
export function FollowToggle({
  targetType,
  targetId,
  className,
}: {
  targetType: FollowTargetType
  targetId: string
  className?: string
}) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const [following, setFollowing] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeIsFollowing(targetType, targetId, setFollowing), [targetType, targetId, profile?.id])
  useEffect(() => subscribeFollowerCount(targetType, targetId, setCount), [targetType, targetId])

  async function toggle() {
    if (!profile) {
      toast.error('Sign in to follow.')
      return
    }
    setBusy(true)
    try {
      if (following) await unfollowEntity(targetType, targetId)
      else await followEntity(targetType, targetId)
    } catch {
      toast.error('Could not update follow status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
        following
          ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900 dark:bg-brand-900/20 dark:text-brand-400'
          : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
        className,
      )}
    >
      {following ? <Bell size={15} /> : <BellPlus size={15} />}
      {following ? 'Following' : 'Follow'}
      {count != null && count > 0 && <span className="text-xs opacity-70">· {count}</span>}
    </button>
  )
}
