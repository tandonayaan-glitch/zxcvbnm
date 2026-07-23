/** Curated, hand-written release notes shown in the in-app "What's new" panel — a small,
 *  readable subset of `CHANGELOG.md`, not every internal phase. Newest first; prepend a new
 *  entry here when there's something worth telling users about. */
export interface ReleaseNote {
  version: string
  date: string // "July 2026", not a precise timestamp — this is a human-readable note, not a log
  highlights: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.0',
    date: 'July 2026',
    highlights: [
      'Invite an existing user to a role with a shareable link (Admin → Invitations)',
      'Live match completions now surface centuries, half-centuries and five-wicket hauls in the activity feed',
      'Keyboard shortcuts for live scoring — press "?" on the Scoring page for the full list',
      'A Trash for soft-deleted players, teams, clubs, seasons, tournaments and matches, with restore',
      'Notification center, activity feeds, and a command palette (Ctrl/Cmd+K) for fast navigation',
      'Saved filters on Stats, club/season comparison pages, and a data integrity checker for admins',
    ],
  },
]

export const CURRENT_VERSION = RELEASE_NOTES[0]?.version ?? '0.0.0'
