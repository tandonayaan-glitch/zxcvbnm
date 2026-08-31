import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input, PageLoader } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/authStore'
import { masterAdminStatus, authErrorMessage } from '@/services/auth.service'
import { MASTER_ADMIN_USERNAME } from '@/lib/constants'

/** First-time bootstrap of the MASTER administrator. Only available while no
 *  master admin exists, and only for the reserved master username. */
export function SetupPage() {
  const navigate = useNavigate()
  const signup = useAuthStore((s) => s.signup)

  const [phase, setPhase] = useState<'checking' | 'ready' | 'unreachable'>(
    'checking',
  )
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const check = useCallback(() => {
    setPhase('checking')
    masterAdminStatus().then((status) => {
      if (status === 'exists') navigate('/login', { replace: true })
      // 'unknown' = offline / backend error — do NOT show the bootstrap form,
      // which would wrongly imply the platform has no admin.
      else setPhase(status === 'missing' ? 'ready' : 'unreachable')
    })
  }, [navigate])

  useEffect(() => {
    check()
  }, [check])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6)
      return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      const status = await masterAdminStatus()
      if (status === 'exists') {
        setError('A master admin already exists. Please sign in instead.')
        return
      }
      if (status === 'unknown') {
        setError(
          "Can't reach the server to confirm setup. Check your connection and try again.",
        )
        return
      }
      // Username is the reserved master username; role is assigned by the
      // bootstrap rule in registerUser.
      await signup({ username: MASTER_ADMIN_USERNAME, password, displayName })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err, 'setup'))
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'checking') {
    return (
      <div className="min-h-screen bg-ink-900">
        <PageLoader label="Checking setup…" />
      </div>
    )
  }

  if (phase === 'unreachable') {
    return (
      <AuthLayout
        title="Can't reach the server"
        subtitle="We couldn't check whether the platform has been set up yet. You appear to be offline or the backend is unavailable."
        footer={
          <Link to="/login" className="font-semibold text-white underline">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <WifiOff size={16} className="mt-0.5 shrink-0" />
            <span>
              This is a connection problem — it does <b>not</b> mean the platform
              has no administrator. Your existing admin account is unaffected.
            </span>
          </div>
          <Button block size="lg" onClick={check}>
            Try again
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Set up the platform"
      subtitle="Create the master administrator. The master admin controls everything — users, roles, bans and all tournaments."
      footer={
        <Link to="/login" className="font-semibold text-white underline">
          Already set up? Sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Your name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Platform Owner"
          />
        </Field>
        <Field
          label="Master username"
          hint="Reserved — this is the master administrator account."
        >
          <Input value={MASTER_ADMIN_USERNAME} readOnly disabled />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button type="submit" block size="lg" loading={loading}>
          Create master admin & continue
        </Button>
      </form>
    </AuthLayout>
  )
}
