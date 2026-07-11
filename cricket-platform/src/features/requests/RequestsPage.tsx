import { useState } from 'react'
import { Inbox, Check, X, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import {
  listRequests,
  approveRequest,
  rejectRequest,
} from '@/services/requests.service'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime } from '@/lib/format'
import type { AdminRequest } from '@/types'

export function RequestsPage() {
  const toast = useToast()
  const me = useAuthStore((s) => s.profile)
  const requests = useAsync(listRequests, [])
  const [tab, setTab] = useState('pending')
  const [busyId, setBusyId] = useState<string | null>(null)

  const list = (requests.data ?? []).filter((r) =>
    tab === 'all' ? true : r.status === tab,
  )
  const pendingCount = (requests.data ?? []).filter(
    (r) => r.status === 'pending',
  ).length

  async function approve(req: AdminRequest) {
    if (!me) return
    setBusyId(req.id)
    try {
      await approveRequest(req, me.id)
      toast.success(`${req.displayName} is now an admin`)
      requests.refetch()
    } catch {
      toast.error('Could not approve request')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(req: AdminRequest) {
    if (!me) return
    setBusyId(req.id)
    try {
      await rejectRequest(req, me.id)
      toast.success('Request rejected')
      requests.refetch()
    } catch {
      toast.error('Could not reject request')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Admin requests"
        subtitle="People asking for admin access to run their own tournament."
      />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          {
            key: 'pending',
            label: (
              <span className="flex items-center gap-1.5">
                Pending
                {pendingCount > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </span>
            ),
          },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All' },
        ]}
      />

      {requests.loading ? (
        <PageLoader />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Inbox size={40} />}
          title="No requests here"
          description="Admin access requests will appear here for you to approve."
        />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={r.displayName} size={40} />
                  <div>
                    <div className="font-semibold text-ink-900 dark:text-ink-50">
                      {r.displayName}{' '}
                      <span className="text-sm font-normal text-ink-400 dark:text-ink-500">
                        @{r.username}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-400">
                      <Trophy size={14} className="text-amber-500" />
                      {r.tournamentName || 'Tournament not specified'}
                    </div>
                    {r.message && (
                      <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">“{r.message}”</p>
                    )}
                    <div className="mt-1 text-xs text-ink-400 dark:text-ink-500">
                      {formatDateTime(r.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {r.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => approve(r)}
                      >
                        <Check size={14} /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r.id}
                        onClick={() => reject(r)}
                      >
                        <X size={14} /> Reject
                      </Button>
                    </div>
                  ) : r.status === 'approved' ? (
                    <Badge tone="green">Approved</Badge>
                  ) : (
                    <Badge tone="red">Rejected</Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
