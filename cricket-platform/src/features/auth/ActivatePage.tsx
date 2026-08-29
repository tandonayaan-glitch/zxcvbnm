import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout, homeForRole } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui/primitives'
import { SignOutButton } from '@/components/ui/SignOutButton'
import { useAuthStore } from '@/store/authStore'
import { activateAccount, authErrorMessage } from '@/services/auth.service'

/**
 * First-login activation for accounts an admin auto-created (e.g. when
 * adding a player with a linked login). The account starts as
 * `pending_registration` with a temp username/password the admin shared out
 * of band; this is where it becomes a real, self-owned account.
 */
export function ActivatePage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!profile) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const updated = await activateAccount({
        newPassword: password,
        displayName,
      })
      setProfile(updated)
      navigate(homeForRole(updated.role), { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome to CricketHub"
      subtitle="Your account was set up by an admin. Choose your own password to finish activating it."
      footer={
        <SignOutButton
          variant="link"
          label="Not you? Sign out"
          className="text-ink-200 hover:text-white"
        />
      }
    >
      <div className="mb-4 rounded-lg bg-ink-50 dark:bg-ink-800/60 px-3 py-2.5 text-sm text-ink-600 dark:text-ink-400">
        Your username is{' '}
        <span className="font-mono font-semibold text-ink-900 dark:text-ink-50">{profile.username}</span> — this
        stays the same; only your password changes here.
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Display name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button type="submit" block size="lg" loading={loading}>
          Activate account
        </Button>
      </form>
    </AuthLayout>
  )
}
