import { useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Avatar, Card, EmptyState, PageLoader } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { listPlayers } from '@/services/players.service'
import { listAllMatches } from '@/services/matches.service'
import { aggregatePlayerStats } from '@/domain/stats'
import { formatBestBowling } from '@/lib/format'
import type { Player, PlayerStats } from '@/types'

type Dir = 'high' | 'low' | 'none'
interface Row {
  label: string
  aNum: number
  aText: string
  bNum: number
  bText: string
  dir: Dir
}

function metricsFor(s: PlayerStats | undefined) {
  const runs = s?.runs ?? 0
  const inns = s?.inningsBatted ?? 0
  const notOuts = s?.notOuts ?? 0
  const dismissals = inns - notOuts
  const ballsFaced = s?.ballsFaced ?? 0
  const ballsBowled = s?.ballsBowled ?? 0
  const runsConceded = s?.runsConceded ?? 0
  return {
    matches: s?.matches ?? 0,
    runs,
    avg: dismissals > 0 ? runs / dismissals : runs,
    sr: ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0,
    hs: s?.highScore ?? 0,
    hsNotOut: s?.highScoreNotOut ?? false,
    fifties: s?.fifties ?? 0,
    hundreds: s?.hundreds ?? 0,
    fours: s?.fours ?? 0,
    sixes: s?.sixes ?? 0,
    wickets: s?.wickets ?? 0,
    bestWkts: s?.bestBowlingWkts ?? 0,
    bestRuns: s?.bestBowlingRuns ?? 0,
    econ: ballsBowled > 0 ? (runsConceded / ballsBowled) * 6 : 0,
    ballsBowled,
    catches: s?.catches ?? 0,
    runOuts: s?.runOuts ?? 0,
    stumpings: s?.stumpings ?? 0,
  }
}

function buildRows(
  a: ReturnType<typeof metricsFor>,
  b: ReturnType<typeof metricsFor>,
): { batting: Row[]; bowling: Row[]; fielding: Row[] } {
  const r = (
    label: string,
    aNum: number,
    bNum: number,
    dir: Dir,
    fmt?: (n: number) => string,
    aText?: string,
    bText?: string,
  ): Row => ({
    label,
    aNum,
    bNum,
    dir,
    aText: aText ?? (fmt ? fmt(aNum) : String(aNum)),
    bText: bText ?? (fmt ? fmt(bNum) : String(bNum)),
  })
  const f2 = (n: number) => n.toFixed(2)
  const f1 = (n: number) => n.toFixed(1)
  return {
    batting: [
      r('Matches', a.matches, b.matches, 'high'),
      r('Runs', a.runs, b.runs, 'high'),
      r('Average', a.avg, b.avg, 'high', f2),
      r('Strike rate', a.sr, b.sr, 'high', f1),
      r(
        'Highest',
        a.hs,
        b.hs,
        'high',
        undefined,
        `${a.hs}${a.hsNotOut ? '*' : ''}`,
        `${b.hs}${b.hsNotOut ? '*' : ''}`,
      ),
      r('50s', a.fifties, b.fifties, 'high'),
      r('100s', a.hundreds, b.hundreds, 'high'),
      r('Fours', a.fours, b.fours, 'high'),
      r('Sixes', a.sixes, b.sixes, 'high'),
    ],
    bowling: [
      r('Wickets', a.wickets, b.wickets, 'high'),
      r(
        'Best bowling',
        a.bestWkts,
        b.bestWkts,
        'high',
        undefined,
        formatBestBowling(a.bestWkts, a.bestRuns),
        formatBestBowling(b.bestWkts, b.bestRuns),
      ),
      // Economy: lower is better, but only meaningful once a player has bowled.
      r(
        'Economy',
        a.ballsBowled > 0 ? a.econ : Infinity,
        b.ballsBowled > 0 ? b.econ : Infinity,
        'low',
        undefined,
        a.ballsBowled > 0 ? a.econ.toFixed(2) : '—',
        b.ballsBowled > 0 ? b.econ.toFixed(2) : '—',
      ),
    ],
    fielding: [
      r('Catches', a.catches, b.catches, 'high'),
      r('Run outs', a.runOuts, b.runOuts, 'high'),
      r('Stumpings', a.stumpings, b.stumpings, 'high'),
    ],
  }
}

