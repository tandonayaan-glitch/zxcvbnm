import { useMemo, useState } from 'react'
import { UserCog, Ban, ShieldCheck, Crown, Sparkles, Copy, Check, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoader,
  Select,
} from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { listUsers, setUserRoleNotified, setUserStatus } from '@/services/users.service'
import { reissueLinkedAccess } from '@/services/auth.service'
import {
  listSubscriptions,
  grantSubscription,
  revokeSubscription,
} from '@/services/subscriptions.service'
import { effectiveTier } from '@/domain/entitlements'
import { logAudit } from '@/services/audit.service'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/format'
import { CredentialsDialog, type LinkedCredentials } from '@/features/players/CredentialsDialog'
import type { Role, Subscription, UserProfile } from '@/types'

/** Roles the master admin can assign (the master role itself is reserved). Matches
 *  InvitationsPage.tsx's own ASSIGNABLE_ROLES — both are ways to grant the same role set. */
const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'SCORER', 'TEAM_MANAGER', 'TOURNAMENT_MANAGER', 'VIEWER']

const ROLE_TONE: Record<Role, 'red' | 'blue' | 'green' | 'amber' | 'gray' | 'purple'> = {
  MASTER_ADMIN: 'purple',
  ADMIN: 'red',
  SCORER: 'blue',
  TEAM_MANAGER: 'green',
  TOURNAMENT_MANAGER: 'amber',
  VIEWER: 'gray',
}

/** How a user's premium access is currently granted, for an honest label on the plan column. */
type AccessSource = 'role' | 'manual' | 'checkout' | 'free'

function accessSource(user: UserProfile, sub: Subscription | undefined): AccessSource {
  if (user.role === 'MASTER_ADMIN') return 'role'
  if (!sub || sub.status !== 'active' || effectiveTier(sub) !== 'premium') return 'free'
  return sub.provider === 'manual' ? 'manual' : 'checkout'
}

const SOURCE_LABEL: Record<AccessSource, string> = {
  role: 'Premium · role',
  manual: 'Premium · granted',
  checkout: 'Premium · subscription',
  free: 'Free',
}

