import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, PageLoader, EmptyState, Badge, Button } from '@/components/ui/primitives'
import { subscribeAllReports, setReportStatus } from '@/services/moderation.service'
import { formatDateTime } from '@/lib/format'
import type { ContentReport, ReportStatus } from '@/types'

const STATUS_TONE: Record<ReportStatus, 'gray' | 'amber' | 'red' | 'green'> = {
  pending: 'amber',
  reviewed: 'gray',
  dismissed: 'gray',
  actioned: 'red',
}

/** Master-admin only (route-guarded + firestore.rules-enforced). Reviews reports filed against
 *  community posts/comments/looking-for posts/users — a real review queue over real submitted
 *  reports, not a placeholder. */
export function ModerationPage() {
  const [reports, setReports] = useState<ContentReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeAllReports((r) => {
      setReports(r)
      setLoading(false)
    })
  }, [])

  if (loading) return <PageLoader label="Loading reports…" />

  const pending = reports.filter((r) => r.status === 'pending')

  return (
    <div>
      <PageHeader title="Moderation" subtitle={`${pending.length} pending report${pending.length === 1 ? '' : 's'}`} />
      {reports.length === 0 ? (
        <EmptyState icon={<Flag size={28} />} title="No reports" description="Nothing has been reported yet." />
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  <span className="text-sm font-medium text-ink-900 dark:text-ink-50">
                    {r.targetType} · {r.targetId}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{r.reason}</p>
                <p className="mt-1 text-xs text-ink-400">{formatDateTime(r.createdAt)}</p>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReportStatus(r.id, 'dismissed')}>
                    Dismiss
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setReportStatus(r.id, 'actioned')}>
                    Mark actioned
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
