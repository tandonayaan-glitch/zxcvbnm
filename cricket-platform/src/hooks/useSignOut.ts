import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/toast'

/**
 * The single sign-out mechanism for the whole app. Every "Sign out" control —
 * the app-shell sidebar, the public header, the settings screen, the activation
 * screen — goes through this so the behaviour can't drift between them:
 *
 *  1. terminate the Firebase session (`authStore.logout()` → `signOut(auth)`),
 *  2. clear client-side auth state (the store nulls `profile` in a `finally`, so
 *     a failed network round-trip still ends the local session),
 *  3. redirect to `/login` with `replace` so Back can't return to a protected
 *     screen on stale in-memory state.
 *
 * A failure in step 1 is surfaced (toast) but never blocks steps 2–3 — a user
 * asking to leave must always end up out.
 */
export function useSignOut(redirectTo = '/login') {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await logout()
    } catch (err) {
      // logout() still clears local state in its own finally; don't strand the
      // user on a protected screen just because the server call didn't land.
      console.error('Sign out did not complete cleanly', err)
      toast.error('Signed out on this device — the server call may not have completed.')
    } finally {
      setSigningOut(false)
      navigate(redirectTo, { replace: true })
    }
  }, [signingOut, logout, navigate, toast, redirectTo])

  return { signOut, signingOut }
}