export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const players = useAsync(listPlayers, [])
  const matches = useAsync(listAllMatches, [])
  const stats = useMemo(
    () => aggregatePlayerStats(matches.data ?? []),
    [matches.data],
  )

  const sorted = useMemo(
    () =>
      [...(players.data ?? [])].sort((x, y) =>
        x.displayName.localeCompare(y.displayName),
      ),
    [players.data],
  )

  if (players.loading || matches.loading) return <PageLoader />
  if (sorted.length < 2)
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <PageHeader title="Compare players" />
        <EmptyState
          icon={<Users size={40} />}
          title="Not enough players to compare"
        />
      </div>
    )

  const aId = params.get('a') || sorted[0].id
  const bId = params.get('b') || sorted.find((p) => p.id !== aId)!.id
  const setSide = (side: 'a' | 'b', id: string) => {
    const next = new URLSearchParams(params)
    next.set('a', side === 'a' ? id : aId)
    next.set('b', side === 'b' ? id : bId)
    setParams(next)
  }

  const pa = sorted.find((p) => p.id === aId)
  const pb = sorted.find((p) => p.id === bId)
  const ma = metricsFor(stats.get(aId))
  const mb = metricsFor(stats.get(bId))
  const groups = buildRows(ma, mb)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Compare players"
        subtitle="Head-to-head career stats, side by side."
        actions={
          <Link
            to="/compare/teams"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Compare teams
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <PlayerPicker
          side="a"
          value={aId}
          players={sorted}
          onChange={(id) => setSide('a', id)}
          player={pa}
        />
        <PlayerPicker
          side="b"
          value={bId}
          players={sorted}
          onChange={(id) => setSide('b', id)}
          player={pb}
        />
      </div>

      <StatGroup title="Batting" rows={groups.batting} />
      <StatGroup title="Bowling" rows={groups.bowling} />
      <StatGroup title="Fielding" rows={groups.fielding} />
    </div>
  )
}

function PlayerPicker({
  side,
  value,
  players,
  onChange,
  player,
}: {
  side: 'a' | 'b'
  value: string
  players: Player[]
  onChange: (id: string) => void
  player?: Player
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={player?.fullName ?? '?'} src={player?.photoURL} size={36} />
        {player ? (
          <Link
            to={`/player/${player.id}`}
            className="truncate font-semibold text-ink-900 hover:text-brand-700"
          >
            {player.displayName}
          </Link>
        ) : (
          <span className="text-ink-500">Select a player</span>
        )}
      </div>
      <select
        aria-label={`Player ${side.toUpperCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
    </Card>
  )
}

function StatGroup({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-sm font-semibold text-ink-800">
        {title}
      </div>
      <div className="divide-y divide-ink-50">
        {rows.map((row) => {
          const aBetter =
            row.dir !== 'none' &&
            row.aNum !== row.bNum &&
            (row.dir === 'high' ? row.aNum > row.bNum : row.aNum < row.bNum)
          const bBetter =
            row.dir !== 'none' &&
            row.aNum !== row.bNum &&
            (row.dir === 'high' ? row.bNum > row.aNum : row.bNum < row.aNum)
          return (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 text-sm"
            >
              <span
                className={`text-right font-semibold ${
                  aBetter ? 'text-pitch-700' : 'text-ink-700'
                }`}
              >
                {row.aText}
              </span>
              <span className="px-2 text-center text-xs uppercase tracking-wide text-ink-400">
                {row.label}
              </span>
              <span
                className={`font-semibold ${
                  bBetter ? 'text-pitch-700' : 'text-ink-700'
                }`}
              >
                {row.bText}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
