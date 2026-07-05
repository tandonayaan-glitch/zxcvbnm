import type { ScorecardConfig, ScorecardSection } from '@/types'

export const DEFAULT_SECTION_ORDER: ScorecardSection[] = [
  'result',
  'summary',
  'batting',
  'extras',
  'bowling',
  'fallOfWickets',
  'partnership',
  'overSummary',
  'ballByBall',
]

export function defaultScorecardConfig(): ScorecardConfig {
  return {
    showResultBanner: true,
    showMatchSummary: true,
    showBatting: true,
    showBowling: true,
    showExtras: true,
    showFallOfWickets: true,
    showPartnership: true,
    showRunRate: true,
    showRequiredRate: true,
    showOverSummary: true,
    showBallByBall: true,
    showTeamColors: true,
    sectionOrder: DEFAULT_SECTION_ORDER,
    publicVisible: true,
  }
}
