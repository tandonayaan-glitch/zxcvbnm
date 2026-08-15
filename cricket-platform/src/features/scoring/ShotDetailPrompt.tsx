import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { BOWLING_LENGTHS, BOWLING_LINES } from '@/domain/pitchMap'
import { cn } from '@/lib/cn'
import type { BowlingLength, BowlingLine, ShotZone } from '@/types'

const ZONE_LABELS: Record<ShotZone, string> = {
  1: 'Fine leg',
  2: 'Square leg',
  3: 'Mid-wicket',
  4: 'Long-on',
  5: 'Long-off',
  6: 'Extra cover',
  7: 'Point',
  8: 'Third man',
}
const LINE_LABELS: Record<BowlingLine, string> = {
  wide_leg: 'Wide leg',
  leg: 'Leg',
  stump: 'Stumps',
  outside_off: 'Off',
  wide_off: 'Wide off',
}
const LENGTH_LABELS: Record<BowlingLength, string> = {
  full_toss: 'Full toss',
  yorker: 'Yorker',
  full: 'Full',
  good: 'Good',
  short: 'Short',
  bouncer: 'Bouncer',
}

/**
 * Fully optional, dismissible add-on shown right after a ball is scored —
 * never blocks or slows down the primary scoring flow. Each tap saves
 * immediately; "Skip" or scoring the next ball closes it with no penalty.
 */
export function ShotDetailPrompt({
  showZone,
  reviewed = false,
  onPickZone,
  onPickLine,
  onPickLength,
  onFlagReview,
  onSaveNote,
  onDismiss,
}: {
  showZone: boolean
  /** Whether this delivery is already flagged for review. */
  reviewed?: boolean
  onPickZone: (z: ShotZone) => void
  onPickLine: (l: BowlingLine) => void
  onPickLength: (l: BowlingLength) => void
  onFlagReview: () => void
  onSaveNote: (note: string) => void
  onDismiss: () => void
}) {
  const [note, setNote] = useState('')
  return (
    <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950/30">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-brand-800 dark:text-brand-300">
          Add shot/line detail (optional)
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss shot detail prompt"
          title="Dismiss"
          className="rounded p-1 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-brand-900"
        >
          <X size={14} />
        </button>
      </div>
      {showZone && (
        <div className="mb-2">
          <div className="mb-1 text-[11px] text-brand-700 dark:text-brand-400">Shot placement</div>
          <div className="grid grid-cols-4 gap-1">
            {([1, 2, 3, 4, 5, 6, 7, 8] as ShotZone[]).map((z) => (
              <button
                key={z}
                onClick={() => onPickZone(z)}
                className="rounded-md border border-brand-300 bg-white px-1.5 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300 dark:hover:bg-brand-900"
              >
                {ZONE_LABELS[z]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-2">
        <div className="mb-1 text-[11px] text-brand-700 dark:text-brand-400">Line</div>
        <div className="flex flex-wrap gap-1">
          {BOWLING_LINES.map((l) => (
            <button
              key={l}
              onClick={() => onPickLine(l)}
              className={cn(
                'rounded-md border border-brand-300 bg-white px-2 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300 dark:hover:bg-brand-900',
              )}
            >
              {LINE_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[11px] text-brand-700 dark:text-brand-400">Length</div>
        <div className="flex flex-wrap gap-1">
          {BOWLING_LENGTHS.map((l) => (
            <button
              key={l}
              onClick={() => onPickLength(l)}
              className="rounded-md border border-brand-300 bg-white px-2 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300 dark:hover:bg-brand-900"
            >
              {LENGTH_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-brand-200 pt-2 dark:border-brand-800">
        <button
          onClick={onFlagReview}
          disabled={reviewed}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium',
            reviewed
              ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
              : 'border-brand-300 bg-white text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300 dark:hover:bg-brand-900',
          )}
        >
          <Flag size={11} /> {reviewed ? 'Flagged for review' : 'Flag for review'}
        </button>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-0 flex-1 rounded-md border border-brand-300 bg-white px-2 py-1 text-[11px] text-ink-800 placeholder:text-ink-400 dark:border-brand-700 dark:bg-ink-900 dark:text-ink-200"
        />
        <button
          onClick={() => {
            if (!note.trim()) return
            onSaveNote(note.trim())
            setNote('')
          }}
          className="rounded-md border border-brand-300 bg-white px-2 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300 dark:hover:bg-brand-900"
        >
          Save
        </button>
      </div>
    </div>
  )
}
