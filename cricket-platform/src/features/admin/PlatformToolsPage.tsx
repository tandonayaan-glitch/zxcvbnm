import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  RefreshCw,
  Trash2,
  ShieldAlert,
  ScrollText,
  AlertTriangle,
  DatabaseBackup,
  Gauge,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  PageLoader,
  Badge,
  EmptyState,
  StatCard,
} from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuthStore } from '@/store/authStore'
import {
  recomputeAllStats,
  recomputeTournamentStandings,
} from '@/services/stats.service'
import { listTournaments } from '@/services/tournaments.service'
import { clearLeaderboards, gatherPlatformBackup } from '@/services/admin.service'
import { getPlatformDiagnostics } from '@/services/diagnostics.service'
import { logAudit, listAuditLogs } from '@/services/audit.service'
import { platformBackupToJSON } from '@/domain/platformExport'
import { downloadBlob } from '@/lib/download'
import { formatDateTime } from '@/lib/format'

const CONFIRM_PHRASE = 'CLEAR LEADERBOARDS'

export function PlatformToolsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const online = useOnlineStatus()
  const audits = useAsync(() => listAuditLogs(50), [])
  const diagnostics = useAsync(getPlatformDiagnostics, [])
  const [rebuilding, setRebuilding] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showClear, setShowClear] = useState(false)

  async function rebuild() {
    setRebuilding(true)
    try {
      await recomputeAllStats()
      const tournaments = await listTournaments()
      for (const t of tournaments) await recomputeTournamentStandings(t.id)
      await logAudit(profile, 'Rebuilt leaderboards & standings')
      toast.success('Leaderboards & standings rebuilt from match history')
      audits.refetch()
    } catch {
      toast.error('Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  async function exportBackup() {
    setExporting(true)
    try {
      const backup = await gatherPlatformBackup()
      const stamp = new Date(backup.exportedAt).toISOString().slice(0, 10)
      downloadBlob(
        `crickethub-backup-${stamp}.json`,
        platformBackupToJSON(backup),
        'application/json',
      )
      await logAudit(
        profile,
        'Exported platform backup',
        `${backup.players.length} players, ${backup.teams.length} teams, ` +
          `${backup.tournaments.length} tournaments, ${backup.matches.length} matches`,
      )
      toast.success('Backup downloaded')
      audits.refetch()
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Platform tools"
        subtitle="Master-admin only — maintenance, leaderboard controls and audit log."
      />

      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Gauge size={18} /> System diagnostics
            </span>
          }
          subtitle="Firestore document counts (server-side aggregate counts — no document downloads) and connectivity."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => diagnostics.refetch()}
              loading={diagnostics.loading}
            >
              <RefreshCw size={14} /> Refresh
            </Button>
          }
        />
        <CardBody>
          <div className="mb-3 flex items-center gap-2 text-sm">
            {online ? (
              <>
                <Wifi size={16} className="text-pitch-600" />
                <Badge tone="green">Online</Badge>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-red-600" />
                <Badge tone="red">Offline</Badge>
              </>
            )}
            {diagnostics.data && (
              <span className="text-xs text-ink-400">
                as of {formatDateTime(diagnostics.data.generatedAt)}
              </span>
            )}
          </div>
          {diagnostics.loading ? (
            <PageLoader />
          ) : diagnostics.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Players" value={diagnostics.data.counts.players} tone="blue" />
              <StatCard label="Teams" value={diagnostics.data.counts.teams} tone="green" />
              <StatCard label="Tournaments" value={diagnostics.data.counts.tournaments} tone="amber" />
              <StatCard label="Matches" value={diagnostics.data.counts.matches} tone="purple" />
              <StatCard label="Deliveries" value={diagnostics.data.counts.deliveries} tone="blue" />
              <StatCard label="Users" value={diagnostics.data.counts.users} tone="green" />
              <StatCard label="Audit entries" value={diagnostics.data.counts.auditLogs} tone="amber" />
              <StatCard label="Admin requests" value={diagnostics.data.counts.adminRequests} tone="purple" />
            </div>
          ) : (
            <EmptyState title="Could not load diagnostics" />
          )}
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Maintenance"
          subtitle="Rebuild cached leaderboards and standings from all completed matches."
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={rebuild} loading={rebuilding}>
            <RefreshCw size={16} /> Recompute leaderboards & standings
          </Button>
          <Button variant="outline" onClick={exportBackup} loading={exporting}>
            <DatabaseBackup size={16} /> Export platform backup (JSON)
          </Button>
        </CardBody>
      </Card>

      <Card className="mb-4 border-red-300">
        <CardHeader
          className="bg-red-50"
          title={
            <span className="flex items-center gap-2 text-red-700">
              <ShieldAlert size={18} /> Danger zone
            </span>
          }
          subtitle="Irreversible actions. Reserved for the master admin."
        />
        <CardBody>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-800">
              Clear all leaderboards
            </span>
            <span className="text-xs text-ink-500">
              Permanently removes cached player &amp; team rankings and tournament
              standings. Match data is kept, so you can rebuild afterwards.
            </span>
          </div>
          <Button
            variant="danger"
            className="mt-3"
            onClick={() => setShowClear(true)}
          >
            <Trash2 size={16} /> Clear leaderboards…
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ScrollText size={18} /> Audit log
            </span>
          }
          subtitle="Recent privileged actions."
        />
        <CardBody className="p-0">
          {audits.loading ? (
            <PageLoader />
          ) : (audits.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState title="No audit entries yet" />
            </div>
          ) : (
            <div className="divide-y divide-ink-50">
              {(audits.data ?? []).map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink-900">
                      {a.action}
                    </div>
                    {a.details && (
                      <div className="text-xs text-ink-500">{a.details}</div>
                    )}
                    <div className="mt-0.5 text-xs text-ink-400">
                      {a.actorName} · {formatDateTime(a.createdAt)}
                    </div>
                  </div>
                  <Badge tone="gray">{a.actorRole.replace('_', ' ').toLowerCase()}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {showClear && (
        <ClearLeaderboardsDialog
          onClose={() => setShowClear(false)}
          onDone={() => {
            setShowClear(false)
            audits.refetch()
          }}
        />
      )}
    </div>
  )
}

function ClearLeaderboardsDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const [understood, setUnderstood] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)

  const ready = understood && phrase.trim() === CONFIRM_PHRASE

  async function confirm() {
    if (!ready) return
    setWorking(true)
    try {
      const res = await clearLeaderboards()
      await logAudit(
        profile,
        'Cleared all leaderboards',
        `${res.playerStats} player + ${res.teamStats} team + ${res.standings} standings docs removed${
          reason.trim() ? ` · reason: ${reason.trim()}` : ''
        }`,
      )
      toast.success('Leaderboards cleared')
      onDone()
    } catch {
      toast.error('Could not clear leaderboards')
    } finally {
      setWorking(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-red-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-3 text-red-700">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle size={22} />
          </span>
          <h2 className="text-lg font-bold">Clear all leaderboards</h2>
        </div>

        <p className="text-sm text-ink-600">
          This permanently deletes all cached player and team rankings and every
          tournament standings table. It cannot be undone directly — you will need
          to <b>Recompute</b> to rebuild them from match history.
        </p>
        <ul className="mt-3 list-inside list-disc rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <li>Global player leaderboards</li>
          <li>Team stats &amp; form</li>
          <li>Tournament points tables</li>
        </ul>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          I understand this action permanently resets leaderboard rankings.
        </label>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-ink-600">
            Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none"
            placeholder={CONFIRM_PHRASE}
          />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-ink-600">
            Reason (optional)
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="e.g. end of season reset"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!ready} loading={working} onClick={confirm}>
            <Trash2 size={16} /> Permanently clear
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
