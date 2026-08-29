import { type ReactNode, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './primitives'

/**
 * A small, reliable in-app replacement for `window.confirm()` for destructive actions.
 * Native `confirm()` is silently a no-op in some embedded webviews and after a browser's
 * "prevent this page from creating more dialogs" opt-out — which reads to the user as a dead
 * button. This renders a real modal instead, and shows the async error inline if `onConfirm`
 * rejects rather than swallowing it.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  /** May be async; if it throws, the message is shown inline and the dialog stays open. */
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-600 dark:text-ink-300">{message}</div>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  )
}
