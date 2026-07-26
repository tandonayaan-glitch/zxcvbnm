import { useParams } from 'react-router-dom'
import { CalendarDays, UserRound } from 'lucide-react'
import { Avatar, Badge, Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { ShareButton } from '@/components/ui/ShareButton'
import { useAsync } from '@/hooks/useAsync'
import { getPublicProfile, ROLE_LABELS } from '@/services/users.service'
import { formatDate } from '@/lib/format'

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
        </div>
        {p.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-300">{p.bio}</p>
        )}
      </Card>
    </div>
  )
}
