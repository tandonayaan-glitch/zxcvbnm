import { useState } from 'react'
import { Flag, Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Switch,
  Textarea,
} from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import {
  listFlags,
  upsertFlag,
  disableFlag,
  deleteFlag,
  type FlagInput,
} from '@/services/featureFlags.service'
import { formatDateTime } from '@/lib/format'
import type { FeatureFlag } from '@/types'

const EMPTY_FORM: FlagInput = {
  key: '',
  name: '',
  description: '',
  enabled: false,
  rolloutPercent: 100,
  betaOnly: false,
}

export function FeatureFlagsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const flags = useAsync(listFlags, [])
  const [editing, setEditing] = useState<FlagInput | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<FeatureFlag | null>(null)

  async function toggleEnabled(flag: FeatureFlag) {
    try {
      if (flag.enabled) {
        await disableFlag(flag, profile)
        toast.success(`"${flag.key}" disabled`)
      } else {
        await upsertFlag({ ...flag, enabled: true }, profile)
        toast.success(`"${flag.key}" enabled`)
      }
      flags.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function save() {
    if (!editing) return
    if (!editing.key.trim() || !editing.name.trim()) {
      toast.error('Key and name are required.')
      return
    }
    setSaving(true)
    try {
      await upsertFlag(
        {
          ...editing,
          key: editing.key.trim(),
          name: editing.name.trim(),
          rolloutPercent: Math.max(0, Math.min(100, Number(editing.rolloutPercent) || 0)),
        },
        profile,
      )
      toast.success('Flag saved')
      setEditing(null)
      flags.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    if (!confirmDelete) return
    try {
      await deleteFlag(confirmDelete.key, profile)
      toast.success('Flag deleted')
      setConfirmDelete(null)
      flags.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (flags.loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Feature Flags"
        subtitle="Toggle experimental features, roll them out gradually, or kill-switch them instantly."
        actions={
          <Button
            onClick={() => {
              setEditing(EMPTY_FORM)
              setIsNew(true)
            }}
          >
            <Plus size={16} /> New flag
          </Button>
        }
      />

      {(flags.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Flag size={40} />}
          title="No feature flags yet"
          description="Create one to gate an experimental feature, roll it out gradually, or make it beta-only."
          action={
            <Button
              onClick={() => {
                setEditing(EMPTY_FORM)
                setIsNew(true)
              }}
            >
              <Plus size={16} /> New flag
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {(flags.data ?? []).map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink-900 dark:text-ink-50">
                      {f.key}
                    </span>
                    <Badge tone={f.enabled ? 'green' : 'gray'}>
                      {f.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {f.betaOnly && <Badge tone="purple">Beta only</Badge>}
                    {f.enabled && f.rolloutPercent < 100 && (
                      <Badge tone="amber">{f.rolloutPercent}% rollout</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-medium text-ink-800 dark:text-ink-200">
                    {f.name}
                  </div>
                  {f.description && (
                    <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                      {f.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-ink-400 dark:text-ink-500">
                    Updated {formatDateTime(f.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span title={f.enabled ? 'Emergency disable' : 'Enable'}>
                    <Switch
                      checked={f.enabled}
                      onChange={() => toggleEnabled(f)}
                      label={`${f.enabled ? 'Disable' : 'Enable'} ${f.key}`}
                    />
                  </span>
                  <button
                    onClick={() => {
                      setEditing(f)
                      setIsNew(false)
                    }}
                    aria-label={`Edit ${f.key}`}
                    title="Edit"
                    className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(f)}
                    aria-label={`Delete ${f.key}`}
                    title="Delete"
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={isNew ? 'New feature flag' : `Edit "${editing?.key}"`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Key" required hint="Stable identifier used in code, e.g. new-scorecard-layout">
              <Input
                value={editing.key}
                onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                disabled={!isNew}
                placeholder="my-experimental-feature"
              />
            </Field>
            <Field label="Name" required>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={editing.description ?? ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="What this flag controls…"
              />
            </Field>
            <Field label="Rollout percentage" hint="Applies once enabled — 100% reaches everyone.">
              <Input
                type="number"
                min={0}
                max={100}
                value={editing.rolloutPercent}
                onChange={(e) =>
                  setEditing({ ...editing, rolloutPercent: Number(e.target.value) })
                }
              />
            </Field>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-800 dark:text-ink-200">
              <input
                type="checkbox"
                checked={editing.betaOnly}
                onChange={(e) => setEditing({ ...editing, betaOnly: e.target.checked })}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                Beta only
                <span className="block text-xs text-ink-500 dark:text-ink-400">
                  Only reaches users who've opted into beta features on Settings.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-800 dark:text-ink-200">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                className="mt-0.5 h-4 w-4"
              />
              <span>Enabled</span>
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-500" /> Delete flag?
          </span>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Delete "{confirmDelete?.key}"? Any code checking this flag will fall back to off.
        </p>
      </Modal>
    </div>
  )
}
