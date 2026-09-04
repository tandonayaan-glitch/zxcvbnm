import { useEffect, useMemo, useState } from 'react'
import { Plus, MapPin, Calendar, Users2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, PageLoader, EmptyState, Button, Badge, Select } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import {
  subscribeLookingForPosts,
  createLookingForPost,
  closeLookingForPost,
  respondToLookingForPost,
  subscribeResponsesFor,
  setResponseStatus,
} from '@/services/lookingFor.service'
import { formatDate } from '@/lib/format'
import type { LookingForPost, LookingForKind, LookingForResponse } from '@/types'

const KIND_LABEL: Record<LookingForKind, string> = {
  player: 'Player needed',
  team: 'Team needed',
  opponent: 'Opponent needed',
  umpire: 'Umpire needed',
  scorer: 'Scorer needed',
}

export function LookingForPage() {
  useDocumentMeta('Looking For — CricketHub', 'Find players, teams, opponents, umpires, and scorers.')
  const profile = useAuthStore((s) => s.profile)
  const [posts, setPosts] = useState<LookingForPost[]>([])
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState<LookingForKind | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    return subscribeLookingForPosts((p) => {
      setPosts(p)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(
    () => (kindFilter === 'all' ? posts : posts.filter((p) => p.kind === kindFilter)),
    [posts, kindFilter],
  )

  if (loading) return <PageLoader label="Loading…" />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Looking For"
        subtitle="Players looking for teams, teams looking for opponents, and open scorer/umpire slots."
        actions={
          profile && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Post
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className="max-w-[12rem]">
          <option value="all">All kinds</option>
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users2 size={28} />}
          title="Nothing posted yet"
          description="Be the first to post what you're looking for."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <LookingForCard key={post.id} post={post} isOwner={profile?.id === post.createdBy} />
          ))}
        </div>
      )}

      {formOpen && <LookingForFormModal onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function LookingForCard({ post, isOwner }: { post: LookingForPost; isOwner: boolean }) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const [responding, setResponding] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [responses, setResponses] = useState<LookingForResponse[]>([])

  useEffect(() => {
    if (!expanded) return
    return subscribeResponsesFor(post.id, setResponses)
  }, [expanded, post.id])

  async function respond() {
    if (!profile) {
      toast.error('Sign in to respond.')
      return
    }
    setResponding(true)
    try {
      await respondToLookingForPost(post.id)
      toast.success('Response sent.')
    } catch {
      toast.error('Could not send your response.')
    } finally {
      setResponding(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge tone="blue">{KIND_LABEL[post.kind]}</Badge>
          <h3 className="mt-1.5 font-semibold text-ink-900 dark:text-ink-50">{post.title}</h3>
        </div>
        {isOwner && (
          <Button variant="ghost" size="sm" onClick={() => closeLookingForPost(post.id)}>
            Close
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{post.description}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500 dark:text-ink-400">
        {post.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {post.location}
          </span>
        )}
        {post.date && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} /> {formatDate(post.date)}
          </span>
        )}
        <span>by {post.createdByName}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {!isOwner && (
          <Button size="sm" onClick={respond} loading={responding}>
            Respond
          </Button>
        )}
        {isOwner && (
          <Button variant="outline" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Hide' : 'View'} responses
          </Button>
        )}
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
          {responses.length === 0 && <p className="text-xs text-ink-400">No responses yet.</p>}
          {responses.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span>{r.responderName}</span>
              <div className="flex items-center gap-1.5">
                <Badge tone={r.status === 'accepted' ? 'green' : r.status === 'declined' ? 'red' : 'gray'}>
                  {r.status}
                </Badge>
                {r.status === 'pending' && (
                  <>
                    <button
                      onClick={() => setResponseStatus(r.id, 'accepted')}
                      className="text-xs font-semibold text-green-600 hover:underline"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setResponseStatus(r.id, 'declined')}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function LookingForFormModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<LookingForKind>('player')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required.')
      return
    }
    setSaving(true)
    try {
      await createLookingForPost({ kind, title: title.trim(), description: description.trim(), location: location.trim() || undefined })
      toast.success('Posted.')
      onClose()
    } catch {
      toast.error('Could not create post.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Post a Looking For">
      <div className="space-y-3 p-5">
        <Select value={kind} onChange={(e) => setKind(e.target.value as LookingForKind)}>
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
        <input
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
          placeholder="Description — format, skill level, availability, etc."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
          placeholder="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Post
          </Button>
        </div>
      </div>
    </Modal>
  )
}
