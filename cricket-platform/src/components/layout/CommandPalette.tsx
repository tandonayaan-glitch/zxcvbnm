import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  Users,
  Shield,
  Trophy,
  Swords,
  Building2,
  Trash2,
  BarChart3,
  Inbox,
  UserCog,
  Wrench,
  Users2,
  Sliders,
  Settings,
  User,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { globalSearch, type SearchResults } from '@/services/search.service'
import type { Role } from '@/types'

const OPEN_EVENT = 'crickethub:open-command-palette'

/** Any code (e.g. a header button) can trigger the palette without holding its own state. */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

interface Command {
  kind: 'command'
  key: string
  label: string
  icon: React.ReactNode
  to: string
  roles?: Role[]
}

interface EntityItem {
  kind: 'entity'
  key: string
  label: string
  sub: string
  icon: React.ReactNode
  to: string
}

type PaletteItem = Command | EntityItem

const COMMANDS: Command[] = [
  { kind: 'command', key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, to: '/dashboard' },
  { kind: 'command', key: 'matches', label: 'Matches', icon: <Swords size={16} />, to: '/matches' },
  { kind: 'command', key: 'players', label: 'Players', icon: <Users size={16} />, to: '/players' },
  { kind: 'command', key: 'teams', label: 'Teams', icon: <Shield size={16} />, to: '/teams' },
  { kind: 'command', key: 'tournaments', label: 'Tournaments', icon: <Trophy size={16} />, to: '/tournaments' },
  { kind: 'command', key: 'clubs', label: 'Clubs & Seasons', icon: <Building2 size={16} />, to: '/clubs' },
  { kind: 'command', key: 'trash', label: 'Trash', icon: <Trash2 size={16} />, to: '/admin/trash', roles: ['MASTER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'TOURNAMENT_MANAGER'] },
  { kind: 'command', key: 'stats', label: 'Stats', icon: <BarChart3 size={16} />, to: '/stats' },
  { kind: 'command', key: 'requests', label: 'Admin requests', icon: <Inbox size={16} />, to: '/requests', roles: ['MASTER_ADMIN'] },
  { kind: 'command', key: 'users', label: 'Users & Roles', icon: <UserCog size={16} />, to: '/users', roles: ['MASTER_ADMIN'] },
  { kind: 'command', key: 'tools', label: 'Platform Tools', icon: <Wrench size={16} />, to: '/admin/tools', roles: ['MASTER_ADMIN'] },
  { kind: 'command', key: 'merge', label: 'Merge Players', icon: <Users2 size={16} />, to: '/admin/merge-players', roles: ['MASTER_ADMIN'] },
  { kind: 'command', key: 'platform-settings', label: 'Platform Settings', icon: <Sliders size={16} />, to: '/admin/settings', roles: ['MASTER_ADMIN'] },
  { kind: 'command', key: 'settings', label: 'Settings', icon: <Settings size={16} />, to: '/settings' },
]

function entityItems(results: SearchResults | null): EntityItem[] {
  if (!results) return []
  return [
    ...results.players.map((p): EntityItem => ({
      kind: 'entity', key: `player-${p.id}`, label: p.fullName, sub: 'Player',
      icon: <User size={16} />, to: `/player/${p.id}`,
    })),
    ...results.teams.map((t): EntityItem => ({
      kind: 'entity', key: `team-${t.id}`, label: t.name, sub: 'Team',
      icon: <Shield size={16} />, to: `/team/${t.id}`,
    })),
    ...results.tournaments.map((t): EntityItem => ({
      kind: 'entity', key: `tournament-${t.id}`, label: t.name, sub: 'Tournament',
      icon: <Trophy size={16} />, to: `/tournament/${t.id}`,
    })),
    ...results.matches.map((m): EntityItem => ({
      kind: 'entity', key: `match-${m.id}`, label: `${m.teamA.name} vs ${m.teamB.name}`, sub: 'Match',
      icon: <Swords size={16} />, to: `/match/${m.id}`,
    })),
    ...results.clubs.map((c): EntityItem => ({
      kind: 'entity', key: `club-${c.id}`, label: c.name, sub: 'Club',
      icon: <Building2 size={16} />, to: `/club/${c.id}`,
    })),
  ]
}

export function CommandPalette() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    function onOpenEvent() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_EVENT, onOpenEvent)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults(null)
    setActiveIndex(0)
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults(null)
      return
    }
    let live = true
    const t = setTimeout(() => {
      globalSearch(query).then((r) => live && setResults(r))
    }, 150)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [query, open])

  const commands = useMemo(
    () => COMMANDS.filter((c) => !c.roles || (profile && c.roles.includes(profile.role))),
    [profile],
  )
  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  const items: PaletteItem[] = useMemo(
    () => [...filteredCommands, ...entityItems(results)],
    [filteredCommands, results],
  )

  function select(item: PaletteItem) {
    navigate(item.to)
    setOpen(false)
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[activeIndex]
      if (item) select(item)
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 dark:border-ink-800">
          <Search size={18} className="shrink-0 text-ink-400 dark:text-ink-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search players, teams, matches… or jump to a page"
            className="flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-50 dark:placeholder:text-ink-500"
          />
          <kbd className="hidden shrink-0 rounded border border-ink-200 px-1.5 py-0.5 text-xs text-ink-400 sm:block dark:border-ink-700 dark:text-ink-500">
            Esc
          </kbd>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-ink-400 dark:text-ink-500">
              No matches
            </div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.key}
                type="button"
                onClick={() => select(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  i === activeIndex
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-ink-700 dark:text-ink-300',
                )}
              >
                <span className="shrink-0 text-ink-400 dark:text-ink-500">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.kind === 'entity' && (
                  <span className="shrink-0 text-xs text-ink-400 dark:text-ink-500">{item.sub}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
