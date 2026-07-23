import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { Pagination } from '@/components/ui/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { usePaginated } from '@/hooks/usePaginated'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { listNotifications, markRead, markAllRead } from '@/services/notifications.service'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AppNotification, NotificationCategory } from '@/types'

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  match: 'Match',
  tournament: 'Tournament',
  player: 'Player',
  admin: 'Admin',
  account: 'Account',
  security: 'Security',
}

type ReadFilter = 'all' | 'unread'

export function NotificationsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const notifications = useAsync(
    () => (profile ? listNotifications(profile.id, 500) : Promise.resolve([])),
    [profile?.id],
  )
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | ''>('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')

  const all = notifications.data ?? []
  const filtered = useMemo(() => {
    return all.filter((n) => {
      if (categoryFilter && n.category !== categoryFilter) return false
      if (readFilter === 'unread' && n.read) return false
      return true
    })
  }, [all, categoryFilter, readFilter])

  const { page, setPage, pageCount, pageItems, totalItems, pageSize } = usePaginated(filtered, 20)

  const unreadCount = all.filter((n) => !n.read).length

  async function openItem(n: AppNotification) {
    if (!n.read) {
      await markRead(n.id)
      notifications.refetch()
    }
    if (n.link) navigate(n.link)
  }

  async function markAll() {
    if (!profile) return
    try {
      await markAllRead(profile.id)
      toast.success('All notifications marked read')
      notifications.refetch()
    } catch {
      toast.error('Could not mark all read')
    }
  }

  if (notifications.loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle="Every notification you've received, not just the recent ones in the bell."
        actions={
          unreadCount > 0 && (
            <button
              onClick={markAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          )
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setReadFilter('all')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              readFilter === 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
            )}
          >
            All ({all.length})
          </button>
          <button
            onClick={() => setReadFilter('unread')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              readFilter === 'unread'
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
            )}
          >
            Unread ({unreadCount})
          </button>
          <span className="mx-1 h-4 w-px bg-ink-200 dark:bg-ink-700" />
          <button
            onClick={() => setCategoryFilter('')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              !categoryFilter
                ? 'bg-brand-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
            )}
          >
            Every category
          </button>
          {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((c) => {
            const count = all.filter((n) => n.category === c).length
            if (!count) return null
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  categoryFilter === c
                    ? 'bg-brand-600 text-white'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
                )}
              >
                {CATEGORY_LABELS[c]} ({count})
              </button>
            )
          })}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell size={40} />}
          title="No notifications"
          description={
            readFilter === 'unread'
              ? "You're all caught up."
              : 'Notifications about your account, matches and admin activity will show up here.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-ink-50 dark:divide-ink-800">
            {pageItems.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={cn(
                  'block w-full px-4 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/60',
                  !n.read && 'bg-brand-50/60 dark:bg-brand-900/10',
                )}
              >
                <div className="flex items-start gap-3">
                  {!n.read && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-900 dark:text-ink-50">
                        {n.title}
                      </span>
                      <Badge tone="gray">{CATEGORY_LABELS[n.category]}</Badge>
                    </div>
                    <div className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{n.body}</div>
                    <div className="mt-1 text-xs text-ink-400 dark:text-ink-500">
                      {formatDateTime(n.createdAt)}
                    </div>
                  </div>
                  {n.read && <Check size={14} className="mt-1 shrink-0 text-ink-300 dark:text-ink-600" />}
                </div>
              </button>
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            totalItems={totalItems}
            pageSize={pageSize}
            onChange={setPage}
          />
        </Card>
      )}
    </div>
  )
}
