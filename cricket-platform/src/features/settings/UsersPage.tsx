import { useMemo, useState, type ReactNode } from 'react'
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
import { permissionAwareMessage } from '@/lib/firebaseError'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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

  /** Destructive/consequential row actions route through one <ConfirmDialog> instead of
   *  `window.confirm()` (a silent no-op in some embedded webviews / after a "block dialogs"
   *  opt-out, which reads as a dead button). Reinstating a user isn't destructive and stays
   *  a one-click action. */
  type PendingAction =
    | { kind: 'suspend'; user: UserProfile }
    | { kind: 'grant'; user: UserProfile }
    | { kind: 'revoke'; user: UserProfile }
    | { kind: 'reissue'; user: UserProfile }
  const [pending, setPending] = useState<PendingAction | null>(null)

  async function reinstate(user: UserProfile) {
    setSavingId(user.id)
    try {
      await setUserStatus(user.id, 'active')
      await logAudit(me, 'Reinstated user', user.username ?? user.id, {
        before: user.status,
        after: 'active',
      })
      toast.success('User reinstated')
      users.refetch()
    } catch (e) {
      toast.error(permissionAwareMessage(e, 'Could not update status'))
    } finally {
      setSavingId(null)
    }
  }

  /** Runs the confirmed action. Throws on failure so <ConfirmDialog> shows the real reason
   *  inline and stays open — matching the PlayersPage delete flow. */
  async function runPending() {
    if (!pending) return
    const { kind, user } = pending
    setSavingId(user.id)
    try {
      if (kind === 'suspend') {
        await setUserStatus(user.id, 'banned')
        await logAudit(me, 'Suspended user', user.username ?? user.id, {
          before: user.status,
          after: 'banned',
        })
        toast.success('User suspended')
        users.refetch()
      } else if (kind === 'grant' || kind === 'revoke') {
        if (kind === 'grant') await grantSubscription(user.id, 'premium', me)
        else await revokeSubscription(user.id, me)
        toast.success(kind === 'grant' ? 'Premium granted' : 'Premium revoked')
        subs.refetch()
      } else {
        const fresh = await reissueLinkedAccess(user, me)
        setReissued({
          playerName: fresh.displayName,
          username: fresh.username,
          password: fresh.password,
        })
        toast.success('New access issued')
        users.refetch()
        subs.refetch()
      }
    } catch (e) {
      throw new Error(permissionAwareMessage(e, 'You don’t have permission to do that.'))
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

  const loading = users.loading || subs.loading

  const confirmCopy: Record<PendingAction['kind'], { title: string; confirmLabel: string; tone: 'danger' | 'primary'; body: (u: UserProfile) => ReactNode }> = {
    suspend: {
      title: 'Suspend user',
      confirmLabel: 'Suspend',
      tone: 'danger',
      body: (u) => (
        <>
          Suspend <strong>{u.displayName || u.username}</strong>? They’ll be signed out and
          blocked from logging in until reinstated.
        </>
      ),
    },
    grant: {
      title: 'Grant Premium',
      confirmLabel: 'Grant Premium',
      tone: 'primary',
      body: (u) => (
        <>
          Grant <strong>{u.displayName || u.username}</strong> full Premium access? This is an
          admin comp — no payment is taken, and it stays until you revoke it.
        </>
      ),
    },
    revoke: {
      title: 'Revoke Premium',
      confirmLabel: 'Revoke Premium',
      tone: 'danger',
      body: (u) => (
        <>
          Revoke Premium access for <strong>{u.displayName || u.username}</strong>? They drop
          back to the Free plan on their next page load.
        </>
      ),
    },
    reissue: {
      title: 'Re-issue login access',
      confirmLabel: 'Re-issue access',
      tone: 'danger',
      body: (u) => (
        <>
          Re-issue login for <strong>{u.displayName || u.username}</strong>? This mints a{' '}
          <strong>new</strong> username and a <strong>new</strong> temporary password (shown
          once). Their current login <code>@{u.username}</code> stops working
          {u.status !== 'pending_registration' && ' and they are signed out'}. Use this when
          the one-time password was lost before they signed in.
        </>
      ),
    },
  }

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
                              onClick={() =>
                                setPending({ kind: isPremium ? 'revoke' : 'grant', user: u })
                              }
                            >
                              <Sparkles size={14} />
                              {isPremium ? 'Revoke Premium' : 'Grant Premium'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={rowBusy}
                              title="Create a fresh username + temporary password (old login stops working)"
                              onClick={() => setPending({ kind: 'reissue', user: u })}
                            >
                              <KeyRound size={14} />
                              {u.status === 'pending_registration' ? 'Re-issue access' : 'Reset access'}
                            </Button>
                            <Button
                              size="sm"
                              variant={banned ? 'outline' : 'danger'}
                              disabled={rowBusy}
                              onClick={() =>
                                banned ? reinstate(u) : setPending({ kind: 'suspend', user: u })
                              }
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
      {pending && (
        <ConfirmDialog
          open
          title={confirmCopy[pending.kind].title}
          message={confirmCopy[pending.kind].body(pending.user)}
          confirmLabel={confirmCopy[pending.kind].confirmLabel}
          tone={confirmCopy[pending.kind].tone}
          onConfirm={runPending}
          onClose={() => setPending(null)}
        />
      )}
      {reissued && (
        <CredentialsDialog credentials={reissued} onClose={() => setReissued(null)} />
      )}
    </div>
  )
}
