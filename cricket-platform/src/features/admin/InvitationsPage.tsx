import { useState } from 'react'
import { Mail, Plus, Copy, Check, X, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Select,
  Textarea,
} from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { listUsers } from '@/services/users.service'
import {
  listInvitations,
  createInvitation,
  cancelInvitation,
  resendInvitation,
  effectiveStatus,
} from '@/services/invitations.service'
import { formatDateTime } from '@/lib/format'
import type { Invitation, InvitationStatus, Role } from '@/types'

const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'SCORER', 'TEAM_MANAGER', 'TOURNAMENT_MANAGER']

const STATUS_TONE: Record<InvitationStatus, 'green' | 'amber' | 'red' | 'gray'> = {
  pending: 'amber',
  accepted: 'green',
  declined: 'red',
  cancelled: 'gray',
  expired: 'gray',
}

export function InvitationsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const invitations = useAsync(listInvitations, [])
  const users = useAsync(listUsers, [])
  const [showForm, setShowForm] = useState(false)
  const [role, setRole] = useState<Role>('SCORER')
  const [targetUid, setTargetUid] = useState('')
  const [message, setMessage] = useState('')
  const [expiryDays, setExpiryDays] = useState(7)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const invitable = (users.data ?? []).filter((u) => u.role !== 'MASTER_ADMIN')

  function inviteLink(code: string): string {
    return `${window.location.origin}/invite/${code}`
  }

  function copyLink(inv: Invitation) {
    navigator.clipboard.writeText(inviteLink(inv.code)).then(() => {
      setCopiedId(inv.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  async function send() {
    if (!profile || !targetUid) return
    const target = invitable.find((u) => u.id === targetUid)
    if (!target) return
    setSaving(true)
    try {
      await createInvitation(role, target.id, target.username, message, expiryDays, profile)
      toast.success(`Invitation created for @${target.username}`)
      setShowForm(false)
      setTargetUid('')
      setMessage('')
      invitations.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create invitation')
    } finally {
      setSaving(false)
    }
  }

  async function doCancel(inv: Invitation) {
    if (!confirm(`Cancel the invitation for @${inv.invitedUsername}?`)) return
    try {
      await cancelInvitation(inv, profile)
      toast.success('Invitation cancelled')
      invitations.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  async function doResend(inv: Invitation) {
    if (!profile) return
    try {
      await resendInvitation(inv, profile)
      toast.success('Invitation resent — link refreshed')
      invitations.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Resend failed')
    }
  }

  if (invitations.loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Invitations"
        subtitle="Offer an existing user a role — they must accept before it takes effect."
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} /> New invitation
          </Button>
        }
      />

      {(invitations.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Mail size={40} />}
          title="No invitations yet"
          description="Invite an existing user to become an admin, scorer, or manager."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus size={16} /> New invitation
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {(invitations.data ?? []).map((inv) => {
            const status = effectiveStatus(inv)
            return (
              <Card key={inv.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-900 dark:text-ink-50">
                        @{inv.invitedUsername}
                      </span>
                      <Badge tone="blue">{inv.role.replace('_', ' ').toLowerCase()}</Badge>
                      <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                    </div>
                    {inv.message && (
                      <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">"{inv.message}"</p>
                    )}
                    <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
                      Invited by {inv.createdByName} · {formatDateTime(inv.createdAt)}
                      {status === 'pending' && ` · expires ${formatDateTime(inv.expiresAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(status === 'pending' || status === 'expired') && (
                      <button
                        onClick={() => copyLink(inv)}
                        title="Copy invite link"
                        aria-label={`Copy invite link for ${inv.invitedUsername}`}
                        className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                      >
                        {copiedId === inv.id ? (
                          <Check size={15} className="text-pitch-600" />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                    )}
                    {(status === 'expired' || status === 'declined' || status === 'cancelled') && (
                      <button
                        onClick={() => doResend(inv)}
                        title="Resend"
                        aria-label={`Resend invitation to ${inv.invitedUsername}`}
                        className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                      >
                        <RotateCcw size={15} />
                      </button>
                    )}
                    {status === 'pending' && (
                      <button
                        onClick={() => doCancel(inv)}
                        title="Cancel"
                        aria-label={`Cancel invitation to ${inv.invitedUsername}`}
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => !saving && setShowForm(false)}
        title="New invitation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={send} loading={saving} disabled={!targetUid}>
              Create invitation
            </Button>
          </>
        }
      >
        <CardBody className="space-y-4 p-0">
          <Field label="Invite user" required>
            <Select value={targetUid} onChange={(e) => setTargetUid(e.target.value)}>
              <option value="">Select a user…</option>
              {invitable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || u.username} (@{u.username}) — currently {u.role.toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role to offer" required>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ').toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Message (optional)">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="A note to include with the invitation…"
            />
          </Field>
          <Field label="Expires in (days)">
            <Input
              type="number"
              min={1}
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
            />
          </Field>
        </CardBody>
      </Modal>
    </div>
  )
}
