import { type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
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
  const navigate = useNavigate()

  if (status === 'initializing') return <PageLoader label="Checking session…" />

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Accounts an admin auto-created (e.g. a linked player login) must finish
  // choosing their own username/password before touching anything else.
  if (profile.status === 'pending_registration' && location.pathname !== '/activate') {
    return <Navigate to="/activate" replace />
  }

  if (roles && !hasRole(profile, ...roles)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          icon={<ShieldAlert size={40} />}
          title="No access"
          description="Your account role doesn't have permission to view this page."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Go back
              </Button>
              <Link to="/dashboard">
                <Button>Go to dashboard</Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  return <>{children}</>
}
