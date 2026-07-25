import { Share2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/toast'

async function share(
  title: string,
  url: string,
  onCopied: () => void,
  onCopyFailed: () => void,
) {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (nav.share) {
    try {
      await nav.share({ title, url })
      return
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // fall through to clipboard copy on any other share failure
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    onCopied()
  } catch {
    // clipboard-write can reject for reasons outside our control (focus,
    // permissions, insecure context) — surface it rather than fail silently.
    onCopyFailed()
  }
}

/**
 * Copies/shares the current page's canonical URL. Uses the native share sheet where available
 * (mostly mobile), otherwise copies to clipboard. `url` defaults to the current location so every
 * public page can drop this in without threading its own permalink through.
 */
export function ShareButton({
  title,
  url,
  variant = 'button',
  className,
}: {
  title: string
  url?: string
  variant?: 'button' | 'icon'
  className?: string
}) {
  const toast = useToast()

  function onClick() {
    share(
      title,
      url ?? window.location.href,
      () => toast.success('Link copied to clipboard'),
      () => toast.error('Could not copy link — copy it from the address bar instead'),
    )
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={onClick}
        aria-label="Share"
        title="Share"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-300 bg-white text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
          className,
        )}
      >
        <Share2 size={15} />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
        className,
      )}
    >
      <Share2 size={15} />
      Share
    </button>
  )
}
