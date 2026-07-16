import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Mail, Check, X, LogIn } from 'lucide-react'
import { Button, Card, PageLoader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import {
  getInvitation,
  acceptInvitation,
  declineInvitation,
  effectiveStatus,
} from '@/services/invitations.service'
import { formatDateTime } from '@/lib/format'

export function InvitePage() {
  const { code = '' } = useParams()
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const invitation = useAsync(() => getInvitation(code), [code])
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null)
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)

  async function respond(accept: boolean) {
    const inv = invitation.data
    if (!inv || !profile) return
    setResponding(accept ? 'accept' : 'decline')
    try {
      if (accept) {
        await acceptInvitation(inv, profile)
        setDone('accepted')
        toast.success(`You're now a ${inv.role.replace('_', ' ').toLowerCase()}`)
      } else {
        await declineInvitation(inv, profile)
        setDone('declined')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setResponding(null)
    }
  }

  if (invitation.loading) return <PageLoader />

  const inv = invitation.data
  if (!inv) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Invitation not found</h1>
        <p className="mt-2 text-ink-500 dark:text-ink-400">
          This invitation link is invalid or has been removed.
        </p>
      </div>
    )
  }

  const status = done ?? effectiveStatus(inv)
  const roleLabel = inv.role.replace('_', ' ').toLowerCase()

  return (
    <div className="mx-auto max-w-md py-12">
      <Card className="p-6 text-center">
        <Mail size={36} className="mx-auto text-brand-600" />
        <h1 className="mt-3 text-xl font-bold text-ink-900 dark:text-ink-50">
          Invitation to become a {roleLabel}
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {inv.createdByName} invited @{inv.invitedUsername} to join CricketHub as a {roleLabel}.
        </p>
        {inv.message && (
          <p className="mt-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
            "{inv.message}"
          </p>
        )}

        {status === 'accepted' && (
          <p className="mt-5 flex items-center justify-center gap-2 font-semibold text-pitch-700">
            <Check size={18} /> Invitation accepted — you're now a {roleLabel}.
          </p>
        )}
        {status === 'declined' && (
          <p className="mt-5 text-ink-500 dark:text-ink-400">You declined this invitation.</p>
        )}
        {status === 'cancelled' && (
          <p className="mt-5 text-ink-500 dark:text-ink-400">This invitation was cancelled.</p>
        )}
        {status === 'expired' && (
          <p className="mt-5 text-ink-500 dark:text-ink-400">
            This invitation expired on {formatDateTime(inv.expiresAt)}. Ask for a new one.
          </p>
        )}

        {status === 'pending' && !profile && (
          <div className="mt-5">
            <p className="mb-3 text-sm text-ink-500 dark:text-ink-400">
              Sign in as @{inv.invitedUsername} to respond.
            </p>
            <Link to="/login">
              <Button>
                <LogIn size={16} /> Sign in
              </Button>
            </Link>
          </div>
        )}

        {status === 'pending' && profile && profile.id !== inv.invitedUid && (
          <p className="mt-5 text-sm text-ink-500 dark:text-ink-400">
            This invitation is for @{inv.invitedUsername}, not your account
            (@{profile.username}). Sign in as that user to respond.
          </p>
        )}

        {status === 'pending' && profile && profile.id === inv.invitedUid && (
          <div className="mt-5 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => respond(false)}
              loading={responding === 'decline'}
              disabled={!!responding}
            >
              <X size={16} /> Decline
            </Button>
            <Button
              onClick={() => respond(true)}
              loading={responding === 'accept'}
              disabled={!!responding}
            >
              <Check size={16} /> Accept
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
