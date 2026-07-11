import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import {
  ballsToOvers,
  strikeRate,
  economy,
  formatRate,
} from '@/lib/format'
import { runRate } from '@/lib/format'
import type { BatterCard, Delivery, InningsState, Match, Player } from '@/types'

function dismissalLine(
  card: BatterCard,
  name: (id?: string | null) => string,
): string {
  if (!card.out) return card.balls > 0 || card.runs > 0 ? 'not out' : 'did not bat'
  const bowler = name(card.bowlerId)
  const fielder = name(card.fielderId)
  switch (card.dismissalType) {
    case 'bowled':
      return `b ${bowler}`
    case 'lbw':
      return `lbw b ${bowler}`
    case 'caught':
      return card.fielderId ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`
    case 'stumped':
      return `st ${fielder} b ${bowler}`
    case 'run_out':
      return card.fielderId ? `run out (${fielder})` : 'run out'
    case 'hit_wicket':
      return `hit wkt b ${bowler}`
    case 'retired_out':
      return 'retired out'
    case 'retired_hurt':
      return 'retired hurt'
    default:
      return 'out'
  }
}

export function ScorecardView({
  match,
  players,
  deliveries = [],
}: {
  match: Match
  players: Player[]
  deliveries?: Delivery[]
}) {
  const cfg = match.scorecardConfig
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  )
  const name = (id?: string | null) =>
    (id && playerById.get(id)?.displayName) || '—'

  const [tab, setTab] = useState('0')
  if (match.innings.length === 0) {
    return (
      <Card className="p-6 text-center text-ink-500 dark:text-ink-400">
        Scoring hasn't started yet.
      </Card>
    )
  }

  const tabs = match.innings.map((inn, i) => ({
    key: String(i),
    label:
      (inn.battingTeamId === match.teamA.id
        ? match.teamA.shortName
        : match.teamB.shortName) + ` innings`,
  }))
  const idx = Math.min(Number(tab), match.innings.length - 1)
  const inn = match.innings[idx]

  return (
    <div className="space-y-4">
      {cfg.showResultBanner && match.result && (
        <Card className="bg-pitch-600 p-4 text-center text-white">
          <div className="text-lg font-bold">{match.result.summary}</div>
        </Card>
      )}

      {match.innings.length > 1 && (
        <Tabs tabs={tabs} active={String(idx)} onChange={setTab} />
      )}

      <InningsCard
        match={match}
        inn={inn}
        name={name}
        dismissal={(c) => dismissalLine(c, name)}
      />

      {cfg.showBallByBall && deliveries.length > 0 && (
        <OverByOver
          deliveries={deliveries.filter((d) => d.inningsIndex === idx)}
          name={name}
          ballsPerOver={match.ballsPerOver}
        />
      )}
    </div>
  )
}

function InningsCard({
  match,
  inn,
  name,
  dismissal,
}: {
  match: Match
  inn: InningsState
  name: (id?: string | null) => string
  dismissal: (c: BatterCard) => string
}) {
  const cfg = match.scorecardConfig
  const batters = inn.battingCard.filter(
    (b) => b.balls > 0 || b.runs > 0 || b.out,
  )
  const yetToBat = squadNotBatted(match, inn)
  const crr = runRate(inn.totalRuns, inn.legalBalls, match.ballsPerOver)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 px-4 py-3">
        <div className="font-semibold text-ink-900 dark:text-ink-50">
          {inn.battingTeamId === match.teamA.id
            ? match.teamA.name
            : match.teamB.name}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-ink-900 dark:text-ink-50">
            {inn.totalRuns}/{inn.wickets}
          </div>
          <div className="text-xs text-ink-500 dark:text-ink-400">
            {ballsToOvers(inn.legalBalls, match.ballsPerOver)} ov
            {cfg.showRunRate && ` · RR ${formatRate(crr)}`}
          </div>
        </div>
      </div>

      {cfg.showBatting && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
              <th className="px-4 py-2 font-semibold">Batter</th>
              <th className="px-2 py-2 text-right font-semibold">R</th>
              <th className="px-2 py-2 text-right font-semibold">B</th>
              <th className="px-2 py-2 text-right font-semibold">4s</th>
              <th className="px-2 py-2 text-right font-semibold">6s</th>
              <th className="px-4 py-2 text-right font-semibold">SR</th>
            </tr>
          </thead>
          <tbody>
            {batters.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-center text-ink-400 dark:text-ink-500">
                  No batting yet
                </td>
              </tr>
            )}
            {batters.map((b) => (
              <tr key={b.playerId} className="border-b border-ink-50 dark:border-ink-800">
                <td className="px-4 py-2">
                  <div className="font-medium text-ink-900 dark:text-ink-50">
                    {name(b.playerId)}
                    {!b.out && (b.balls > 0 || b.runs > 0) && (
                      <span className="text-pitch-600"> *</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-400 dark:text-ink-500">{dismissal(b)}</div>
                </td>
                <td className="px-2 py-2 text-right font-semibold text-ink-900 dark:text-ink-50">
                  {b.runs}
                </td>
                <td className="px-2 py-2 text-right text-ink-600 dark:text-ink-400">{b.balls}</td>
                <td className="px-2 py-2 text-right text-ink-600 dark:text-ink-400">{b.fours}</td>
                <td className="px-2 py-2 text-right text-ink-600 dark:text-ink-400">{b.sixes}</td>
                <td className="px-4 py-2 text-right text-ink-600 dark:text-ink-400">
                  {strikeRate(b.runs, b.balls)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {cfg.showExtras && (
        <div className="flex items-center justify-between border-t border-ink-100 dark:border-ink-800 px-4 py-2 text-sm">
          <span className="text-ink-500 dark:text-ink-400">Extras</span>
          <span className="text-ink-700 dark:text-ink-300">
            {inn.extras.total} (b {inn.extras.byes}, lb {inn.extras.legByes}, w{' '}
            {inn.extras.wides}, nb {inn.extras.noBalls})
          </span>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 px-4 py-2.5 text-sm font-bold text-ink-900 dark:text-ink-50">
        <span>Total</span>
        <span>
          {inn.totalRuns}/{inn.wickets} ({ballsToOvers(inn.legalBalls, match.ballsPerOver)} ov)
        </span>
      </div>

      {yetToBat.length > 0 && (
        <div className="border-t border-ink-100 dark:border-ink-800 px-4 py-2 text-xs text-ink-500 dark:text-ink-400">
          <span className="font-semibold">Yet to bat: </span>
          {yetToBat.map(name).join(', ')}
        </div>
      )}

      {cfg.showBowling && (
        <table className="w-full border-t border-ink-100 dark:border-ink-800 text-sm">
          <thead>
            <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
              <th className="px-4 py-2 font-semibold">Bowler</th>
              <th className="px-2 py-2 text-right font-semibold">O</th>
              <th className="px-2 py-2 text-right font-semibold">M</th>
              <th className="px-2 py-2 text-right font-semibold">R</th>
              <th className="px-2 py-2 text-right font-semibold">W</th>
              <th className="px-4 py-2 text-right font-semibold">Econ</th>
            </tr>
          </thead>
          <tbody>
            {inn.bowlingCard
              .filter((b) => b.legalBalls > 0 || b.wides > 0 || b.noBalls > 0)
              .map((b) => (
                <tr key={b.playerId} className="border-b border-ink-50 dark:border-ink-800">
                  <td className="px-4 py-2 font-medium text-ink-900 dark:text-ink-50">
                    {name(b.playerId)}
                  </td>
                  <td className="px-2 py-2 text-right text-ink-600 dark:text-ink-400">
                    {ballsToOvers(b.legalBalls, match.ballsPerOver)}
                  </td>
                  <td className="px-2 py-2 text-right text-ink-600 dark:text-ink-400">{b.maidens}</td>
                  <td className="px-2 py-2 text-right text-ink-600 dark:text-ink-400">
                    {b.runsConceded}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-ink-900 dark:text-ink-50">
                    {b.wickets}
                  </td>
                  <td className="px-4 py-2 text-right text-ink-600 dark:text-ink-400">
                    {economy(b.runsConceded, b.legalBalls, match.ballsPerOver)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {cfg.showFallOfWickets && inn.fallOfWickets.length > 0 && (
        <div className="border-t border-ink-100 dark:border-ink-800 px-4 py-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Fall of wickets
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-ink-600 dark:text-ink-400">
            {inn.fallOfWickets.map((f) => (
              <span key={f.wicketNumber}>
                <b className="text-ink-800 dark:text-ink-200">
                  {f.score}-{f.wicketNumber}
                </b>{' '}
                ({name(f.batterOutId)}, {f.displayOver})
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function squadNotBatted(match: Match, inn: InningsState): string[] {
  const squad =
    inn.battingTeamId === match.teamA.id ? match.squadA : match.squadB
  const batted = new Set(
    inn.battingCard
      .filter((b) => b.balls > 0 || b.runs > 0 || b.out)
      .map((b) => b.playerId),
  )
  const atCrease = new Set(
    [inn.strikerId, inn.nonStrikerId].filter(Boolean) as string[],
  )
  return squad.filter((id) => !batted.has(id) && !atCrease.has(id))
}

function OverByOver({
  deliveries,
  name,
  ballsPerOver,
}: {
  deliveries: Delivery[]
  name: (id?: string | null) => string
  ballsPerOver: number
}) {
  // group by over
  const overs = new Map<number, Delivery[]>()
  for (const d of deliveries) {
    const arr = overs.get(d.overNumber) ?? []
    arr.push(d)
    overs.set(d.overNumber, arr)
  }
  const ordered = [...overs.entries()].sort((a, b) => b[0] - a[0])

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 px-4 py-3 font-semibold text-ink-900 dark:text-ink-50">
        Ball-by-ball commentary
      </div>
      <div className="max-h-[28rem] divide-y divide-ink-50 overflow-y-auto">
        {ordered.map(([over, balls]) => {
          const runs = balls.reduce((s, d) => s + d.totalRuns, 0)
          return (
            <div key={over} className="px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-500 dark:text-ink-400">
                <span>Over {over + 1}</span>
                <span>{runs} runs</span>
              </div>
              <div className="space-y-1.5">
                {[...balls].reverse().map((d) => (
                  <div key={d.id} className="flex gap-2 text-sm">
                    <span className="w-10 shrink-0 font-mono text-ink-400 dark:text-ink-500">
                      {d.overNumber}.{d.ballInOver}
                    </span>
                    <span className="text-ink-700 dark:text-ink-300">
                      {commentaryLine(d, name, ballsPerOver)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {ordered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ink-400 dark:text-ink-500">
            No deliveries yet.
          </p>
        )}
      </div>
    </Card>
  )
}

function commentaryLine(
  d: Delivery,
  name: (id?: string | null) => string,
  _ballsPerOver: number,
): string {
  const bowler = name(d.bowlerId)
  const striker = name(d.strikerId)
  let outcome = ''
  if (d.wicket && d.wicket.type !== 'retired_hurt') outcome = 'OUT!'
  else if (d.extraType === 'wide') outcome = `wide${d.extraRuns - 1 ? ` +${d.extraRuns - 1}` : ''}`
  else if (d.extraType === 'no_ball') outcome = `no ball${d.runsOffBat ? ` +${d.runsOffBat}` : ''}`
  else if (d.extraType === 'bye') outcome = `${d.totalRuns} bye${d.totalRuns === 1 ? '' : 's'}`
  else if (d.extraType === 'leg_bye') outcome = `${d.totalRuns} leg bye${d.totalRuns === 1 ? '' : 's'}`
  else if (d.runsOffBat === 0) outcome = 'no run'
  else if (d.runsOffBat === 4) outcome = 'FOUR'
  else if (d.runsOffBat === 6) outcome = 'SIX'
  else outcome = `${d.runsOffBat} run${d.runsOffBat === 1 ? '' : 's'}`
  return `${bowler} to ${striker}, ${outcome}`
}
