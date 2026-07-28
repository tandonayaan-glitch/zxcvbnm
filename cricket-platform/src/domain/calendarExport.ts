/* ==================================================================
 * Calendar export — turn a match into a downloadable .ics (RFC 5545)
 * "Add to calendar" file. Pure string builder; the UI wraps the result
 * in a Blob download via lib/download.ts.
 * ================================================================== */
import type { Match, MatchFormat } from '@/types'

/** Rough total match length, used only to set a calendar event's end time. */
const FORMAT_DURATION_MINUTES: Record<MatchFormat, number> = {
  T10: 90,
  T20: 210,
  THE_HUNDRED: 150,
  ODI: 420,
  CUSTOM: 0, // computed from oversPerInnings instead, see estimatedDurationMinutes
}

/** Estimated wall-clock duration for a match, for the calendar event's end time. */
export function estimatedDurationMinutes(match: Match): number {
  const fixed = FORMAT_DURATION_MINUTES[match.format]
  if (fixed > 0) return fixed
  // ~3.5 minutes/over/innings (bowling + between-over time), two innings.
  return Math.max(60, Math.round(match.oversPerInnings * 3.5 * 2))
}

function toICSDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** Escape TEXT-value special characters per RFC 5545 §3.3.11. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * A single-event .ics file for a scheduled match. Returns `null` when the
 * match has no `scheduledAt` — there's nothing to put on a calendar yet.
 */
export function matchToICS(match: Match): string | null {
  if (!match.scheduledAt) return null
  const start = match.scheduledAt
  const end = start + estimatedDurationMinutes(match) * 60_000
  const summary = escapeText(`${match.teamA.name} vs ${match.teamB.name}`)
  const descriptionParts = [
    `${match.format} · ${match.oversPerInnings} overs`,
    match.tournamentName ?? undefined,
  ].filter(Boolean)
  const description = escapeText(descriptionParts.join(' — '))
  const location = escapeText(match.venue ?? '')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CricketHub//Match//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:match-${match.id}@crickethub`,
    `DTSTAMP:${toICSDate(Date.now())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // RFC 5545 requires CRLF line endings.
  return lines.join('\r\n')
}

/**
 * A multi-event .ics file for every scheduled match in a list (e.g. a tournament's fixtures) —
 * one VCALENDAR with one VEVENT per match, reusing the same per-event shape as `matchToICS`.
 * Matches with no `scheduledAt` are skipped (nothing to put on a calendar for them). Returns
 * `null` when none of the matches have a scheduled time.
 */
export function matchesToICS(matches: Match[], calendarName: string): string | null {
  const scheduled = matches.filter((m) => m.scheduledAt)
  if (scheduled.length === 0) return null

  const events = scheduled.flatMap((match) => {
    const start = match.scheduledAt!
    const end = start + estimatedDurationMinutes(match) * 60_000
    const summary = escapeText(`${match.teamA.name} vs ${match.teamB.name}`)
    const location = escapeText(match.venue ?? '')
    return [
      'BEGIN:VEVENT',
      `UID:match-${match.id}@crickethub`,
      `DTSTAMP:${toICSDate(Date.now())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      'END:VEVENT',
    ]
  })

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CricketHub//Tournament//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events,
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}
