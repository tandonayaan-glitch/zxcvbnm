import { useMemo } from 'react'
import { Flame, Handshake, Rocket, CircleDot, Zap, ShieldCheck, Gauge } from 'lucide-react'
import { Card } from '@/components/ui/primitives'
import { matchInsights, type InningsInsights } from '@/domain/insights'
import type { Delivery, Match } from '@/types'

export function MatchInsights({
  match,
  deliveries,
  name,
}: {
  match: Match
  deliveries: Delivery[]
  name: (id?: string | null) => string
}) {
  const innings = useMemo(
    () => matchInsights(match, deliveries),
    [match, deliveries],
  )

  if (innings.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-ink-900">Match insights</h3>
      </div>
      <div className="divide-y divide-ink-100">
        {innings.map((ins) => (
          <InningsRow key={ins.inningsIndex} ins={ins} name={name} />
        ))}
      </div>
    </Card>
  )
}

function InningsRow({
  ins,
  name,
}: {
  ins: InningsInsights
  name: (id?: string | null) => string
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
          {ins.battingShort}
        </span>
        <span className="text-sm font-semibold text-ink-800">
          {ins.totalRuns} runs
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          icon={<Flame size={16} />}
          tone="#ea580c"
          label="Biggest over"
          value={ins.biggestOver ? `${ins.biggestOver.runs} runs` : '—'}
          sub={
            ins.biggestOver
              ? `Ov ${ins.biggestOver.over} · ${name(ins.biggestOver.bowlerId)}`
              : undefined
          }
        />
        <Tile
          icon={<Handshake size={16} />}
          tone="#0891b2"
          label="Best partnership"
          value={ins.bestPartnership ? `${ins.bestPartnership.runs} (${ins.bestPartnership.balls})` : '—'}
          sub={
            ins.bestPartnership
              ? `${name(ins.bestPartnership.batterA)} & ${name(ins.bestPartnership.batterB)}`
              : undefined
          }
        />
        <Tile
          icon={<Zap size={16} />}
          tone="#16a34a"
          label="Boundaries"
          value={`${ins.fours}×4 · ${ins.sixes}×6`}
          sub={`${ins.boundaryPct}% of runs`}
        />
        <Tile
          icon={<CircleDot size={16} />}
          tone="#64748b"
          label="Dot balls"
          value={`${ins.dotBalls}`}
          sub={`${ins.dotPct}% of balls`}
        />
        <Tile
          icon={<Rocket size={16} />}
          tone="#7c3aed"
          label={`Powerplay (${ins.powerplayOvers} ov)`}
          value={`${ins.powerplayRuns} runs`}
        />
        {ins.bestSpell && (
          <Tile
            icon={<ShieldCheck size={16} />}
            tone="#0d9488"
            label="Best spell"
            value={`${ins.bestSpell.wickets}/${ins.bestSpell.runs}`}
            sub={`${name(ins.bestSpell.bowlerId)} · ${ins.bestSpell.overs} ov · econ ${ins.bestSpell.economy.toFixed(2)}`}
          />
        )}
        {ins.momentum && (
          <Tile
            icon={<Gauge size={16} />}
            tone="#4338ca"
            label="Momentum"
            value={`${ins.momentum.rate.toFixed(1)} rpo`}
            sub={`last ${ins.momentum.overs} ov (${ins.momentum.runs}) · overall ${ins.momentum.overallRate.toFixed(1)} rpo · ${
              ins.momentum.rate > ins.momentum.overallRate
                ? 'accelerating'
                : ins.momentum.rate < ins.momentum.overallRate
                  ? 'slowing'
                  : 'steady'
            }`}
          />
        )}
      </div>

      {ins.events.length > 0 && (
        <div className="mt-3 border-t border-ink-100 pt-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            Boundary &amp; wicket timeline
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {ins.events.map((e, i) => (
              <span
                key={i}
                title={`${e.displayOver} · ${name(e.playerId)}`}
                className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  e.kind === 'wicket'
                    ? 'bg-red-600 text-white'
                    : e.kind === 'six'
                      ? 'bg-purple-600 text-white'
                      : 'bg-pitch-600 text-white'
                }`}
              >
                {e.kind === 'wicket' ? 'W' : e.kind === 'six' ? '6' : '4'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  tone: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <span style={{ color: tone }}>{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
          {label}
        </span>
      </div>
      <div className="text-base font-bold text-ink-900">{value}</div>
      {sub && <div className="truncate text-xs text-ink-500">{sub}</div>}
    </div>
  )
}
