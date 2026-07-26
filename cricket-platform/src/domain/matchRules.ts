/** Pure helpers for the Match Setup Wizard's "Match Rules" step. No I/O. */

export const DEFAULT_TEAM_SIZE = 11

/**
 * Auto powerplay length in overs, following common conventions:
 * 5 overs → 1, 6–10 → 2, 11–20 → 6. Beyond 20 overs there's no single
 * convention, so the tournament's configured default is used when present,
 * falling back to a 10-over ODI-style powerplay otherwise.
 */
export function computeAutoPowerplayOvers(
  totalOvers: number,
  tournamentDefault?: number,
): number {
  if (totalOvers <= 5) return Math.min(1, totalOvers)
  if (totalOvers <= 10) return Math.min(2, totalOvers)
  if (totalOvers <= 20) return Math.min(6, totalOvers)
  return Math.min(tournamentDefault ?? 10, totalOvers)
}

/** Standard all-out threshold for a given playing-XI size (one fewer than the squad). */
export function defaultMaxWickets(teamSize: number): number {
  return Math.max(1, teamSize - 1)
}
