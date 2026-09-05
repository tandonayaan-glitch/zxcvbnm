/* ==================================================================
 * Player Development & Training foundation — deterministic strengths/
 * weaknesses detection from real, already-computed analytics (phase
 * performance, pace/spin split, consistency, form trend), paired with
 * generic, honestly-labeled drill suggestions.
 *
 * The weakness/strength DETECTION is entirely data-driven — every entry
 * carries the real number that produced it (`evidence`). The drill
 * SUGGESTIONS are general cricket-coaching knowledge mapped to the
 * weakness *type*, not a personalized claim about this player's actual
 * training history (this platform has no training-log data at all) — the
 * UI must present them as generic suggestions for the detected weakness
 * type, never as if they were derived from the player's own data.
 * ================================================================== */
import type { BatterStyleMatchup } from './styleMatchups'
import type { ConsistencyRow } from './consistency'
import type { FormTrend, PhasePerformanceLine } from './careerIntelligence'

export type DevelopmentAreaKind = 'strength' | 'weakness'

export interface DevelopmentArea {
  key: string
  label: string
  kind: DevelopmentAreaKind
  /** The real number(s) behind this call — always shown alongside the label, never hidden. */
  evidence: string
}

const MIN_BALLS_FOR_PHASE_CALL = 15
const MIN_BALLS_FOR_STYLE_CALL = 12
const WEAK_STRIKE_RATE_GAP = 20 // vs the player's own other phases, in SR points

export function identifyDevelopmentAreas(params: {
  phaseLines?: PhasePerformanceLine[]
  paceSpin?: BatterStyleMatchup
  consistency?: ConsistencyRow | null
  formTrend?: FormTrend | null
}): DevelopmentArea[] {
  const areas: DevelopmentArea[] = []
  const { phaseLines, paceSpin, consistency, formTrend } = params

  if (phaseLines && phaseLines.length >= 2) {
    const qualified = phaseLines.filter((l) => l.balls >= MIN_BALLS_FOR_PHASE_CALL)
    if (qualified.length >= 2) {
      const sorted = [...qualified].sort((a, b) => b.strikeRate - a.strikeRate)
      const best = sorted[0]
      const worst = sorted[sorted.length - 1]
      if (best.strikeRate - worst.strikeRate >= WEAK_STRIKE_RATE_GAP) {
        areas.push({
          key: `phase_weak_${worst.phase}`,
          label: `${worst.phase} overs`,
          kind: 'weakness',
          evidence: `SR ${worst.strikeRate.toFixed(1)} in the ${worst.phase} overs vs ${best.strikeRate.toFixed(1)} in the ${best.phase} overs (${worst.balls} balls faced)`,
        })
        areas.push({
          key: `phase_strong_${best.phase}`,
          label: `${best.phase} overs`,
          kind: 'strength',
          evidence: `SR ${best.strikeRate.toFixed(1)} in the ${best.phase} overs (${best.balls} balls faced)`,
        })
      }
    }
  }

  if (paceSpin?.hasClassifiedData) {
    const { pace, spin } = paceSpin
    if (pace.balls >= MIN_BALLS_FOR_STYLE_CALL && spin.balls >= MIN_BALLS_FOR_STYLE_CALL) {
      const gap = Math.abs(pace.strikeRate - spin.strikeRate)
      if (gap >= WEAK_STRIKE_RATE_GAP) {
        const weaker = pace.strikeRate < spin.strikeRate ? 'pace' : 'spin'
        const w = weaker === 'pace' ? pace : spin
        const s = weaker === 'pace' ? spin : pace
        areas.push({
          key: `style_weak_${weaker}`,
          label: `Bowling type: ${weaker}`,
          kind: 'weakness',
          evidence: `SR ${w.strikeRate.toFixed(1)} vs ${weaker} vs ${s.strikeRate.toFixed(1)} vs ${weaker === 'pace' ? 'spin' : 'pace'} (${w.balls} balls)`,
        })
      }
    }
  }

  if (consistency && consistency.variation >= 60) {
    areas.push({
      key: 'consistency_low',
      label: 'Innings-to-innings consistency',
      kind: 'weakness',
      evidence: `${consistency.variation.toFixed(0)}% variation in runs across ${consistency.innings} innings`,
    })
  } else if (consistency && consistency.variation <= 35) {
    areas.push({
      key: 'consistency_high',
      label: 'Innings-to-innings consistency',
      kind: 'strength',
      evidence: `${consistency.variation.toFixed(0)}% variation in runs across ${consistency.innings} innings`,
    })
  }

  if (formTrend?.direction === 'regressing') {
    areas.push({
      key: 'form_regressing',
      label: 'Recent form',
      kind: 'weakness',
      evidence: `Averaging ${formTrend.recentAverage} in the last ${formTrend.recentInnings} innings, down from ${formTrend.priorAverage}`,
    })
  } else if (formTrend?.direction === 'improving') {
    areas.push({
      key: 'form_improving',
      label: 'Recent form',
      kind: 'strength',
      evidence: `Averaging ${formTrend.recentAverage} in the last ${formTrend.recentInnings} innings, up from ${formTrend.priorAverage}`,
    })
  }

  return areas
}

export interface DrillSuggestion {
  forAreaKey: string
  title: string
  description: string
}

/** General cricket-coaching suggestions, not personalized data claims — keyed by weakness type.
 *  Presented in the UI as "a general suggestion for this weakness type," never as if derived
 *  from this player's own training history (which this platform doesn't track). */
const DRILLS: Record<string, Omit<DrillSuggestion, 'forAreaKey'>> = {
  phase_weak_powerplay: {
    title: 'Powerplay strike rotation',
    description: 'Net sessions focused on finding early gaps and rotating strike against the new ball, rather than forcing boundaries.',
  },
  phase_weak_middle: {
    title: 'Middle-overs tempo building',
    description: 'Simulated middle-overs scenarios building from a defensive base to accelerating from ball 1 of a set spell.',
  },
  phase_weak_death: {
    title: 'Death-overs hitting',
    description: 'Targeted work against yorkers and slower balls, and pre-planned boundary options for the last few overs.',
  },
  style_weak_pace: {
    title: 'Pace-facing footwork',
    description: 'Short-ball and full-length pace bowling machine or throwdown sessions, focusing on back-foot and front-foot triggers.',
  },
  style_weak_spin: {
    title: 'Spin-facing footwork',
    description: 'Sessions on using the feet to get to the pitch of the ball and picking length early against spin.',
  },
  consistency_low: {
    title: 'Shot selection discipline',
    description: 'Match-simulation practice with a required minimum balls-faced target before playing a high-risk shot.',
  },
  form_regressing: {
    title: 'Video review + a return to basics',
    description: 'Review recent dismissals for a common pattern, and a session rebuilding from a simple, low-risk method.',
  },
}

export function suggestDrills(areas: DevelopmentArea[]): DrillSuggestion[] {
  return areas
    .filter((a) => a.kind === 'weakness' && DRILLS[a.key])
    .map((a) => ({ forAreaKey: a.key, ...DRILLS[a.key] }))
}
