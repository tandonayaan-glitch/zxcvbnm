import { useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button, PageLoader } from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { confirmDialog } from '@/components/ui/confirm'
import { useAuthStore } from '@/store/authStore'
import { listVersions, restoreVersion } from '@/services/versionHistory.service'
import { formatDateTime } from '@/lib/format'
import type { EntityVersion, VersionedEntity } from '@/types'

/** Humanize a camelCase/lowercase field key for the change summary line. */
function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

export function VersionHistoryModal({
  entityType,
  entityId,
  onClose,
  onRestored,
}: {
  entityType: VersionedEntity
  entityId: string
  onClose: () => void
  onRestored?: () => void
}) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const versions = useAsync(() => listVersions(entityType, entityId), [entityType, entityId])
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function doRestore(v: EntityVersion) {
    if (
      !(await confirmDialog({
        title: 'Restore this version',
        message: `Restore this version from ${formatDateTime(v.createdAt)}? The current values will be saved as a new history entry first, so this can be undone.`,
        confirmLabel: 'Restore',
        tone: 'primary',
      }))
    ) {
      return
    }
    setRestoringId(v.id)
    try {
      await restoreVersion(v, profile)
      toast.success('Version restored')
      onRestored?.()
      versions.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <History size={18} /> Edit history
        </span>
      }
      size="lg"
    >
      {versions.loading ? (
        <PageLoader />
      ) : (versions.data ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500 dark:text-ink-400">
          No edits recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {(versions.data ?? []).map((v) => (
            <div
              key={v.id}
              className="rounded-lg border border-ink-200 p-3 dark:border-ink-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-50">
                    {v.editedByName ?? 'Unknown'}
                    <span className="ml-2 font-normal text-ink-400 dark:text-ink-500">
                      {formatDateTime(v.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                    Changed: {v.changedFields.map(fieldLabel).join(', ') || '—'}
                  </div>
                  {v.reason && (
                    <div className="mt-1 text-xs italic text-ink-500 dark:text-ink-400">
                      "{v.reason}"
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => doRestore(v)}
                  loading={restoringId === v.id}
                >
                  <RotateCcw size={13} /> Restore
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
