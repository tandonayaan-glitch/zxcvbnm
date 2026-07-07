import { useState } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Trophy,
  Search,
  LogIn,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldQuestion,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { homeForRole } from '@/features/auth/AuthLayout'
import { BackgroundControl } from '@/components/background/BackgroundControl'

export function PublicLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useAuthStore((s) => s.profile)
  const logout = useAuthStore((s) => s.logout)
  const [q, setQ] = useState('')

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pitch-500 text-white">
              <Trophy size={20} />
            </span>
            <span className="text-lg font-extrabold text-ink-900">
              CricketHub
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium text-ink-600 md:flex">
            <Link to="/" className="rounded-md px-3 py-2 hover:bg-ink-100">
              Home
            </Link>
            <Link to="/browse?tab=matches" className="rounded-md px-3 py-2 hover:bg-ink-100">
              Matches
            </Link>
            <Link to="/browse?tab=tournaments" className="rounded-md px-3 py-2 hover:bg-ink-100">
              Tournaments
            </Link>
            <Link to="/browse?tab=teams" className="rounded-md px-3 py-2 hover:bg-ink-100">
              Teams
            </Link>
            <Link to="/stats" className="rounded-md px-3 py-2 hover:bg-ink-100">
              Stats
            </Link>
          </nav>

          <form onSubmit={onSearch} className="ml-auto hidden flex-1 sm:block sm:max-w-xs">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search players, teams…"
                className="w-full rounded-lg border border-ink-300 bg-ink-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </div>
          </form>

          <BackgroundControl />

          {profile ? (
            <div className="flex items-center gap-2">
              {profile.role === 'VIEWER' && (
                <Link
                  to="/account"
                  title="Request admin access"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  <ShieldQuestion size={16} />
                  <span className="hidden sm:inline">Request admin</span>
                </Link>
              )}
              <Link
                to="/settings"
                title="Settings"
                className="inline-flex items-center rounded-lg border border-ink-300 p-2 text-ink-700 hover:bg-ink-100"
              >
                <Settings size={16} />
              </Link>
              <Link
                to={profile.role === 'VIEWER' ? '/account' : homeForRole(profile.role)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-800"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">
                  {profile.role === 'VIEWER' ? 'My account' : 'Dashboard'}
                </span>
              </Link>
              <button
                onClick={onLogout}
                title="Sign out"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <LogIn size={16} />
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main id="main" className="flex-1">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="border-t border-ink-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-ink-500 sm:flex-row">
          <p>© {new Date().getFullYear()} CricketHub — Live scoring & cricket management.</p>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-ink-800">
              Scorer login
            </Link>
            <Link to="/search" className="hover:text-ink-800">
              Search
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
