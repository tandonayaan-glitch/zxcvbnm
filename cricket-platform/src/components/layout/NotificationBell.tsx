import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { usePrefsStore } from '@/store/prefsStore'
import { subscribeNotifications, markRead, markAllRead } from '@/services/notifications.service'
import { formatDateTime } from '@/lib/format'
import type { AppNotification } from '@/types'

export function NotificationBell() {
  const profile = useAuthStore((s) => s.profile)
  const muted = usePrefsStore((s) => s.prefs.notifyMuted)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile) return
    return subscribeNotifications(profile.id, setItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the id should retrigger the subscription
  }, [profile?.id])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const visible = items.filter((n) => !muted.includes(n.category))
  const unreadCount = visible.filter((n) => !n.read).length

  async function openItem(n: AppNotification) {
    if (!n.read) await markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  async function markAll() {
    if (!profile) return
    await markAllRead(profile.id)
  }

  if (!profile) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center rounded-full border border-ink-300 bg-white p-2 text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-ink-200 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
              >
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500 dark:text-ink-400">
                You're all caught up.
              </p>
            ) : (
              visible.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    'block w-full border-b border-ink-50 px-4 py-3 text-left last:border-b-0 hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/60',
                    !n.read && 'bg-brand-50/60 dark:bg-brand-900/10',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-900 dark:text-ink-50">
                        {n.title}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{n.body}</div>
                      <div className="mt-1 text-[11px] text-ink-400 dark:text-ink-500">
                        {formatDateTime(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
