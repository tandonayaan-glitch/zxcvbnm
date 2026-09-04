import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Target,
  BarChart3,
  Zap,
  Gauge,
  Flame,
  Square,
  Award,
  Hand,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { Avatar } from '@/components/ui/primitives'
import type { Leaderboard } from '@/domain/stats'
import type { Player } from '@/types'

const ICONS: Record<string, LucideIcon> = {
  'trending-up': TrendingUp,
  target: Target,
  'bar-chart-3': BarChart3,
  zap: Zap,
  gauge: Gauge,
  flame: Flame,
  square: Square,
  award: Award,
  hand: Hand,
}

const TONES = [
  'bg-brand-500',
  'bg-pitch-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-red-500',
]

export function LeaderboardCard({
  board,
  players,
  limit = 5,
  tone = 0,
}: {
  board: Leaderboard
  players: Map<string, Player>
  limit?: number
  tone?: number
}) {
  const Icon = ICONS[board.icon] ?? TrendingUp
  const rows = board.rows.slice(0, limit)
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1)
  const barColor = TONES[tone % TONES.length]

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 px-4 py-2.5">
        <span className="text-ink-500 dark:text-ink-400">
          <Icon size={16} />
        </span>
        <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-200">{board.title}</h3>
      </div>
      <div className="divide-y divide-ink-100 dark:divide-ink-800">
        {rows.length === 0 && (
          <p className="px-4 py-5 text-center text-sm text-ink-400 dark:text-ink-500">
            No data yet.
          </p>
        )}
        {rows.map((r, i) => {
          const p = players.get(r.playerId)
          const pct = Math.max(8, (Math.abs(r.value) / max) * 100)
          return (
            <Link
              key={r.playerId}
              to={`/player/${r.playerId}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              <span className="w-4 text-sm font-semibold text-ink-400 dark:text-ink-500">
                {i + 1}
              </span>
              <Avatar name={p?.fullName ?? '?'} src={p?.photoURL} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">
                  {p?.displayName ?? 'Unknown'}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {r.sub && (
                  <div className="mt-1 text-xs text-ink-500 dark:text-ink-400">{r.sub}</div>
                )}
              </div>
              <span className="text-base font-bold text-ink-900 dark:text-ink-50">
                {r.display}
              </span>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
