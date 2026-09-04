/* ==================================================================
 * Cricket-aware formatting & small helpers.
 * ================================================================== */
import type {
  BowlingStyle,
  PlayerRole,
  WicketType,
  MatchFormat,
} from '@/types'

/** Convert a count of legal balls into an "overs.balls" string. */
export function ballsToOvers(balls: number, ballsPerOver = 6): string {
  const overs = Math.floor(balls / ballsPerOver)
  const rem = balls % ballsPerOver
  return `${overs}.${rem}`
}

/** Decimal overs (e.g. 4.3 overs => 4.5 decimal) for run-rate maths. */
export function ballsToDecimalOvers(balls: number, ballsPerOver = 6): number {
  return balls / ballsPerOver
}

export function runRate(runs: number, balls: number, ballsPerOver = 6): number {
  if (balls <= 0) return 0
  return (runs / balls) * ballsPerOver
}

export function requiredRate(
  runsNeeded: number,
  ballsRemaining: number,
  ballsPerOver = 6,
): number {
  if (ballsRemaining <= 0) return Infinity
  return (runsNeeded / ballsRemaining) * ballsPerOver
}

export function formatRate(rate: number): string {
  if (!isFinite(rate)) return '—'
  return rate.toFixed(2)
}

/** Batting average (runs / dismissals). */
export function battingAverage(runs: number, dismissals: number): string {
  if (dismissals <= 0) return runs > 0 ? runs.toFixed(2) : '—'
  return (runs / dismissals).toFixed(2)
}

export function strikeRate(runs: number, balls: number): string {
  if (balls <= 0) return '—'
  return ((runs / balls) * 100).toFixed(2)
}

export function bowlingAverage(runs: number, wickets: number): string {
  if (wickets <= 0) return '—'
  return (runs / wickets).toFixed(2)
}

export function economy(runs: number, balls: number, ballsPerOver = 6): string {
  if (balls <= 0) return '—'
  return ((runs / balls) * ballsPerOver).toFixed(2)
}

export function bowlingStrikeRate(balls: number, wickets: number): string {
  if (wickets <= 0) return '—'
  return (balls / wickets).toFixed(1)
}

export function formatBestBowling(wkts: number, runs: number): string {
  if (wkts <= 0) return '—'
  return `${wkts}/${runs}`
}

/* ---------------------------- Labels ---------------------------- */

export const PLAYER_ROLE_LABELS: Record<PlayerRole, string> = {
  batter: 'Batter',
  bowler: 'Bowler',
  all_rounder: 'All-rounder',
  wicket_keeper: 'Wicket-keeper',
}

export const BOWLING_STYLE_LABELS: Record<BowlingStyle, string> = {
  right_arm_fast: 'Right-arm fast',
  right_arm_medium: 'Right-arm medium',
  right_arm_offspin: 'Right-arm off-spin',
  right_arm_legspin: 'Right-arm leg-spin',
  left_arm_fast: 'Left-arm fast',
  left_arm_medium: 'Left-arm medium',
  left_arm_orthodox: 'Left-arm orthodox',
  left_arm_chinaman: 'Left-arm chinaman',
  none: "Doesn't bowl",
}

export const WICKET_TYPE_LABELS: Record<WicketType, string> = {
  bowled: 'Bowled',
  caught: 'Caught',
  lbw: 'LBW',
  run_out: 'Run out',
  stumped: 'Stumped',
  hit_wicket: 'Hit wicket',
  retired_out: 'Retired out',
  retired_hurt: 'Retired hurt',
  other: 'Other',
}

export const MATCH_FORMAT_OVERS: Record<MatchFormat, number> = {
  T10: 10,
  T20: 20,
  ODI: 50,
  THE_HUNDRED: 17,
  CUSTOM: 20,
}

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  T10: 'T10',
  T20: 'T20',
  ODI: 'ODI (50 overs)',
  THE_HUNDRED: 'The Hundred',
  CUSTOM: 'Custom overs',
}

/* ---------------------------- Dates ---------------------------- */

function toMs(ms?: number | string | { seconds?: number } | null): number | null {
  if (ms == null) return null
  if (typeof ms === 'number') return ms
  if (typeof ms === 'string') {
    const n = Date.parse(ms)
    return isNaN(n) ? null : n
  }
  // Firestore Timestamp-like { seconds }
  if (typeof ms === 'object' && typeof ms.seconds === 'number')
    return ms.seconds * 1000
  return null
}

export function formatRelativeTime(ms?: number | null): string {
  const v = toMs(ms)
  if (v == null) return '—'
  const diffSec = Math.round((Date.now() - v) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(ms)
}

export function formatDate(ms?: number | null): string {
  const v = toMs(ms)
  if (v == null) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(ms?: number | null): string {
  const v = toMs(ms)
  if (v == null) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Collapse a full `navigator.userAgent` string down to "Browser on OS" for compact display —
 *  the full string is still available via a `title` tooltip wherever this is used. */
export function briefUA(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown OS'
  return `${browser} on ${os}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

/* ---------------------------- Misc ---------------------------- */

export function initials(name?: string | null): string {
  const safe = (name ?? '').trim()
  if (!safe) return '?'
  const parts = safe.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic-ish colour from a string (for avatars without a logo). */
export function colorFromString(str?: string | null): string {
  const palette = [
    '#2563eb',
    '#16a34a',
    '#db2777',
    '#ea580c',
    '#7c3aed',
    '#0891b2',
    '#ca8a04',
    '#dc2626',
  ]
  const safe = str ?? ''
  let hash = 0
  for (let i = 0; i < safe.length; i++) {
    hash = safe.charCodeAt(i) + ((hash << 5) - hash)
  }
  return palette[Math.abs(hash) % palette.length]
}
