/* ==================================================================
 * Knockout bracket — pure grouping of a tournament's matches into
 * ordered rounds. Reads only the denormalised fields on each match
 * (stage, teamA/teamB, result, status), so it needs no delivery data
 * and no live team docs.
 * ================================================================== */
import type { KnockoutStage, Match } from '@/types'

/** Display order, earliest round first → final last. */
export const STAGE_ORDER: KnockoutStage[] = [
  'group',
  'round_16',
  'quarter_final',
  'eliminator',
  'qualifier',
  'semi_final',
  'third_place',
  'final',
]

export const STAGE_LABELS: Record<KnockoutStage, string> = {
  group: 'Group stage',
  round_16: 'Round of 16',
  quarter_final: 'Quarter-finals',
  eliminator: 'Eliminator',
  qualifier: 'Qualifier',
  semi_final: 'Semi-finals',
  third_place: 'Third-place play-off',
  final: 'Final',
}

export interface BracketRound {
  stage: KnockoutStage
  label: string
  matches: Match[]
}

/**
 * Group a tournament's matches into ordered knockout rounds.
 * Only matches with a bracket stage (not null / 'group') are included.
 * Rounds with no matches are omitted; within a round, matches keep a
 * stable order (scheduled time, then creation time).
 */
export function bracketRounds(matches: Match[]): BracketRound[] {
  const byStage = new Map<KnockoutStage, Match[]>()
  for (const m of matches) {
    if (!m.stage || m.stage === 'group') continue
    const list = byStage.get(m.stage) ?? []
    list.push(m)
    byStage.set(m.stage, list)
  }

  const rounds: BracketRound[] = []
  for (const stage of STAGE_ORDER) {
    if (stage === 'group') continue
    const list = byStage.get(stage)
    if (!list || list.length === 0) continue
    list.sort(
      (a, b) =>
        (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt),
    )
    rounds.push({ stage, label: STAGE_LABELS[stage], matches: list })
  }
  return rounds
}

/** True when a tournament format has a knockout phase worth showing a bracket for. */
export function hasKnockoutPhase(format: string): boolean {
  return format === 'knockout' || format === 'group_knockout'
}
