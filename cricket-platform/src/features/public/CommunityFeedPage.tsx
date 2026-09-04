import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageSquare, Flag, Trash2, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, PageLoader, EmptyState, Button, Avatar, Badge, Select } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { listAllMatches } from '@/services/matches.service'
import {
  subscribeFeed,
  createPost,
  deletePost,
  likePost,
  unlikePost,
  subscribeMyLikes,
  votePoll,
} from '@/services/community.service'
import { reportContent } from '@/services/moderation.service'
import { formatRelativeTime } from '@/lib/format'
import type { CommunityPost, PostKind } from '@/types'

export function CommunityFeedPage() {
  useDocumentMeta('Community — CricketHub', 'The CricketHub community feed.')
  const profile = useAuthStore((s) => s.profile)
  const toast = useToast()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeFeed((p) => {
      setPosts(p)
      setLoading(false)
    })
  }, [])
  useEffect(() => subscribeMyLikes(setLikedIds), [profile?.id])

  async function toggleLike(post: CommunityPost) {
    if (!profile) {
      toast.error('Sign in to like posts.')
      return
    }
    try {
      if (likedIds.has(post.id)) await unlikePost(post.id)
      else await likePost(post.id)
    } catch {
      toast.error('Could not update your like.')
    }
  }

  async function report(post: CommunityPost) {
    if (!profile) {
      toast.error('Sign in to report.')
      return
    }
    try {
      await reportContent('post', post.id, 'Reported from community feed')
      toast.success('Reported to moderators.')
    } catch {
      toast.error('Could not submit report.')
    }
  }

  if (loading) return <PageLoader label="Loading feed…" />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Community" subtitle="What's happening across CricketHub." />
      {profile && <PostComposer />}
      {posts.length === 0 ? (
        <EmptyState icon={<MessageSquare size={28} />} title="No posts yet" description="Be the first to share something." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={post.authorName} src={post.authorPhotoURL} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-900 dark:text-ink-50">{post.authorName}</span>
                    <span className="text-xs text-ink-400">{formatRelativeTime(post.createdAt)}</span>
                    {post.kind !== 'text' && <Badge tone="blue">{post.kind}</Badge>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-200">{post.text}</p>
                  {post.imageURL && (
                    <img src={post.imageURL} alt="" className="mt-2 max-h-80 w-full rounded-lg object-cover" />
                  )}
                  {post.kind === 'match' && post.matchId && (
                    <Link
                      to={`/match/${post.matchId}`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800"
                    >
                      {post.matchTitle ?? 'View match'}
                    </Link>
                  )}
                  {post.kind === 'poll' && post.pollOptions && (
                    <div className="mt-2 space-y-1.5">
                      {post.pollOptions.map((o) => {
                        const total = post.pollOptions!.reduce((s, x) => s + x.votes, 0) || 1
                        const pct = Math.round((o.votes / total) * 100)
                        const voted = post.pollVoterIds?.includes(profile?.id ?? '')
                        return (
                          <button
                            key={o.id}
                            disabled={!profile || voted}
                            onClick={() => votePoll(post.id, o.id).catch(() => toast.error('Could not vote.'))}
                            className="relative w-full overflow-hidden rounded-lg border border-ink-200 px-3 py-2 text-left text-sm disabled:cursor-default dark:border-ink-800"
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-brand-100 dark:bg-brand-900/30"
                              style={{ width: `${voted ? pct : 0}%` }}
                            />
                            <span className="relative flex justify-between">
                              <span>{o.text}</span>
                              {voted && <span>{pct}%</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-sm text-ink-500 dark:text-ink-400">
                    <button
                      onClick={() => toggleLike(post)}
                      className={`inline-flex items-center gap-1 ${likedIds.has(post.id) ? 'text-red-600' : ''}`}
                    >
                      <Heart size={15} className={likedIds.has(post.id) ? 'fill-red-500 text-red-500' : ''} /> {post.likeCount}
                    </button>
                    <button onClick={() => report(post)} className="inline-flex items-center gap-1">
                      <Flag size={14} /> Report
                    </button>
                    {profile?.id === post.createdBy && (
                      <button
                        onClick={() => deletePost(post.id).catch(() => toast.error('Could not delete.'))}
                        className="ml-auto inline-flex items-center gap-1 text-red-600"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function PostComposer() {
  const toast = useToast()
  const matches = useAsync(listAllMatches, [])
  const [text, setText] = useState('')
  const [kind, setKind] = useState<PostKind>('text')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [matchId, setMatchId] = useState('')
  const [posting, setPosting] = useState(false)

  const recentMatches = (matches.data ?? [])
    .filter((m) => !m.deletedAt)
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
    .slice(0, 30)

  async function submit() {
    if (!text.trim()) return
    if (kind === 'match' && !matchId) {
      toast.error('Pick a match to share.')
      return
    }
    setPosting(true)
    try {
      const match = recentMatches.find((m) => m.id === matchId)
      await createPost({
        kind,
        text: text.trim(),
        pollOptions: kind === 'poll' ? pollOptions.map((o) => o.trim()).filter(Boolean) : undefined,
        matchId: kind === 'match' ? matchId : undefined,
        matchTitle: kind === 'match' ? match?.title : undefined,
      })
      setText('')
      setPollOptions(['', ''])
      setMatchId('')
      setKind('text')
    } catch {
      toast.error('Could not post.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Card className="mb-4 p-4">
      <textarea
        className="w-full resize-none rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
        rows={2}
        placeholder="Share something with the CricketHub community…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {kind === 'poll' && (
        <div className="mt-2 space-y-1.5">
          {pollOptions.map((o, i) => (
            <input
              key={i}
              className="w-full rounded-lg border border-ink-300 px-3 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-900"
              placeholder={`Option ${i + 1}`}
              value={o}
              onChange={(e) => {
                const next = [...pollOptions]
                next[i] = e.target.value
                setPollOptions(next)
              }}
            />
          ))}
          <button
            onClick={() => setPollOptions((p) => [...p, ''])}
            className="text-xs font-semibold text-brand-600"
          >
            + Add option
          </button>
        </div>
      )}
      {kind === 'match' && (
        <div className="mt-2">
          <Select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">Pick a match…</option>
            {recentMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-3">
          <button
            onClick={() => setKind(kind === 'poll' ? 'text' : 'poll')}
            className="text-xs font-semibold text-ink-500 hover:text-brand-600 dark:text-ink-400"
          >
            {kind === 'poll' ? 'Remove poll' : '+ Add poll'}
          </button>
          <button
            onClick={() => setKind(kind === 'match' ? 'text' : 'match')}
            className="text-xs font-semibold text-ink-500 hover:text-brand-600 dark:text-ink-400"
          >
            {kind === 'match' ? 'Remove match' : '+ Share a match'}
          </button>
        </div>
        <Button size="sm" onClick={submit} loading={posting} disabled={!text.trim()}>
          <Send size={14} /> Post
        </Button>
      </div>
    </Card>
  )
}
