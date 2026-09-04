import { type ReactNode, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="animate-fade-in-opacity absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          // `dvh` so the sheet fits the *visible* viewport on iOS Safari (URL bar
          // in/out) instead of being clipped by browser chrome.
          'animate-fade-in relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-ink-900',
          widths[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3 dark:border-ink-800">
            <h3 id={titleId} className="text-lg font-semibold text-ink-900 dark:text-ink-50">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-ink-800 dark:bg-ink-800/60 sm:pb-3">
            {footer}
          </div>
        ) : (
          // No footer: keep the last of the scrolled content clear of the iOS
          // home indicator on the full-width mobile sheet.
          <div className="pb-[env(safe-area-inset-bottom)] sm:hidden" />
        )}
      </div>
    </div>,
    document.body,
  )
}
