import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout, homeForRole } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/authStore'
import { authErrorMessage, validateUsername } from '@/services/auth.service'

/**
 * Ordinary signup. New accounts get the SCORER role by default — they can
 * create/score their own matches immediately; an admin can later promote them
 * to a manager role from User Management, or they can request Tournament
 * Manager access (which also requires a verified phone) to host tournaments.
 */
export function SignupPage() {
  const navigate = useNavigate()
  const signup = useAuthStore((s) => s.signup)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uErr = validateUsername(username)
    if (uErr) return setError(uErr)
    if (password.length < 6)
      return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      const p = await signup({
        username,
        password,
        displayName,
        role: 'SCORER',
      })
      navigate(homeForRole(p.role), { replace: true })
    } catch (err) {
      setError(authErrorMessage(err, 'signup'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Create matches, score games, and follow tournaments right away."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-white underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Display name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Rohit S"
          />
        </Field>
        <Field label="Username" hint="lowercase letters, numbers, underscore">
          <Input
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
        <p className="text-xs text-ink-500 dark:text-ink-400">
          By creating an account, you agree to the{' '}
          <Link to="/terms" className="underline hover:text-ink-700 dark:hover:text-ink-200">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline hover:text-ink-700 dark:hover:text-ink-200">
            Privacy Policy
          </Link>
          .
        </p>
        <Button type="submit" block size="lg" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
