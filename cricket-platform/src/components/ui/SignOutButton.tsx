import { LogOut } from 'lucide-react'
import { Button, Spinner } from '@/components/ui/primitives'
import { useSignOut } from '@/hooks/useSignOut'
import { cn } from '@/lib/cn'

type SignOutVariant = 'sidebar' | 'header' | 'button' | 'link'

/**
 * The one reusable Sign Out control. Wraps {@link useSignOut} so no screen
 * re-implements the "end session → clear state → redirect" sequence. `variant`
 * only changes the skin, never the behaviour:
 *
 *  - `sidebar` — full-width row for the dark app-shell nav
 *  - `header`  — bordered pill for the light public header (text hides < sm)
 *  - `button`  — the standard outline {@link Button} (settings screens)
 *  - `link`    — inline text link (auth / activation screens)
 */
export function SignOutButton({
  variant = 'button',
  label = 'Sign out',
  className,
}: {
  variant?: SignOutVariant
  label?: string
  className?: string
}) {
  const { signOut, signingOut } = useSignOut()

  if (variant === 'button') {
    return (
      <Button variant="outline" onClick={signOut} loading={signingOut} className={className}>
        <LogOut size={16} /> {label}
      </Button>
    )
  }

  const skin =
    variant === 'sidebar'
      ? 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-white/5 hover:text-white'
      : variant === 'header'
        ? 'inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800'
        : 'inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline disabled:opacity-60 dark:text-brand-400'

  const iconSize = variant === 'sidebar' ? 18 : variant === 'link' ? 14 : 16

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      title={label}
      className={cn(skin, 'disabled:cursor-wait', className)}
    >
      {signingOut ? <Spinner size={iconSize} /> : <LogOut size={iconSize} />}
      {variant === 'header' ? <span className="hidden sm:inline">{label}</span> : label}
    </button>
  )
}
