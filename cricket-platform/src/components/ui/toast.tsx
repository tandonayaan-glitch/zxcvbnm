import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastKind = 'success' | 'error' | 'info'
export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}
interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

interface ToastCtx {
  push: (kind: ToastKind, message: string, action?: ToastAction) => void
  success: (m: string, action?: ToastAction) => void
  error: (m: string, action?: ToastAction) => void
  info: (m: string, action?: ToastAction) => void
  /** Convenience: success message with an Undo action (stays a little longer). */
  undo: (message: string, onUndo: () => void | Promise<void>) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  )

  const push = useCallback(
    (kind: ToastKind, message: string, action?: ToastAction) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { id, kind, message, action }])
      setTimeout(() => remove(id), action ? 7000 : 4000)
    },
    [remove],
  )

  const api: ToastCtx = {
    push,
    success: (m, action) => push('success', m, action),
    error: (m, action) => push('error', m, action),
    info: (m, action) => push('info', m, action),
    undo: (message, onUndo) =>
      push('success', message, { label: 'Undo', onClick: onUndo }),
  }

  const icons = {
    success: <CheckCircle2 size={18} className="text-pitch-600" />,
    error: <AlertCircle size={18} className="text-red-600" />,
    info: <Info size={18} className="text-brand-600" />,
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                'animate-fade-in flex items-center gap-2.5 rounded-lg border bg-white px-3.5 py-3 shadow-lg dark:bg-ink-800',
                t.kind === 'error' ? 'border-red-200 dark:border-red-900' : 'border-ink-200 dark:border-ink-700',
              )}
            >
              {icons[t.kind]}
              <p className="flex-1 text-sm text-ink-800 dark:text-ink-100">{t.message}</p>
              {t.action && (
                <button
                  onClick={() => {
                    void t.action!.onClick()
                    remove(t.id)
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2 py-1 text-xs font-semibold text-white hover:bg-ink-700 dark:bg-ink-700 dark:hover:bg-ink-600"
                >
                  <Undo2 size={13} /> {t.action.label}
                </button>
              )}
              <button
                onClick={() => remove(t.id)}
                aria-label="Dismiss notification"
                className="text-ink-400 hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-200"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
