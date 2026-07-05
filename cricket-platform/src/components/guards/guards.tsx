import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, hasRole } from '@/store/authStore'
import { PageLoader, EmptyState, Button } from '@/components/ui/primitives'
import { ShieldAlert } from 'lucide-react'
import type { Role } from '@/types'

/** Requires an authenticated user. Optionally restricts to roles. */
export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode
  roles?: Role[]
}) {
  const { status, profile } = useAuthStore()
  const location = useLocation()

  if (status === 'initializing') return <PageLoader label="Checking session…" />

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !hasRole(profile, ...roles)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          icon={<ShieldAlert size={40} />}
          title="No access"
          description="Your account role doesn't have permission to view this page."
          action={
            <Button onClick={() => window.history.back()}>Go back</Button>
          }
        />
      </div>
    )
  }

  return <>{children}</>
}

/** Inline gate for conditionally rendering actions by role. */
export function RoleGate({
  roles,
  children,
  fallback = null,
}: {
  roles: Role[]
  children: ReactNode
  fallback?: ReactNode
}) {
  const profile = useAuthStore((s) => s.profile)
  return hasRole(profile, ...roles) ? <>{children}</> : <>{fallback}</>
}
