/* ==================================================================
 * Achievements & awards — pure derivation from a player's career stats.
 * No side effects; the UI maps `icon` to a lucide component.
 * ================================================================== */
import type { PlayerStats, Match } from '@/types'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface Achievement {
  key: string
  title: string
  description: string
  icon: string // lucide icon name
  tier: AchievementTier
  unlocked: boolean
  progress?: { current: number; target: number }
}

function economy(s: PlayerStats): number {
  return s.ballsBowled ? (s.runsConceded / s.ballsBowled) * 6 : Infinity
}
function strikeRate(s: PlayerStats): number {
  return s.ballsFaced ? (s.runs / s.ballsFaced) * 100 : 0
}
function average(s: PlayerStats): number {
  const dis = s.inningsBatted - s.notOuts
  return dis > 0 ? s.runs / dis : s.runs
}

/** Compute the full achievement set for a player from cached career stats. */
export function computeAchievements(s: PlayerStats): Achievement[] {
  const list: Achievement[] = [
    {
      key: 'debut',
      title: 'Debutant',
      description: 'Played your first match',
      icon: 'flag',
      tier: 'bronze',
      unlocked: s.matches >= 1,
    },
    {
      key: 'first-fifty',
      title: 'Half-Centurion',
      description: 'Scored your first fifty',
      icon: 'trending-up',
      tier: 'bronze',
      unlocked: s.fifties + s.hundreds >= 1,
    },
    {
      key: 'first-hundred',
      title: 'Centurion',
      description: 'Scored your first hundred',
      icon: 'award',
      tier: 'gold',
      unlocked: s.hundreds >= 1,
    },
    {
      key: 'first-wicket',
      title: 'Wicket Taker',
      description: 'Took your first wicket',
      icon: 'target',
      tier: 'bronze',
      unlocked: s.wickets >= 1,
    },
    {
      key: 'five-for',
      title: 'Five-Wicket Haul',
      description: 'Took 5 wickets in an innings',
      icon: 'zap',
      tier: 'gold',
      unlocked: s.fiveWktHauls >= 1,
    },
    {
      key: 'six-machine',
      title: 'Six Machine',
      description: 'Hit 10 career sixes',
      icon: 'flame',
      tier: 'silver',
      unlocked: s.sixes >= 10,
      progress: { current: Math.min(s.sixes, 10), target: 10 },
    },
    {
      key: 'boundary-master',
      title: 'Boundary Master',
      description: 'Hit 25 career fours',
      icon: 'square',
      tier: 'silver',
      unlocked: s.fours >= 25,
      progress: { current: Math.min(s.fours, 25), target: 25 },
    },
    {
      key: 'safe-hands',
      title: 'Safe Hands',
      description: 'Held 5 career catches',
      icon: 'hand',
      tier: 'silver',
      unlocked: s.catches >= 5,
      progress: { current: Math.min(s.catches, 5), target: 5 },
    },
    {
      key: 'economy-king',
      title: 'Economy King',
      description: 'Career economy under 5 (min 30 balls)',
      icon: 'gauge',
      tier: 'gold',
      unlocked: s.ballsBowled >= 30 && economy(s) < 5,
    },
    {
      key: 'strike-force',
      title: 'Strike Force',
      description: 'Career strike rate 130+ (min 30 balls)',
      icon: 'rocket',
      tier: 'gold',
      unlocked: s.ballsFaced >= 30 && strikeRate(s) >= 130,
    },
    {
      key: 'mr-consistent',
      title: 'Mr Consistent',
      description: 'Batting average 30+ (min 5 innings)',
      icon: 'bar-chart-3',
      tier: 'gold',
      unlocked: s.inningsBatted >= 5 && average(s) >= 30,
    },
    {
      key: 'veteran',
      title: 'Veteran',
      description: 'Played 25 matches',
      icon: 'shield',
      tier: 'silver',
      unlocked: s.matches >= 25,
      progress: { current: Math.min(s.matches, 25), target: 25 },
    },
    {
      key: 'ironman',
      title: 'Ironman',
      description: 'Played 100 matches',
      icon: 'medal',
      tier: 'platinum',
      unlocked: s.matches >= 100,
      progress: { current: Math.min(s.matches, 100), target: 100 },
    },
    {
      key: '1000-runs',
      title: 'Millennium Club',
      description: 'Scored 1,000 career runs',
      icon: 'trophy',
      tier: 'platinum',
      unlocked: s.runs >= 1000,
      progress: { current: Math.min(s.runs, 1000), target: 1000 },
    },
    {
      key: '100-wickets',
      title: 'Century of Wickets',
      description: 'Took 100 career wickets',
      icon: 'crosshair',
      tier: 'platinum',
      unlocked: s.wickets >= 100,
      progress: { current: Math.min(s.wickets, 100), target: 100 },
    },
  ]
  return list
}

export function unlockedCount(a: Achievement[]): number {
  return a.filter((x) => x.unlocked).length
}

export interface PlayerAwards {
  playerOfTheMatch: number
}

/** Count awards derived from completed matches (Player of the Match). */
export function computeAwards(playerId: string, matches: Match[]): PlayerAwards {
  let potm = 0
  for (const m of matches) {
    if (m.status === 'completed' && m.playerOfTheMatchId === playerId) potm += 1
  }
  return { playerOfTheMatch: potm }
}

export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#b45309',
  silver: '#64748b',
  gold: '#ca8a04',
  platinum: '#0891b2',
}
