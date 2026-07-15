import { useMemo, useState, type ReactNode } from 'react'
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Users,
  Shield,
  Building2,
  CalendarRange,
  Trophy,
  Swords,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, Button, Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import {
  listTrash,
  bulkRestore,
  bulkPermanentlyDelete,
  purgeExpired,
  type TrashedDoc,
  type TrashEntityType,
} from '@/services/trash.service'
import { getSettings } from '@/services/settings.service'
import { formatDate } from '@/lib/format'
import { useAuthStore, ownerScope } from '@/store/authStore'

const TYPE_LABEL: Record<TrashEntityType, string> = {
  player: 'Player',
  team: 'Team',
  club: 'Club',
  season: 'Season',
  tournament: 'Tournament',
  match: 'Match',
}

const TYPE_ICON: Record<TrashEntityType, ReactNode> = {
  player: <Users size={13} />,
  team: <Shield size={13} />,
  club: <Building2 size={13} />,
  season: <CalendarRange size={13} />,
  tournament: <Trophy size={13} />,
  match: <Swords size={13} />,
}

const DAY_MS = 24 * 60 * 60 * 1000

function itemKey(t: TrashedDoc): string {
  return `${t.type}:${t.id}`
}

export function TrashPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const trash = useAsync(listTrash, [])
  const settings = useAsync(getSettings, [])
  const [typeFilter, setTypeFilter] = useState<TrashEntityType | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmTargets, setConfirmTargets] = useState<TrashedDoc[] | null>(null)
  const [busy, setBusy] = useState(false)

  const scoped = useMemo(
    () => (trash.data ?? []).filter((t) => !scope || t.ownerId === scope),
    [trash.data, scope],
  )
  const filtered = useMemo(
    () => (typeFilter ? scoped.filter((t) => t.type === typeFilter) : scoped),
    [scoped, typeFilter],
  )
  const selectedItems = useMemo(
    () => filtered.filter((t) => selected.has(itemKey(t))),
    [filtered, selected],
  )

  const retentionDays = settings.data?.trashRetentionDays ?? 30
  const cutoff = Date.now() - retentionDays * DAY_MS
  const expiredCount = scoped.filter((t) => t.deletedAt < cutoff).length

  function toggle(t: TrashedDoc) {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = itemKey(t)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  async function doRestore(items: TrashedDoc[]) {
    setBusy(true)
    try {
      await bulkRestore(
        items.map((t) => ({ type: t.type, id: t.id })),
        profile,
      )
      toast.success(items.length === 1 ? 'Restored' : `Restored ${items.length} items`)
      setSelected(new Set())
      trash.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setBusy(false)
    }
  }

  async function doPermanentDelete(items: TrashedDoc[]) {
    setBusy(true)
    try {
      await bulkPermanentlyDelete(
        items.map((t) => ({ type: t.type, id: t.id })),
        profile,
      )
      toast.success(
        items.length === 1 ? 'Permanently deleted' : `Permanently deleted ${items.length} items`,
      )
      setSelected(new Set())
      setConfirmTargets(null)
      trash.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function doPurgeExpired() {
    setBusy(true)
    try {
      const n = await purgeExpired(retentionDays, profile)
      toast.success(n ? `Purged ${n} expired item${n === 1 ? '' : 's'}` : 'Nothing to purge')
      trash.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Purge failed')
    } finally {
      setBusy(false)
    }
  }

  if (trash.loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Trash"
        subtitle={`Deleted players, teams, clubs, seasons, tournaments and matches are kept here for ${retentionDays} days so you can undo a mistake, then can be purged for good.`}
      />

      {expiredCount > 0 && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/30">
          <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              {expiredCount} item{expiredCount === 1 ? '' : 's'} past the {retentionDays}-day
              retention window.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={doPurgeExpired} disabled={busy}>
            Purge expired now
          </Button>
        </Card>
      )}

      {scoped.length > 0 && (
        <Card className="mb-4 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTypeFilter('')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !typeFilter
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'
              }`}
            >
              All ({scoped.length})
            </button>
            {(Object.keys(TYPE_LABEL) as TrashEntityType[]).map((t) => {
              const count = scoped.filter((x) => x.type === t).length
              if (!count) return null
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-brand-600 text-white'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'
                  }`}
                >
                  {TYPE_LABEL[t]} ({count})
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {selectedItems.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-sm font-medium text-ink-700 dark:text-ink-300">
            {selectedItems.length} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => doRestore(selectedItems)}
              disabled={busy}
            >
              <RotateCcw size={14} /> Restore
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmTargets(selectedItems)}
              disabled={busy}
            >
              <Trash2 size={14} /> Delete permanently
            </Button>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Trash2 size={40} />}
          title="Trash is empty"
          description="Deleted players, teams, clubs, seasons, tournaments and matches show up here, restorable until purged."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Deleted</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={itemKey(t)}
                    className="border-b border-ink-50 dark:border-ink-800 hover:bg-ink-50/50 dark:hover:bg-ink-800/30"
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(itemKey(t))}
                        onChange={() => toggle(t)}
                        aria-label={`Select ${t.label}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ink-50">
                      {t.label}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="gray">
                        <span className="flex items-center gap-1">
                          {TYPE_ICON[t.type]} {TYPE_LABEL[t.type]}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-500 dark:text-ink-400">
                      {formatDate(t.deletedAt)}
                      {t.deletedAt < cutoff && (
                        <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                          expired
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Restore"
                          aria-label={`Restore ${t.label}`}
                          onClick={() => doRestore([t])}
                          disabled={busy}
                          className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-50"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          title="Delete permanently"
                          aria-label={`Permanently delete ${t.label}`}
                          onClick={() => setConfirmTargets([t])}
                          disabled={busy}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!confirmTargets}
        onClose={() => !busy && setConfirmTargets(null)}
        title="Permanently delete?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmTargets(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmTargets && doPermanentDelete(confirmTargets)}
              disabled={busy}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          {confirmTargets?.length === 1
            ? `Permanently delete "${confirmTargets[0].label}"?`
            : `Permanently delete ${confirmTargets?.length} items?`}{' '}
          This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
