import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import type { Role, UserProfile } from '@/types'

/** Where to send a user after authentication, based on role. */
export function homeForRole(role: Role): string {
  return role === 'VIEWER' ? '/' : '/dashboard'
}

/** Same as `homeForRole`, but routes a still-`pending_registration` account
 *  to activation first regardless of role. */
export function destinationForProfile(profile: UserProfile): string {
  if (profile.status === 'pending_registration') return '/activate'
  return homeForRole(profile.role)
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pitch-500 text-white">
              <Trophy size={22} />
            </span>
            <span className="text-2xl font-extrabold text-white">CricketHub</span>
          </Link>
          <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && (
            <div className="mt-5 text-center text-sm text-ink-200">{footer}</div>
          )}
        </div>
      </div>
    </div>
  )
}
