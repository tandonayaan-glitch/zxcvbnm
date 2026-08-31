import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Trash2 } from 'lucide-react'
import { Avatar, Button, Card, CardBody, CardHeader, Textarea } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { confirmDialog } from '@/components/ui/confirm'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore, isAdmin } from '@/store/authStore'
import { listComments, postComment, deleteComment } from '@/services/comments.service'
import { formatDateTime } from '@/lib/format'

const MAX_LENGTH = 500

export function CommentSection({ matchId }: { matchId: string }) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const comments = useAsync(() => listComments(matchId), [matchId])
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  async function submit() {
    if (!profile || !text.trim()) return
    setPosting(true)
    try {
      await postComment(matchId, profile, text)
      setText('')
      comments.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not post comment')
    } finally {
      setPosting(false)
    }
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: 'Delete comment', message: 'Delete this comment? This cannot be undone.', confirmLabel: 'Delete' }))) return
    try {
      await deleteComment(id)
      comments.refetch()
    } catch {
      toast.error('Could not delete comment')
    }
  }

  const list = comments.data ?? []

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <MessageCircle size={18} className="text-ink-500" /> Comments
            {list.length > 0 && ` (${list.length})`}
          </span>
        }
      />
      <CardBody>
        {profile ? (
          <div className="mb-4 flex gap-2.5">
            <Avatar name={profile.displayName} src={profile.photoURL} size={32} />
            <div className="flex-1">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={MAX_LENGTH}
                placeholder="Share your thoughts on this match…"
                className="w-full"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-ink-400 dark:text-ink-500">
                  {text.length}/{MAX_LENGTH}
                </span>
                <Button size="sm" onClick={submit} loading={posting} disabled={!text.trim()}>
                  Post
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
            <Link to="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>{' '}
            to leave a comment.
          </p>
        )}

        {comments.loading ? (
          <p className="py-2 text-center text-sm text-ink-500 dark:text-ink-400">
            Loading comments…
          </p>
        ) : list.length === 0 ? (
          <p className="py-2 text-center text-sm text-ink-500 dark:text-ink-400">
            No comments yet — be the first.
          </p>
        ) : (
          <div className="space-y-3">
            {list.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar name={c.authorName} src={c.authorPhotoURL} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                      {c.authorName}
                    </span>
                    <span className="text-xs text-ink-400 dark:text-ink-500">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-ink-700 dark:text-ink-300">
                    {c.text}
                  </p>
                </div>
                {(profile?.id === c.authorId || isAdmin(profile)) && (
                  <button
                    onClick={() => remove(c.id)}
                    aria-label="Delete comment"
                    className="h-fit rounded-md p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:text-ink-500 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
