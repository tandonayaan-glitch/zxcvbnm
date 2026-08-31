import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
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
  RotateCw,
  Bug,
  Wrench,
  CheckCircle2,
  BarChart3,
  Search,
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
  Input,
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
import { getPlatformDiagnostics, forceResync } from '@/services/diagnostics.service'
import { SyncQueuePanel } from '@/components/ui/SyncQueuePanel'
import { logAudit, listAuditLogs } from '@/services/audit.service'
import { listClientErrors } from '@/services/errorLog.service'
import { scanDataIntegrity, repairIssue } from '@/services/dataIntegrity.service'
import { platformBackupToJSON } from '@/domain/platformExport'
import { summarizeErrors } from '@/domain/errorMonitoring'
import { GrowthChart } from '@/components/charts/GrowthChart'
import { downloadBlob } from '@/lib/download'
import { formatDateTime, briefUA } from '@/lib/format'
import type { IntegrityIssue } from '@/types'

const CONFIRM_PHRASE = 'CLEAR LEADERBOARDS'

export function PlatformToolsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const online = useOnlineStatus()
  const audits = useAsync(() => listAuditLogs(200), [])
  const [auditSearch, setAuditSearch] = useState('')
  const errors = useAsync(() => listClientErrors(200), [])
  const integrity = useAsync(scanDataIntegrity, [])
  const diagnostics = useAsync(getPlatformDiagnostics, [])
  const [rebuilding, setRebuilding] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [showClear, setShowClear] = useState(false)
  const [repairingId, setRepairingId] = useState<string | null>(null)

  async function repair(issue: IntegrityIssue) {
    setRepairingId(issue.id)
    try {
      await repairIssue(issue, profile)
      toast.success('Issue fixed')
      integrity.refetch()
      audits.refetch()
    } catch {
      toast.error('Repair failed')
    } finally {
      setRepairingId(null)
    }
  }

  async function resync() {
    setResyncing(true)
    try {
      const { ms, flushed } = await forceResync()
      if (flushed) {
        toast.success(`Resynced in ${ms}ms`)
      } else {
        toast.info('Reconnected — writes still pending, will finish syncing once online')
      }
    } catch {
      toast.error('Resync failed')
    } finally {
      setResyncing(false)
    }
  }

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
        actions={
          <Link
            to="/admin/analytics"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <BarChart3 size={16} /> Platform analytics
          </Link>
        }
      />

      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Gauge size={18} /> System diagnostics
            </span>
          }
          subtitle="Firestore document counts (server-side aggregate counts; deliveries summed per match) and connectivity."
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
              <span className="text-xs text-ink-400 dark:text-ink-500">
                as of {formatDateTime(diagnostics.data.generatedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={resync}
              loading={resyncing}
            >
              <RotateCw size={14} /> Force resync
            </Button>
          </div>
          <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
            Drops and re-establishes the Firestore connection, then waits for any writes queued
            while offline to be acknowledged by the server.
          </p>
          <SyncQueuePanel className="mb-3" />
          {diagnostics.loading ? (
            <PageLoader />
          ) : diagnostics.data ? (
            <>
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
              {diagnostics.data.deliveriesPartial && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Delivery total is partial — one or more matches' ball logs couldn't be read
                  this run. Refresh to retry.
                </p>
              )}
            </>
          ) : (
            <EmptyState
              icon={<AlertTriangle size={36} />}
              title="Couldn't load diagnostics"
              description={
                diagnostics.error
                  ? `The counts query failed: ${diagnostics.error}`
                  : 'The counts query failed.'
              }
              action={
                <Button variant="outline" onClick={() => diagnostics.refetch()}>
                  <RefreshCw size={14} /> Try again
                </Button>
              }
            />
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

      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wrench size={18} /> Data integrity
            </span>
          }
          subtitle="Detects broken references and orphaned cached stats; only offers a fix where it's safe (never rewrites match/scorecard data)."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => integrity.refetch()}
              loading={integrity.loading}
            >
              <RefreshCw size={14} /> Scan again
            </Button>
          }
        />
        <CardBody className="p-0">
          {integrity.loading ? (
            <PageLoader />
          ) : (integrity.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CheckCircle2 size={40} />}
                title="No issues found"
                description="Every roster, tournament and stats reference checks out."
              />
            </div>
          ) : (
            <div className="divide-y divide-ink-50 dark:divide-ink-800">
              {(integrity.data ?? []).map((issue) => (
                <div key={issue.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">
                        {issue.label}
                      </span>
                      <Badge tone={issue.severity === 'repairable' ? 'amber' : 'gray'}>
                        {issue.severity === 'repairable' ? 'Fixable' : 'Info'}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                      {issue.description}
                    </div>
                  </div>
                  {issue.severity === 'repairable' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => repair(issue)}
                      loading={repairingId === issue.id}
                    >
                      Fix
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mb-4 border-red-300 dark:border-red-900/60">
        <CardHeader
          className="bg-red-50 dark:bg-red-950/30"
          title={
            <span className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <ShieldAlert size={18} /> Danger zone
            </span>
          }
          subtitle="Irreversible actions. Reserved for the master admin."
        />
        <CardBody>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-800 dark:text-ink-200">
              Clear all leaderboards
            </span>
            <span className="text-xs text-ink-500 dark:text-ink-400">
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

      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Bug size={18} /> Client errors
            </span>
          }
          subtitle="Runtime errors caught by the app's error boundary, most recent first."
        />
        <CardBody className="p-0">
          {errors.loading ? (
            <PageLoader />
          ) : (errors.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState title="No errors logged" description="Nothing's crashed recently." />
            </div>
          ) : (
            <>
              {(() => {
                const summary = summarizeErrors(errors.data ?? [])
                return (
                  <div className="space-y-3 border-b border-ink-50 p-4 dark:border-ink-800">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge tone={summary.totalLast7Days > 0 ? 'amber' : 'gray'}>
                        {summary.totalLast7Days} in the last 7 days
                      </Badge>
                      {summary.topRoutes.slice(0, 3).map((r) => (
                        <span
                          key={r.route}
                          className="text-xs text-ink-500 dark:text-ink-400"
                        >
                          {r.route} ({r.count})
                        </span>
                      ))}
                    </div>
                    <GrowthChart title="Errors — last 14 days" data={summary.errorsPerDay} />
                    {summary.topMessages.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-semibold text-ink-500 dark:text-ink-400">
                          Most frequent
                        </div>
                        <ul className="space-y-1">
                          {summary.topMessages.map((m) => (
                            <li
                              key={m.message}
                              className="flex items-center justify-between gap-3 text-xs text-ink-600 dark:text-ink-300"
                            >
                              <span className="truncate">{m.message}</span>
                              <Badge tone="gray">{m.count}×</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="divide-y divide-ink-50 dark:divide-ink-800">
                {(errors.data ?? []).map((e) => (
                <div key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">
                        {e.message}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">
                        {e.route} · {formatDateTime(e.createdAt)}
                      </div>
                    </div>
                    <Badge tone="red">{e.referenceId}</Badge>
                  </div>
                </div>
                ))}
              </div>
            </>
          )}
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
            <>
              <div className="border-b border-ink-50 p-3 dark:border-ink-800">
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500"
                  />
                  <Input
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search action, details, or actor…"
                    className="pl-9"
                  />
                </div>
              </div>
              {(() => {
                const q = auditSearch.trim().toLowerCase()
                const shown = q
                  ? (audits.data ?? []).filter(
                      (a) =>
                        a.action.toLowerCase().includes(q) ||
                        (a.details ?? '').toLowerCase().includes(q) ||
                        a.actorName.toLowerCase().includes(q),
                    )
                  : (audits.data ?? [])
                if (shown.length === 0) {
                  return (
                    <div className="p-5">
                      <EmptyState title="No matching audit entries" />
                    </div>
                  )
                }
                return (
                  <div className="divide-y divide-ink-50">
                    {shown.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-ink-900 dark:text-ink-50">
                            {a.action}
                          </div>
                          {a.details && (
                            <div className="text-xs text-ink-500 dark:text-ink-400">{a.details}</div>
                          )}
                          {(a.before !== undefined || a.after !== undefined) && (
                            <div className="mt-0.5 font-mono text-xs text-ink-500 dark:text-ink-400">
                              {String(a.before ?? '—')} → {String(a.after ?? '—')}
                            </div>
                          )}
                          <div className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">
                            {a.actorName} · {formatDateTime(a.createdAt)}
                            {a.userAgent && (
                              <span title={a.userAgent}> · {briefUA(a.userAgent)}</span>
                            )}
                          </div>
                        </div>
                        <Badge tone="gray">{a.actorRole.replace('_', ' ').toLowerCase()}</Badge>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
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
    <div className="animate-fade-in-opacity fixed inset-0 z-[80] flex items-center justify-center bg-red-950/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-leaderboards-title"
        className="animate-fade-in w-full max-w-lg rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-ink-900 p-6 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-3 text-red-700 dark:text-red-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <AlertTriangle size={22} />
          </span>
          <h2 id="clear-leaderboards-title" className="text-lg font-bold">
            Clear all leaderboards
          </h2>
        </div>

        <p className="text-sm text-ink-600 dark:text-ink-400">
          This permanently deletes all cached player and team rankings and every
          tournament standings table. It cannot be undone directly — you will need
          to <b>Recompute</b> to rebuild them from match history.
        </p>
        <ul className="mt-3 list-inside list-disc rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          <li>Global player leaderboards</li>
          <li>Team stats &amp; form</li>
          <li>Tournament points tables</li>
        </ul>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink-800 dark:text-ink-200">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          I understand this action permanently resets leaderboard rankings.
        </label>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-400">
            Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="w-full rounded-lg border border-ink-300 bg-white text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none"
            placeholder={CONFIRM_PHRASE}
          />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-400">
            Reason (optional)
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-ink-300 bg-white text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
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
