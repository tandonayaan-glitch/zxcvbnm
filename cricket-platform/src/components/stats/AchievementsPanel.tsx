import {
  Flag,
  TrendingUp,
  Award,
  Target,
  Zap,
  Flame,
  Square,
  Hand,
  Gauge,
  Rocket,
  BarChart3,
  Shield,
  Medal,
  Trophy,
  Crosshair,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import {
  type Achievement,
  type PlayerAwards,
  TIER_COLORS,
  unlockedCount,
} from '@/domain/achievements'

const ICONS: Record<string, LucideIcon> = {
  flag: Flag,
  'trending-up': TrendingUp,
  award: Award,
  target: Target,
  zap: Zap,
  flame: Flame,
  square: Square,
  hand: Hand,
  gauge: Gauge,
  rocket: Rocket,
  'bar-chart-3': BarChart3,
  shield: Shield,
  medal: Medal,
  trophy: Trophy,
  crosshair: Crosshair,
}

export function AchievementsPanel({
  achievements,
  awards,
}: {
  achievements: Achievement[]
  awards: PlayerAwards
}) {
  const unlocked = unlockedCount(achievements)

  return (
    <div className="space-y-4">
      {/* Awards cabinet */}
      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 bg-ink-50 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-ink-900">Awards cabinet</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          <AwardStat
            icon={<Trophy size={22} />}
            value={awards.playerOfTheMatch}
            label="Player of the Match"
            tone="#ca8a04"
          />
          <AwardStat
            icon={<Medal size={22} />}
            value={unlocked}
            label="Achievements unlocked"
            tone="#0891b2"
          />
          <AwardStat
            icon={<Award size={22} />}
            value={`${unlocked}/${achievements.length}`}
            label="Completion"
            tone="#16a34a"
          />
        </div>
      </Card>

      {/* Achievements grid */}
      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 bg-ink-50 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-ink-900">
            Achievements ({unlocked}/{achievements.length})
          </h3>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {achievements.map((a) => {
            const Icon = ICONS[a.icon] ?? Award
            const color = TIER_COLORS[a.tier]
            return (
              <div
                key={a.key}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition',
                  a.unlocked
                    ? 'border-ink-200 bg-white'
                    : 'border-dashed border-ink-200 bg-ink-50/60',
                )}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: a.unlocked ? `${color}1a` : '#e2e8f0',
                    color: a.unlocked ? color : '#94a3b8',
                  }}
                >
                  {a.unlocked ? <Icon size={20} /> : <Lock size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        a.unlocked ? 'text-ink-900' : 'text-ink-500',
                      )}
                    >
                      {a.title}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      style={{ backgroundColor: `${color}1a`, color }}
                    >
                      {a.tier}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">{a.description}</p>
                  {a.progress && !a.unlocked && (
                    <div className="mt-1.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (a.progress.current / a.progress.target) * 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <div className="mt-0.5 text-[10px] text-ink-400">
                        {a.progress.current} / {a.progress.target}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function AwardStat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  tone: string
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-ink-50 p-3 text-center">
      <span style={{ color: tone }}>{icon}</span>
      <span className="mt-1 text-xl font-bold text-ink-900">{value}</span>
      <span className="text-[11px] text-ink-500">{label}</span>
    </div>
  )
}