export function UsersPage() {
  const toast = useToast()
  const me = useAuthStore((s) => s.profile)
  const users = useAsync(listUsers, [])
  const subs = useAsync(listSubscriptions, [])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [reissued, setReissued] = useState<LinkedCredentials | null>(null)

  const subByUid = useMemo(
    () => new Map((subs.data ?? []).map((s) => [s.uid, s])),
    [subs.data],
  )

  async function changeRole(uid: string, role: Role) {
    setSavingId(uid)
    try {
      await setUserRoleNotified(uid, role)
      const target = (users.data ?? []).find((u) => u.id === uid)
      await logAudit(me, 'Changed user role', `${target?.username ?? uid} → ${role}`, {
        before: target?.role,
        after: role,
      })
      toast.success('Role updated')
      users.refetch()
    } catch {
      toast.error('Could not update role')
    } finally {
      setSavingId(null)
    }
  }

  async function toggleBan(uid: string, ban: boolean) {
    if (ban && !confirm('Suspend this user? They will be signed out and blocked from logging in.'))
      return
    setSavingId(uid)
    try {
      await setUserStatus(uid, ban ? 'banned' : 'active')
      const target = (users.data ?? []).find((u) => u.id === uid)
      await logAudit(
        me,
        ban ? 'Suspended user' : 'Reinstated user',
        target?.username ?? uid,
        { before: target?.status, after: ban ? 'banned' : 'active' },
      )
      toast.success(ban ? 'User suspended' : 'User reinstated')
      users.refetch()
    } catch {
      toast.error('Could not update status')
    } finally {
      setSavingId(null)
    }
  }

  async function togglePremium(user: UserProfile, grant: boolean) {
    if (grant) {
      if (
        !confirm(
          `Grant ${user.displayName || user.username} full Premium access?\n\n` +
            'This is an admin comp — no payment is taken. It stays until you revoke it.',
        )
      )
        return
    } else if (
      !confirm(
        `Revoke Premium access for ${user.displayName || user.username}?\n\n` +
          'They drop back to the Free plan immediately (on their next page load).',
      )
    ) {
      return
    }
    setSavingId(user.id)
    try {
      if (grant) await grantSubscription(user.id, 'premium', me)
      else await revokeSubscription(user.id, me)
      toast.success(grant ? 'Premium granted' : 'Premium revoked')
      subs.refetch()
    } catch {
      toast.error(grant ? 'Could not grant Premium' : 'Could not revoke Premium')
    } finally {
      setSavingId(null)
    }
  }

  function copyUsername(uid: string, username: string) {
    navigator.clipboard?.writeText(username).then(
      () => {
        setCopiedId(uid)
        setTimeout(() => setCopiedId((c) => (c === uid ? null : c)), 1500)
      },
      () => toast.error('Could not copy'),
    )
  }

  async function reissueAccess(user: UserProfile) {
    const activated = user.status !== 'pending_registration'
    if (
      !confirm(
        `Re-issue login access for ${user.displayName || user.username}?\n\n` +
          'This creates a NEW username and a NEW temporary password (shown once). ' +
          `Their current login (@${user.username}) stops working` +
          (activated ? ' and they are signed out.' : '.') +
          '\n\nUse this when the one-time password was lost before they signed in.',
      )
    )
      return
    setSavingId(user.id)
    try {
      const fresh = await reissueLinkedAccess(user, me)
      setReissued({
        playerName: fresh.displayName,
        username: fresh.username,
        password: fresh.password,
      })
      toast.success('New access issued')
      users.refetch()
      subs.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not re-issue access')
    } finally {
      setSavingId(null)
    }
  }

  const loading = users.loading || subs.loading

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Users & Roles"
        subtitle="Master admin control — promote admins, assign scorers, grant Premium, and suspend accounts."
      />
      {loading ? (
        <PageLoader />
      ) : (users.data ?? []).length === 0 ? (
        <EmptyState icon={<UserCog size={40} />} title="No users yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Manage</th>
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u) => {
                  const isMaster = u.role === 'MASTER_ADMIN'
                  const isSelf = u.id === me?.id
                  const banned = u.status === 'banned'
                  const src = accessSource(u, subByUid.get(u.id))
                  const isPremium = src !== 'free'
                  const rowBusy = savingId === u.id
                  return (
                    <tr key={u.id} className="border-b border-ink-50 dark:border-ink-800">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.displayName || u.username || 'User'} size={32} />
                          <div>
                            <div className="font-medium text-ink-900 dark:text-ink-50">
                              {u.displayName || u.username || 'Unnamed user'}
                              {isSelf && (
                                <span className="ml-1 text-xs text-ink-400 dark:text-ink-500">(you)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-ink-400 dark:text-ink-500">
                              <span>@{u.username}</span>
                              <button
                                onClick={() => copyUsername(u.id, u.username)}
                                aria-label={`Copy username for ${u.displayName || u.username}`}
                                title="Copy username"
                                className="rounded p-0.5 hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-ink-800 dark:hover:text-ink-300"
                              >
                                {copiedId === u.id ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div className="text-[11px] text-ink-400 dark:text-ink-500">
                              Joined {formatDate(u.createdAt)}
                              {u.status === 'pending_registration' && ' · not activated'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={ROLE_TONE[u.role] ?? 'gray'}>
                          {isMaster && <Crown size={12} />}
                          {(u.role ?? 'viewer').replace('_', ' ').toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={isPremium ? 'amber' : 'gray'}>
                          {isPremium && <Sparkles size={12} />}
                          {SOURCE_LABEL[src]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {banned ? (
                          <Badge tone="red">Suspended</Badge>
                        ) : (
                          <Badge tone="green">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {isMaster ? (
                          <div className="text-right text-xs text-ink-400 dark:text-ink-500">
                            Master — protected
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Select
                              value={u.role}
                              disabled={rowBusy}
                              onChange={(e) => changeRole(u.id, e.target.value as Role)}
                              className="w-32"
                            >
                              {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r.toLowerCase()}
                                </option>
                              ))}
                            </Select>
                            <Button
                              size="sm"
                              variant={src === 'checkout' ? 'ghost' : isPremium ? 'outline' : 'ghost'}
                              disabled={rowBusy || src === 'checkout'}
                              title={
                                src === 'checkout'
                                  ? 'This user has a paid subscription — manage it through billing, not here.'
                                  : undefined
                              }
                              onClick={() => togglePremium(u, !isPremium)}
                            >
                              <Sparkles size={14} />
                              {isPremium ? 'Revoke Premium' : 'Grant Premium'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={rowBusy}
                              title="Create a fresh username + temporary password (old login stops working)"
                              onClick={() => reissueAccess(u)}
                            >
                              <KeyRound size={14} />
                              {u.status === 'pending_registration' ? 'Re-issue access' : 'Reset access'}
                            </Button>
                            <Button
                              size="sm"
                              variant={banned ? 'outline' : 'danger'}
                              disabled={rowBusy}
                              onClick={() => toggleBan(u.id, !banned)}
                            >
                              {banned ? (
                                <>
                                  <ShieldCheck size={14} /> Reinstate
                                </>
                              ) : (
                                <>
                                  <Ban size={14} /> Suspend
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {reissued && (
        <CredentialsDialog credentials={reissued} onClose={() => setReissued(null)} />
      )}
    </div>
  )
}
