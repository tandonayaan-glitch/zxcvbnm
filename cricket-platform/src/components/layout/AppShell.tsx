import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { listPendingRequests } from '@/services/requests.service'
import {
  LayoutDashboard,
  Users,
  Shield,
  Trophy,
  Swords,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
  UserCog,
  Inbox,
  BarChart3,
  Wrench,
  Sliders,
  Building2,
  Users2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore, isAdmin, canScore } from '@/store/authStore'
import { Avatar } from '@/components/ui/primitives'
import { BackgroundControl } from '@/components/background/BackgroundControl'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { Role } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: Role[]
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/matches', label: 'Matches', icon: <Swords size={18} /> },
  { to: '/players', label: 'Players', icon: <Users size={18} /> },
  { to: '/teams', label: 'Teams', icon: <Shield size={18} /> },
  { to: '/tournaments', label: 'Tournaments', icon: <Trophy size={18} /> },
  { to: '/clubs', label: 'Clubs & Seasons', icon: <Building2 size={18} /> },
  { to: '/stats', label: 'Stats', icon: <BarChart3 size={18} /> },
  {
    to: '/requests',
    label: 'Admin requests',
    icon: <Inbox size={18} />,
    roles: ['MASTER_ADMIN'],
  },
  {
    to: '/users',
    label: 'Users & Roles',
    icon: <UserCog size={18} />,
    roles: ['MASTER_ADMIN'],
  },
  {
    to: '/admin/tools',
    label: 'Platform Tools',
    icon: <Wrench size={18} />,
    roles: ['MASTER_ADMIN'],
  },
  {
    to: '/admin/merge-players',
    label: 'Merge Players',
    icon: <Users2 size={18} />,
    roles: ['MASTER_ADMIN'],
  },
  {
    to: '/admin/settings',
    label: 'Platform Settings',
    icon: <Sliders size={18} />,
    roles: ['MASTER_ADMIN'],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: <Settings size={18} />,
  },
]

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useAuthStore((s) => s.profile)
  const logout = useAuthStore((s) => s.logout)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Master admin: show how many admin requests are awaiting a decision.
  const isMaster = profile?.role === 'MASTER_ADMIN'
  const [pendingRequests, setPendingRequests] = useState(0)
  useEffect(() => {
    if (!isMaster) return
    let live = true
    listPendingRequests()
      .then((rs) => live && setPendingRequests(rs.length))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [isMaster, location.pathname])

  const items = NAV.filter((n) => {
    if (!n.roles) return true
    return profile && n.roles.includes(profile.role)
  })

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <Link
        to="/dashboard"
        className="flex items-center gap-2 px-5 py-5"
        onClick={() => setMobileOpen(false)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pitch-500 text-white">
          <Trophy size={20} />
        </span>
        <span className="text-lg font-extrabold text-white">CricketHub</span>
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-ink-300 hover:bg-white/5 hover:text-white',
              )
            }
          >
            {n.icon}
            <span className="flex-1">{n.label}</span>
            {n.to === '/requests' && pendingRequests > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {pendingRequests}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          to="/"
          className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-white/5 hover:text-white"
          onClick={() => setMobileOpen(false)}
        >
          <Globe size={18} />
          Public site
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-ink-900 lg:block">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-ink-900">
            {SidebarInner}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-200 bg-white/90 px-4 backdrop-blur dark:border-ink-800 dark:bg-ink-900/90">
          <button
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            className="rounded-md p-2 text-ink-600 hover:bg-ink-100 lg:hidden dark:text-ink-300 dark:hover:bg-ink-800"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <BackgroundControl />
            <ThemeToggle />
            <div className="text-right">
              <div className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                {profile?.displayName}
              </div>
              <div className="text-xs capitalize text-ink-500 dark:text-ink-400">
                {profile?.role.toLowerCase().replace('_', ' ')}
              </div>
            </div>
            <Avatar name={profile?.displayName ?? 'U'} size={36} />
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

/** Re-export role hints for nav-driven feature gating. */
export { isAdmin, canScore }
