import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { WagonWheelInput } from '@/components/scoring/WagonWheelInput'
import { PitchLengthInput } from '@/components/scoring/PitchLengthInput'
import type { BattingStyle, BowlingLength, BowlingLine, ShotZone } from '@/types'

export interface ShotDetailValue {
  zone?: ShotZone
  line?: BowlingLine
  length?: BowlingLength
  note?: string
}

/**
 * Optional, dismissible shot-detail capture shown right after a ball is scored (and reopenable
 * for any ball in the current over to correct it). The two inputs are real interactive
 * visualisations, not button grids:
 *  - `WagonWheelInput` — drag from the batter to place the shot; saves a `ShotZone`.
 *  - `PitchLengthInput` — tap/drag on a pitch to place where it landed; saves line + length.
 * Both reconstruct from `value` when reopened. Each change saves immediately (merge-write), so
 * closing or scoring the next ball never loses anything.
 */
export function ShotDetailPrompt({
  showZone,
  reviewed = false,
  value,
  battingStyle,
  editing = false,
  onPickZone,
  onPickPitch,
  onFlagReview,
  onSaveNote,
  onDismiss,
}: {
  showZone: boolean
  reviewed?: boolean
  value?: ShotDetailValue
  battingStyle?: BattingStyle
  /** True when reopened to edit an already-scored delivery (vs. right after scoring). */
  editing?: boolean
  onPickZone: (z: ShotZone) => void
  onPickPitch: (v: { line: BowlingLine; length: BowlingLength }) => void
  onFlagReview: () => void
  onSaveNote: (note: string) => void
  onDismiss: () => void
}) {
  const [note, setNote] = useState(value?.note ?? '')

  return (
    <div className="animate-fade-in mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950/30">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-brand-800 dark:text-brand-300">
          {editing ? 'Edit shot / line detail' : 'Add shot / line detail (optional)'}
        </span>
        <button
          onClick={onDismiss}
          aria-label={editing ? 'Close' : 'Dismiss shot detail prompt'}
          title={editing ? 'Close' : 'Dismiss'}
          className="rounded p-1 text-brand-600 hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-brand-900"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {showZone && (
          <div className="rounded-lg bg-white/70 p-2 dark:bg-ink-900/40">
            <div className="mb-1 text-[11px] font-medium text-brand-700 dark:text-brand-400">
              Shot placement
            </div>
            <WagonWheelInput
              value={value?.zone}
              battingStyle={battingStyle}
              onChange={onPickZone}
            />
          </div>
        )}
        <div className="rounded-lg bg-white/70 p-2 dark:bg-ink-900/40">
          <div className="mb-1 text-[11px] font-medium text-brand-700 dark:text-brand-400">
            Where it pitched
          </div>
          <PitchLengthInput
            line={value?.line}
            length={value?.length}
            battingStyle={battingStyle}
            onChange={onPickPitch}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 border-t border-brand-200 pt-2 dark:border-brand-800">
        <button
          onClick={onFlagReview}
          disabled={reviewed}
          className={
            reviewed
              ? 'flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
              : 'flex items-center gap-1 rounded-md border border-brand-300 bg-white px-2 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300 dark:hover:bg-brand-900'
          }
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
            const t = note.trim()
            if (!t) return
            onSaveNote(t)
          }}
          className="rounded-md border border-brand-300 bg-white px-2 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-ink-900 dark:text-brand-300 dark:hover:bg-brand-900"
        >
          Save
        </button>
      </div>
    </div>
  )
}
