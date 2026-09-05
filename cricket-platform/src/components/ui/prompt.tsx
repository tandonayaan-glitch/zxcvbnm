import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { Modal } from './Modal'
import { Button, Field, Input } from './primitives'

/**
 * Imperative, promise-based replacement for `window.prompt()`.
 *
 * Native `prompt()` is a silent no-op in some embedded webviews and after a browser's
 * "prevent this page from creating more dialogs" opt-out — which reads as a dead button —
 * and it can't match the app's look. `promptDialog(opts)` resolves to the entered string,
 * or `null` if the user cancels, exactly like `window.prompt`.
 *
 * Render <PromptHost/> once near the app root.
 */

type PromptOpts = {
  title: string
  message?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Reject empty/whitespace-only input (Save stays disabled). Default true. */
  required?: boolean
  maxLength?: number
}

interface PromptState {
  current: (PromptOpts & { resolve: (value: string | null) => void }) | null
  open: (opts: PromptOpts) => Promise<string | null>
  settle: (value: string | null) => void
}

const usePromptStore = create<PromptState>((set, get) => ({
  current: null,
  open: (opts) =>
    new Promise<string | null>((resolve) => {
      get().current?.resolve(null)
      set({ current: { ...opts, resolve } })
    }),
  settle: (value) => {
    const cur = get().current
    if (cur) cur.resolve(value)
    set({ current: null })
  },
}))

/** Promise-based prompt. Resolves the entered string, or `null` on cancel. */
export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return usePromptStore.getState().open(opts)
}

/** Mount once (App root). Renders the single shared prompt modal. */
export function PromptHost() {
  const current = usePromptStore((s) => s.current)
  const settle = usePromptStore((s) => s.settle)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (current) setValue(current.defaultValue ?? '')
  }, [current])

  const required = current?.required ?? true
  const trimmed = value.trim()
  const canSubmit = !required || trimmed.length > 0

  function submit() {
    if (!canSubmit) return
    settle(required ? trimmed : value)
  }

  return (
    <Modal
      open={!!current}
      onClose={() => settle(null)}
      title={current?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(null)}>
            {current?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {current?.confirmLabel ?? 'Save'}
          </Button>
        </>
      }
    >
      {current?.message && (
        <p className="mb-2 text-sm text-ink-600 dark:text-ink-300">{current.message}</p>
      )}
      <Field label={current?.label}>
        <Input
          autoFocus
          placeholder={current?.placeholder}
          value={value}
          maxLength={current?.maxLength}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </Field>
    </Modal>
  )
}
