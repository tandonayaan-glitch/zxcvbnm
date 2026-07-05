import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AuthLayout, homeForRole } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/authStore'
import { authErrorMessage, adminExists } from '@/services/auth.service'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const profile = useAuthStore((s) => s.profile)

  const [username, setUsername] = useState(
    (location.state as { username?: string } | null)?.username ?? '',
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    adminExists()
      .then((exists) => setNeedsSetup(!exists))
      .catch(() => {})
  }, [])

  // Already logged in -> bounce to the right home.
  useEffect(() => {
    if (profile) {
      const dest =
        (location.state as { from?: string } | null)?.from ??
        homeForRole(profile.role)
      navigate(dest, { replace: true })
    }
  }, [profile, navigate, location.state])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const p = await login(username, password)
      navigate(homeForRole(p.role), { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to score matches and manage your cricket."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-semibold text-white underline">
            Create an account
          </Link>
          {' · '}
          <Link to="/" className="font-semibold text-white underline">
            Browse as viewer
          </Link>
        </>
      }
    >
      {needsSetup && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          No admin account exists yet.{' '}
          <Link to="/setup" className="font-semibold underline">
            Set up the first admin →
          </Link>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Username">
          <Input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourname"
            autoComplete="username"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button type="submit" block size="lg" loading={loading}>
          Sign in
        </Button>
        <div className="text-center">
          <Link
            to="/recover"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot username or password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
