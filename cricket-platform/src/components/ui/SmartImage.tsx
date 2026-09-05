import { useState, type ImgHTMLAttributes } from 'react'
import { ImageOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null
  /** Short label shown under the icon in the unavailable state (e.g. "Logo unavailable"). */
  fallbackLabel?: string
  /** Hide the retry affordance in the error state (for tiny thumbnails where it wouldn't fit). */
  noRetry?: boolean
}

/**
 * `<img>` that never leaves the browser's native broken-image glyph on screen.
 *
 * - No `src` (null/empty) → renders the branded unavailable state directly, no request, no flash.
 * - `src` that 404s / 403s / fails CORS → swaps to the same branded state on the `error` event.
 * - The fallback fills the box the caller sized via `className`, so card layout never shifts.
 * - Retry re-requests with a cache-busting query param so a transient failure can recover without
 *   a full remount.
 */
export function SmartImage({ src, alt, className, fallbackLabel, noRetry, ...rest }: Props) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const showFallback = !src || failed

  if (showFallback) {
    return (
      <span
        className={cn(
          'flex flex-col items-center justify-center gap-1 bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500',
          className,
        )}
        role="img"
        aria-label={alt || fallbackLabel || 'Image unavailable'}
      >
        <ImageOff size={16} aria-hidden />
        {fallbackLabel && <span className="px-1 text-center text-[10px] leading-tight">{fallbackLabel}</span>}
        {src && failed && !noRetry && (
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              setAttempt((n) => n + 1)
            }}
            className="mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-ink-500 hover:bg-ink-200 dark:text-ink-400 dark:hover:bg-ink-700"
          >
            <RefreshCw size={10} aria-hidden />
            Retry
          </button>
        )}
      </span>
    )
  }

  const url = attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}chr=${attempt}` : src
  return (
    <img
      {...rest}
      src={url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
