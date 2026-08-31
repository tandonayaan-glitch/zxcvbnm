import { useState } from 'react'
import { Megaphone, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { Button, Card, CardBody, Input, Textarea } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { confirmDialog } from '@/components/ui/confirm'
import { useAsync } from '@/hooks/useAsync'
import {
  listAnnouncements,
  createAnnouncement,
  togglePin,
  deleteAnnouncement,
} from '@/services/announcements.service'
import { formatDateTime } from '@/lib/format'
import type { UserProfile } from '@/types'

export function AnnouncementsPanel({
  tournamentId,
  tournamentOwnerId,
  canManage,
  profile,
}: {
  tournamentId: string
  tournamentOwnerId: string | undefined
  canManage: boolean
  profile: UserProfile | null
}) {
  const toast = useToast()
  const announcements = useAsync(() => listAnnouncements(tournamentId), [tournamentId])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!profile || !title.trim() || !body.trim()) return
    setSaving(true)
    try {
      await createAnnouncement(tournamentId, tournamentOwnerId, title, body, profile)
      setTitle('')
      setBody('')
      setShowForm(false)
      announcements.refetch()
      toast.success('Announcement posted')
    } catch {
      toast.error('Could not post announcement')
    } finally {
      setSaving(false)
    }
  }

  async function onTogglePin(id: string, pinned: boolean) {
    try {
      await togglePin(id, !pinned)
      announcements.refetch()
    } catch {
      toast.error('Could not update announcement')
    }
  }

  async function onDelete(id: string) {
    if (!(await confirmDialog({ title: 'Delete announcement', message: 'Delete this announcement? This cannot be undone.', confirmLabel: 'Delete' }))) return
    try {
      await deleteAnnouncement(id)
      announcements.refetch()
    } catch {
      toast.error('Could not delete announcement')
    }
  }

  const list = announcements.data ?? []

  return (
    <div>
      {canManage && (
        <div className="mb-4">
          {showForm ? (
            <Card className="p-4">
              <div className="space-y-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title"
                  autoFocus
                />
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="What do spectators need to know?"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={submit} loading={saving} disabled={!title.trim() || !body.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              <Plus size={14} /> New announcement
            </button>
          )}
        </div>
      )}

      {announcements.loading ? (
        <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">Loading…</p>
      ) : list.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
          No announcements yet.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id} className={a.pinned ? 'border-amber-300 dark:border-amber-700' : ''}>
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {a.pinned && <Pin size={14} className="text-amber-600" />}
                    <h3 className="font-semibold text-ink-900 dark:text-ink-50">{a.title}</h3>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => onTogglePin(a.id, a.pinned)}
                        aria-label={a.pinned ? 'Unpin' : 'Pin'}
                        title={a.pinned ? 'Unpin' : 'Pin'}
                        className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 dark:text-ink-500 dark:hover:bg-ink-800"
                      >
                        {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        onClick={() => onDelete(a.id)}
                        aria-label="Delete announcement"
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-300">
                  {a.body}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs text-ink-400 dark:text-ink-500">
                  <Megaphone size={11} /> {a.createdByName} · {formatDateTime(a.createdAt)}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
