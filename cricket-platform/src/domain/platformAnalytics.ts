import type { Club, Match, Team, UserProfile } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000

export interface DailyCount {
  date: string // YYYY-MM-DD
  count: number
}

/** Buckets timestamps into one count per calendar day for the trailing `days` window
 *  (oldest first), including days with zero activity so charts don't have gaps. */
export function bucketByDay(timestamps: number[], days: number): DailyCount[] {
  const now = Date.now()
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(new Date(now - i * DAY_MS).toISOString().slice(0, 10), 0)
  }
  for (const ts of timestamps) {
    // Legacy/foreign docs can have a missing or malformed createdAt — skip rather than crash.
    if (!Number.isFinite(ts)) continue
    const key = new Date(ts).toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }))
}

export function signupsPerDay(users: UserProfile[], days = 30): DailyCount[] {
  return bucketByDay(
    users.map((u) => u.createdAt),
    days,
  )
}

export function matchesPerDay(matches: Match[], days = 30): DailyCount[] {
  return bucketByDay(
    matches.map((m) => m.createdAt),
    days,
  )
}

/** How many of `items` were created on/after `sinceMs` — a simple growth-over-window count,
 *  reused for players/teams/tournaments/matches/users alike. */
export function createdSince<T extends { createdAt: number }>(items: T[], sinceMs: number): number {
  return items.filter((i) => i.createdAt >= sinceMs).length
}

/** Clubs with at least one team that played a match in the window — the closest honest proxy
 *  for "active club" this app's data supports (no login/session log to define "active" by). */
export function activeClubIds(
  clubs: Club[],
  teams: Team[],
  matches: Match[],
  sinceMs: number,
): Set<string> {
  const validClubIds = new Set(clubs.map((c) => c.id))
  const recentTeamIds = new Set(
    matches
      .filter((m) => (m.completedAt ?? m.createdAt) >= sinceMs)
      .flatMap((m) => [m.teamA.id, m.teamB.id]),
  )
  const active = new Set<string>()
  for (const t of teams) {
    if (t.clubId && validClubIds.has(t.clubId) && recentTeamIds.has(t.id)) {
      active.add(t.clubId)
    }
  }
  return active
}

/** Distinct scorers credited on a match in the window. */
export function activeScorerIds(matches: Match[], sinceMs: number): Set<string> {
  const ids = new Set<string>()
  for (const m of matches) {
    if ((m.completedAt ?? m.createdAt) >= sinceMs && m.scorerId) ids.add(m.scorerId)
  }
  return ids
}
