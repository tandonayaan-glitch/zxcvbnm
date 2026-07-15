import { useState } from 'react'
import { UserCog, Ban, ShieldCheck, Crown } from 'lucide-react'
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
import { logAudit } from '@/services/audit.service'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/format'
import type { Role } from '@/types'

/** Roles the master admin can assign (the master role itself is reserved). */
const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'SCORER', 'VIEWER']

const ROLE_TONE: Record<Role, 'red' | 'blue' | 'green' | 'amber' | 'gray' | 'purple'> = {
  MASTER_ADMIN: 'purple',
  ADMIN: 'red',
  SCORER: 'blue',
  TEAM_MANAGER: 'green',
  TOURNAMENT_MANAGER: 'amber',
  VIEWER: 'gray',
}

export function UsersPage() {
  const toast = useToast()
  const me = useAuthStore((s) => s.profile)
  const users = useAsync(listUsers, [])
  const [savingId, setSavingId] = useState<string | null>(null)

  async function changeRole(uid: string, role: Role) {
    setSavingId(uid)
    try {
      await setUserRoleNotified(uid, role)
      const target = (users.data ?? []).find((u) => u.id === uid)
      await logAudit(me, 'Changed user role', `${target?.username ?? uid} → ${role}`)
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
      )
      toast.success(ban ? 'User suspended' : 'User reinstated')
      users.refetch()
    } catch {
      toast.error('Could not update status')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Users & Roles"
        subtitle="Master admin control — promote admins, assign scorers, and suspend accounts."
      />
      {users.loading ? (
        <PageLoader />
      ) : (users.data ?? []).length === 0 ? (
        <EmptyState icon={<UserCog size={40} />} title="No users yet" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => {
                const isMaster = u.role === 'MASTER_ADMIN'
                const isSelf = u.id === me?.id
                const banned = u.status === 'banned'
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
                          <div className="text-xs text-ink-400 dark:text-ink-500">@{u.username}</div>
                          <div className="text-[11px] text-ink-400 dark:text-ink-500">
                            Joined {formatDate(u.createdAt)}
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
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={u.role}
                            disabled={savingId === u.id}
                            onChange={(e) =>
                              changeRole(u.id, e.target.value as Role)
                            }
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
                            variant={banned ? 'outline' : 'danger'}
                            disabled={savingId === u.id}
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
        </Card>
      )}
    </div>
  )
}
