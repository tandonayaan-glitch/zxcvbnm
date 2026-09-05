import {
  forwardRef,
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { initials, colorFromString } from '@/lib/format'

/* ------------------------------ Button ------------------------------ */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variantCls: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  secondary:
    'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-sm dark:bg-ink-700 dark:hover:bg-ink-600 dark:active:bg-ink-800',
  ghost:
    'bg-transparent text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  outline:
    'border border-ink-300 bg-white text-ink-800 hover:bg-ink-50 active:bg-ink-100 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800 dark:active:bg-ink-800',
}
const sizeCls: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', loading, block, children, disabled, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        variantCls[variant],
        sizeCls[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size={16} className="text-current" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

/* ------------------------------ Card ------------------------------ */
export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-200 bg-white shadow-sm dark:border-ink-800 dark:bg-ink-900',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 dark:border-ink-800',
        className,
      )}
    >
      <div>
        <h3 className="font-semibold text-ink-900 dark:text-ink-50">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function CardBody({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('p-5', className)}>{children}</div>
}

/* ------------------------------ Inputs ------------------------------ */
export function Label({
  children,
  htmlFor,
  required,
  className,
}: {
  children: ReactNode
  htmlFor?: string
  required?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300',
        className,
      )}
    >
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  )
}

const fieldCls =
  'w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500 dark:focus:ring-brand-900 dark:disabled:bg-ink-800 dark:disabled:text-ink-500'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldCls, className)} {...rest} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cn(fieldCls, 'min-h-20', className)} {...rest} />
))
Textarea.displayName = 'Textarea'

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...rest }, ref) => (
  <select ref={ref} className={cn(fieldCls, 'pr-8', className)} {...rest}>
    {children}
  </select>
))
Select.displayName = 'Select'

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  // Give the (single) form control an id so the label is programmatically
  // associated with it — screen readers otherwise only announce "edit text"
  // for a visually-adjacent-but-unlinked label. Silently skipped if `children`
  // isn't exactly one element (e.g. a wrapper `<div>` around two inputs).
  const id = useId()
  const child =
    label && isValidElement(children)
      ? cloneElement(children as ReactElement<{ id?: string }>, { id })
      : children
  return (
    <div>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {child}
      {hint && !error && (
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/* ------------------------------ Switch ------------------------------ */
/**
 * The one canonical on/off switch for the whole app. A rounded track with a
 * clearly visible circular white thumb that slides between the two ends — the
 * thumb stays white (and shadowed) in BOTH states so it reads as a switch, not
 * a solid pill, in light and dark mode. Real `role="switch"` semantics,
 * keyboard-operable, with a compact focus ring (no full-element outline).
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  id,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  /** Accessible name when the switch isn't already wrapped in a <label>. */
  label?: string
  id?: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors duration-200',
        'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-ink-900',
        checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

/* ------------------------------ Badge ------------------------------ */
type BadgeTone = 'gray' | 'green' | 'blue' | 'red' | 'amber' | 'purple'
const toneCls: Record<BadgeTone, string> = {
  gray: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
  green: 'bg-pitch-100 text-pitch-800 dark:bg-pitch-900/40 dark:text-pitch-300',
  blue: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}
export function Badge({
  tone = 'gray',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        toneCls[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-600">
      <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
      Live
    </span>
  )
}

/* ------------------------------ Spinner ------------------------------ */
export function Spinner({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      className={cn('animate-spin text-brand-600', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-12 text-ink-500 dark:text-ink-400">
      <Spinner size={32} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

/* ------------------------------ EmptyState ------------------------------ */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center dark:border-ink-700 dark:bg-ink-900">
      {icon && <div className="mb-3 text-ink-400 dark:text-ink-500">{icon}</div>}
      <h3 className="font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ------------------------------ Avatar ------------------------------ */
export function Avatar({
  name,
  src,
  size = 40,
  square,
}: {
  name: string
  src?: string | null
  size?: number
  square?: boolean
}) {
  const [imgFailed, setImgFailed] = useState(false)

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn('object-cover', square ? 'rounded-md' : 'rounded-full')}
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    )
  }
  // No src, or the image failed to load — show initials rather than the browser's broken glyph.
  return (
    <div
      className={cn(
        'flex items-center justify-center font-bold text-white',
        square ? 'rounded-md' : 'rounded-full',
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFromString(name),
        fontSize: size * 0.38,
      }}
    >
      {initials(name)}
    </div>
  )
}

/* ------------------------------ StatCard ------------------------------ */
export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
  hint,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: BadgeTone
  hint?: string
}) {
  const bg: Record<BadgeTone, string> = {
    gray: 'bg-ink-200 text-ink-700',
    green: 'bg-pitch-500 text-white',
    blue: 'bg-brand-500 text-white',
    red: 'bg-red-500 text-white',
    amber: 'bg-amber-500 text-white',
    purple: 'bg-purple-500 text-white',
  }
  const cardTint: Record<BadgeTone, string> = {
    gray: 'border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800/60',
    green: 'border-pitch-200 bg-pitch-50 dark:border-pitch-900 dark:bg-pitch-900/20',
    blue: 'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-900/20',
    red: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-900/20',
  }
  return (
    <Card className={cn('p-3 sm:p-4', cardTint[tone])}>
      <div className="flex items-center gap-2.5 sm:gap-3">
        {icon && (
          <div className={cn('shrink-0 rounded-lg p-2 shadow-sm sm:p-2.5', bg[tone])}>
            {icon}
          </div>
        )}
        {/* `min-w-0` lets the label shrink and wrap inside a narrow 2-up grid
            cell instead of forcing the card wider than the column (the mobile
            "Tournaments" squish). Long single words break as a last resort. */}
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight text-ink-900 dark:text-ink-50 sm:text-2xl">
            {value}
          </div>
          <div className="text-[13px] leading-snug text-ink-500 [overflow-wrap:anywhere] dark:text-ink-400 sm:text-sm">
            {label}
          </div>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">{hint}</p>}
    </Card>
  )
}
