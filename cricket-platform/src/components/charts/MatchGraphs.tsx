import { useMemo } from 'react'
import { Card } from '@/components/ui/primitives'
import type { Delivery, Match } from '@/types'

interface OverPoint {
  over: number
  runs: number
  wickets: number
  cumulative: number
}

function buildOvers(deliveries: Delivery[], inningsIndex: number): OverPoint[] {
  const map = new Map<number, { runs: number; wickets: number }>()
  for (const d of deliveries) {
    if (d.inningsIndex !== inningsIndex) continue
    const cur = map.get(d.overNumber) ?? { runs: 0, wickets: 0 }
    cur.runs += d.totalRuns
    if (d.wicket && d.wicket.type !== 'retired_hurt') cur.wickets += 1
    map.set(d.overNumber, cur)
  }
  const overs = [...map.entries()].sort((a, b) => a[0] - b[0])
  let cum = 0
  return overs.map(([over, v]) => {
    cum += v.runs
    return { over: over + 1, runs: v.runs, wickets: v.wickets, cumulative: cum }
  })
}

const SERIES = [
  { stroke: '#2563eb', fill: '#3b82f6' },
  { stroke: '#dc2626', fill: '#ef4444' },
]

export function MatchGraphs({
  match,
  deliveries,
}: {
  match: Match
  deliveries: Delivery[]
}) {
  const innings = useMemo(
    () => match.innings.map((_, i) => buildOvers(deliveries, i)),
    [deliveries, match.innings],
  )

  const hasData = innings.some((o) => o.length > 0)
  if (!hasData) return null

  const teamShort = (i: number) => {
    const inn = match.innings[i]
    if (!inn) return `Inn ${i + 1}`
    return inn.battingTeamId === match.teamA.id
      ? match.teamA.shortName
      : match.teamB.shortName
  }

  const maxOver = Math.max(
    1,
    ...innings.flatMap((o) => o.map((p) => p.over)),
    match.oversPerInnings,
  )
  const maxOverRuns = Math.max(6, ...innings.flatMap((o) => o.map((p) => p.runs)))
  const maxCum = Math.max(10, ...innings.flatMap((o) => o.map((p) => p.cumulative)))

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Worm */}
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold text-ink-800">
          Worm — cumulative runs
        </h3>
        <Worm
          innings={innings}
          maxOver={maxOver}
          maxCum={maxCum}
          label={teamShort}
        />
        <Legend innings={innings} label={teamShort} />
      </Card>

      {/* Manhattan */}
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold text-ink-800">
          Manhattan — runs per over
        </h3>
        <Manhattan innings={innings} maxOver={maxOver} maxRuns={maxOverRuns} />
        <Legend innings={innings} label={teamShort} />
      </Card>
    </div>
  )
}

function Legend({
  innings,
  label,
}: {
  innings: OverPoint[][]
  label: (i: number) => string
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500">
      {innings.map((o, i) =>
        o.length ? (
          <span key={i} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SERIES[i % 2].stroke }}
            />
            {label(i)}
          </span>
        ) : null,
      )}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
        wicket
      </span>
    </div>
  )
}

const W = 320
const H = 160
const PAD = 26

function Worm({
  innings,
  maxOver,
  maxCum,
  label,
}: {
  innings: OverPoint[][]
  maxOver: number
  maxCum: number
  label: (i: number) => string
}) {
  const x = (over: number) => PAD + ((W - PAD * 2) * over) / maxOver
  const y = (runs: number) => H - PAD - ((H - PAD * 2) * runs) / maxCum

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Worm graph of cumulative runs">
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e2e8f0" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#e2e8f0" />
      {innings.map((o, i) => {
        if (!o.length) return null
        const pts = [`${x(0)},${y(0)}`, ...o.map((p) => `${x(p.over)},${y(p.cumulative)}`)]
        return (
          <g key={i}>
            <polyline
              points={pts.join(' ')}
              fill="none"
              stroke={SERIES[i % 2].stroke}
              strokeWidth={2}
            />
            {o
              .filter((p) => p.wickets > 0)
              .map((p) => (
                <circle key={p.over} cx={x(p.over)} cy={y(p.cumulative)} r={3} fill="#ef4444" />
              ))}
          </g>
        )
      })}
      <text x={W - PAD} y={H - 8} textAnchor="end" fontSize={9} fill="#94a3b8">
        overs → {maxOver}
      </text>
      <text x={PAD - 4} y={PAD} textAnchor="end" fontSize={9} fill="#94a3b8">
        {maxCum}
      </text>
      {/* keep label referenced for a11y */}
      <title>{innings.map((_, i) => label(i)).join(' vs ')}</title>
    </svg>
  )
}

function Manhattan({
  innings,
  maxOver,
  maxRuns,
}: {
  innings: OverPoint[][]
  maxOver: number
  maxRuns: number
}) {
  const active = innings.filter((o) => o.length)
  const groupW = (W - PAD * 2) / maxOver
  const barW = Math.max(3, (groupW / Math.max(1, active.length)) * 0.8)
  const y = (runs: number) => H - PAD - ((H - PAD * 2) * runs) / maxRuns

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Manhattan graph of runs per over">
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e2e8f0" />
      {innings.map((o, si) => {
        if (!o.length) return null
        const seriesIndex = active.indexOf(o)
        return (
          <g key={si}>
            {o.map((p) => {
              const gx = PAD + groupW * (p.over - 1)
              const bx = gx + seriesIndex * barW + (groupW - barW * active.length) / 2
              const top = y(p.runs)
              return (
                <g key={p.over}>
                  <rect
                    x={bx}
                    y={top}
                    width={barW}
                    height={H - PAD - top}
                    fill={SERIES[si % 2].fill}
                    rx={1}
                  />
                  {p.wickets > 0 && (
                    <circle cx={bx + barW / 2} cy={top - 4} r={2.5} fill="#ef4444" />
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
      <text x={PAD - 4} y={PAD} textAnchor="end" fontSize={9} fill="#94a3b8">
        {maxRuns}
      </text>
      <text x={W - PAD} y={H - 8} textAnchor="end" fontSize={9} fill="#94a3b8">
        overs → {maxOver}
      </text>
    </svg>
  )
}
