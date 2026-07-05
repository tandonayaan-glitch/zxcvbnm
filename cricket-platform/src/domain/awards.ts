/* ==================================================================
 * Tournament awards — a curated "cabinet" derived from the same cached
 * player stats used elsewhere, plus Player-of-the-Match tallies read off
 * the match docs. Pure: the UI maps playerId -> name/photo.
 *
 * Distinct from the Leaders tab (raw most-runs / most-wickets lists): this
 * picks a single honouree per award, including a weighted Most Valuable
 * Player of the Tournament that blends batting, bowling, fielding and POTM.
 * ================================================================== */
import type { Match, PlayerStats } from '@/types'

export interface Award {
  key: string
  title: string
  playerId: string
  /** Headline value, e.g. "128" or "3/12". */
  value: string
  /** Secondary context line, e.g. "142 runs · 6 wkts". */
  sub: string
}

/** Weights for the composite MVP score. Deliberately simple and explainable. */
const MVP = {
  run: 1,
  wicket: 20,
  catch: 8,
  stumping: 10,
  runOut: 6,
  six: 2,
  four: 1,
  potm: 25,
} as const

/** Minimum deliveries to qualify for a rate-based award (economy / strike rate). */
const MIN_BALLS = 12

export function mvpScore(s: PlayerStats, potmAwards = 0): number {
  return (
    s.runs * MVP.run +
    s.wickets * MVP.wicket +
    s.catches * MVP.catch +
    s.stumpings * MVP.stumping +
    s.runOuts * MVP.runOut +
    s.sixes * MVP.six +
    s.fours * MVP.four +
    potmAwards * MVP.potm
  )
}

/** Count Player-of-the-Match awards per player across completed matches. */
export function potmTally(matches: Match[]): Map<string, number> {
  const tally = new Map<string, number>()
  for (const m of matches) {
    if (m.status !== 'completed' || !m.playerOfTheMatchId) continue
    tally.set(m.playerOfTheMatchId, (tally.get(m.playerOfTheMatchId) ?? 0) + 1)
  }
  return tally
}

export function computeTournamentAwards(
  stats: Map<string, PlayerStats>,
  matches: Match[],
): Award[] {
  const list = [...stats.values()]
  if (list.length === 0) return []
  const potm = potmTally(matches)
  const awards: Award[] = []

  /* Player of the Tournament — highest composite MVP score. */
  const scored = list
    .map((s) => ({ s, score: mvpScore(s, potm.get(s.playerId) ?? 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  if (scored.length > 0) {
    const { s } = scored[0]
    const potmCount = potm.get(s.playerId) ?? 0
    const bits = [`${s.runs} runs`, `${s.wickets} wkts`]
    if (potmCount > 0) bits.push(`${potmCount} POTM`)
    awards.push({
      key: 'mvp',
      title: 'Player of the Tournament',
      playerId: s.playerId,
      value: String(scored[0].score),
      sub: bits.join(' · '),
    })
  }

  /* Best Batter — most runs (tiebreak: strike rate). */
  const batters = list
    .filter((s) => s.runs > 0)
    .sort(
      (a, b) =>
        b.runs - a.runs ||
        b.runs / Math.max(1, b.ballsFaced) - a.runs / Math.max(1, a.ballsFaced),
    )
  if (batters.length > 0) {
    const s = batters[0]
    awards.push({
      key: 'batter',
      title: 'Best Batter',
      playerId: s.playerId,
      value: `${s.runs} runs`,
      sub: `HS ${s.highScore}${s.highScoreNotOut ? '*' : ''} · ${s.inningsBatted} inn`,
    })
  }

  /* Best Bowler — most wickets (tiebreak: fewer runs conceded). */
  const bowlers = list
    .filter((s) => s.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
  if (bowlers.length > 0) {
    const s = bowlers[0]
    awards.push({
      key: 'bowler',
      title: 'Best Bowler',
      playerId: s.playerId,
      value: `${s.wickets} wkts`,
      sub: `Best ${s.bestBowlingWkts}/${s.bestBowlingRuns} · ${s.runsConceded} runs`,
    })
  }

  /* Best All-Rounder — highest MVP score among genuine all-rounders. */
  const allRounders = list
    .filter((s) => s.runs >= 20 && s.wickets >= 2)
    .map((s) => ({ s, score: mvpScore(s) }))
    .sort((a, b) => b.score - a.score)
  if (allRounders.length > 0) {
    const { s } = allRounders[0]
    awards.push({
      key: 'allrounder',
      title: 'Best All-Rounder',
      playerId: s.playerId,
      value: `${s.runs} & ${s.wickets}`,
      sub: `${s.runs} runs · ${s.wickets} wkts`,
    })
  }

  /* Most Sixes. */
  const sixHitters = list
    .filter((s) => s.sixes > 0)
    .sort((a, b) => b.sixes - a.sixes)
  if (sixHitters.length > 0) {
    const s = sixHitters[0]
    awards.push({
      key: 'sixes',
      title: 'Most Sixes',
      playerId: s.playerId,
      value: String(s.sixes),
      sub: `${s.fours} fours`,
    })
  }

  /* Best Economy — lowest runs/over among bowlers with enough deliveries. */
  const economists = list
    .filter((s) => s.ballsBowled >= MIN_BALLS)
    .map((s) => ({ s, eco: (s.runsConceded / s.ballsBowled) * 6 }))
    .sort((a, b) => a.eco - b.eco)
  if (economists.length > 0) {
    const { s, eco } = economists[0]
    awards.push({
      key: 'economy',
      title: 'Best Economy',
      playerId: s.playerId,
      value: eco.toFixed(2),
      sub: `${s.wickets} wkts`,
    })
  }

  /* Most Player-of-the-Match awards (only when someone has more than one). */
  const potmLeader = [...potm.entries()].sort((a, b) => b[1] - a[1])[0]
  if (potmLeader && potmLeader[1] > 1) {
    awards.push({
      key: 'potm',
      title: 'Most POTM awards',
      playerId: potmLeader[0],
      value: String(potmLeader[1]),
      sub: 'Player of the Match',
    })
  }

  return awards
}
