/* ==================================================================
 * Error monitoring — pure aggregation over `clientErrors`, the collection every
 * client already writes runtime crashes to (Phase 15). No new instrumentation:
 * this is genuinely cross-user data, not a per-session view.
 * ================================================================== */
import type { ClientErrorLog } from '@/types'
import { bucketByDay, type DailyCount } from './platformAnalytics'

export interface ErrorFrequency {
  message: string
  count: number
}

export interface RouteFrequency {
  route: string
  count: number
}

export interface ErrorMonitoringSummary {
  errorsPerDay: DailyCount[]
  topMessages: ErrorFrequency[]
  topRoutes: RouteFrequency[]
  totalLast7Days: number
}

function topN<T extends string>(values: T[], n: number): { key: T; count: number }[] {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

export function summarizeErrors(errors: ClientErrorLog[], days = 14): ErrorMonitoringSummary {
  const errorsPerDay = bucketByDay(
    errors.map((e) => e.createdAt),
    days,
  )
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const totalLast7Days = errors.filter(
    (e) => Number.isFinite(e.createdAt) && e.createdAt >= sevenDaysAgo,
  ).length

  return {
    errorsPerDay,
    topMessages: topN(
      errors.map((e) => e.message),
      5,
    ).map(({ key, count }) => ({ message: key, count })),
    topRoutes: topN(
      errors.map((e) => e.route),
      5,
    ).map(({ key, count }) => ({ route: key, count })),
    totalLast7Days,
  }
}
