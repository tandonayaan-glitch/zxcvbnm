import { type ReactNode } from 'react'
import { create } from 'zustand'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Imperative, promise-based replacement for `window.confirm()`.
 *
 * Native `confirm()` is a silent no-op in some embedded webviews and after a
 * browser's "prevent this page from creating more dialogs" opt-out — which reads
 * as a dead button — and it can't match the app's look. `confirmDialog(opts)`
 * resolves to `true` / `false` exactly like `window.confirm`, so call sites keep
 * their existing `if (!(await confirmDialog(...))) return` shape.
 *
 * Render <ConfirmHost/> once near the app root.
 */

type ConfirmOpts = {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

interface ConfirmState {
  current: (ConfirmOpts & { resolve: (ok: boolean) => void }) | null
  open: (opts: ConfirmOpts) => Promise<boolean>
  settle: (ok: boolean) => void
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  open: (opts) =>
    new Promise<boolean>((resolve) => {
      // If one is already open, resolve it as cancelled before replacing it.
      get().current?.resolve(false)
      set({ current: { ...opts, resolve } })
    }),
  settle: (ok) => {
    const cur = get().current
    if (cur) cur.resolve(ok)
    set({ current: null })
  },
}))

/** Promise-based confirm. Resolves `true` if the user confirms, `false` otherwise. */
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return useConfirmStore.getState().open(opts)
}

/** Mount once (App root). Renders the single shared confirmation modal. */
export function ConfirmHost() {
  const current = useConfirmStore((s) => s.current)
  const settle = useConfirmStore((s) => s.settle)
  return (
    <ConfirmDialog
      open={!!current}
      title={current?.title ?? ''}
      message={current?.message ?? ''}
      confirmLabel={current?.confirmLabel}
      cancelLabel={current?.cancelLabel}
      tone={current?.tone ?? 'danger'}
      onConfirm={() => settle(true)}
      onClose={() => settle(false)}
    />
  )
}
