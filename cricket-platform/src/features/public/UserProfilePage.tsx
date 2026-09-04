import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, UserRound, Radio } from 'lucide-react'
import { Avatar, Badge, Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { ShareButton } from '@/components/ui/ShareButton'
import { QRCodeButton } from '@/components/ui/QRCodeButton'
import { RatingWidget } from '@/components/reputation/RatingWidget'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { getPublicProfile, ROLE_LABELS } from '@/services/users.service'
import { listAllMatches } from '@/services/matches.service'
import { formatDate } from '@/lib/format'
import type { Match } from '@/types'

/** Roles that act as match officials (scorer duties) — the only ones a real "matches scored"
 *  count and reputation widget makes sense for. Dedicated umpire/commentator roles don't exist
 *  in this platform's role model yet, so those official types are not shown here (never
 *  fabricated with a placeholder). */
const OFFICIAL_ROLES = new Set(['SCORER', 'ADMIN', 'MASTER_ADMIN', 'TOURNAMENT_MANAGER'])

const ROLE_TONE: Record<string, 'gray' | 'blue' | 'green' | 'amber'> = {
  MASTER_ADMIN: 'amber',
  ADMIN: 'blue',
  SCORER: 'green',
  TEAM_MANAGER: 'blue',
  TOURNAMENT_MANAGER: 'blue',
  VIEWER: 'gray',
}

export function UserProfilePage() {
  const { username = '' } = useParams()
  const profile = useAsync(() => getPublicProfile(username), [username])
  const isOfficial = profile.data ? OFFICIAL_ROLES.has(profile.data.role) : false
  const matches = useAsync(
    () => (isOfficial ? listAllMatches() : Promise.resolve([] as Match[])),
    [isOfficial],
  )

  useDocumentMeta(
    profile.data?.displayName ?? 'Profile',
    profile.data ? `@${profile.data.username} on CricketHub.` : undefined,
  )

  const officialStats = useMemo(() => {
    if (!profile.data) return null
    const uid = profile.data.id
    const scored = (matches.data ?? []).filter((m) => m.scorerId === uid || m.createdBy === uid)
    return { total: scored.length, completed: scored.filter((m) => m.status === 'completed').length }
  }, [matches.data, profile.data])

  if (profile.loading) return <PageLoader />
  if (!profile.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<UserRound size={40} />} title="User not found" />
      </div>
    )

  const p = profile.data

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={p.displayName} src={p.photoURL} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">{p.displayName}</h1>
            <p className="text-sm text-ink-500 dark:text-ink-400">@{p.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={ROLE_TONE[p.role] ?? 'gray'}>{ROLE_LABELS[p.role]}</Badge>
              <span className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                <CalendarDays size={13} /> Joined {formatDate(p.createdAt)}
              </span>
            </div>
          </div>
          <ShareButton variant="icon" title={p.displayName} />
          <QRCodeButton title={p.displayName} />
        </div>
        {p.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-300">{p.bio}</p>
        )}
        {isOfficial && (
          <div className="mt-4 border-t border-ink-100 pt-4 dark:border-ink-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-300">
                <Radio size={14} />
                {officialStats
                  ? `${officialStats.completed} matches scored (${officialStats.total} total)`
                  : 'Loading match history…'}
              </span>
              <RatingWidget targetType="scorer" targetId={p.id} />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
