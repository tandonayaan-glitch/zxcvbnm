import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore } from '@/store/authStore'
import { listMatchReactions, toggleReaction } from '@/services/matchReactions.service'
import { REACTION_EMOJIS, type ReactionEmoji } from '@/types'

export function MatchReactions({ matchId }: { matchId: string }) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const reactions = useAsync(() => listMatchReactions(matchId), [matchId])
  const [pending, setPending] = useState<ReactionEmoji | null>(null)

  const list = reactions.data ?? []
  const counts = useMemo(() => {
    const m = new Map<ReactionEmoji, number>(REACTION_EMOJIS.map((e) => [e, 0]))
    for (const r of list) {
      for (const e of r.emojis) m.set(e, (m.get(e) ?? 0) + 1)
    }
    return m
  }, [list])
  const mine = list.find((r) => r.id === profile?.id)

  async function tap(emoji: ReactionEmoji) {
    if (!profile) return
    setPending(emoji)
    try {
      await toggleReaction(matchId, profile.id, emoji)
      reactions.refetch()
    } catch {
      toast.error('Could not react')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTION_EMOJIS.map((emoji) => {
        const active = mine?.emojis.includes(emoji) ?? false
        const count = counts.get(emoji) ?? 0
        return (
          <button
            key={emoji}
            onClick={() => tap(emoji)}
            disabled={!profile || pending === emoji}
            title={profile ? undefined : 'Sign in to react'}
            aria-label={`React with ${emoji}${count > 0 ? ` (${count})` : ''}`}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20'
                : 'border-ink-200 bg-white hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-800',
            )}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span className="text-xs font-semibold text-ink-600 dark:text-ink-400">{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
