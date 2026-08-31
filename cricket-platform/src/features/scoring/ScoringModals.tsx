import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Avatar, Button, Field, Select } from '@/components/ui/primitives'
import { WICKET_TYPE_LABELS } from '@/lib/format'
import { wicketCountsAsDismissal } from '@/domain/scoring'
import type { ExtraType, Player, WicketType } from '@/types'

/** Wicket types that are cricket-legal on a Wide (only a run-out or stumping can happen —
 *  the ball is dead for bowled/caught/lbw/hit-wicket) or a No ball (only a run-out — even
 *  stumped is disallowed, since the delivery is illegal regardless of where it's played).
 *  "Retired"/"Other" aren't about how the ball was bowled, so they stay allowed either way. */
const LEGAL_TYPES_BY_EXTRA: Partial<Record<ExtraType, WicketType[]>> = {
  wide: ['run_out', 'stumped', 'retired_out', 'retired_hurt', 'other'],
  no_ball: ['run_out', 'retired_out', 'retired_hurt', 'other'],
}

interface PlayerOption {
  id: string
  name: string
  photoURL?: string | null
  hint?: string
}

/* ----------------------- Pick a player (generic) ----------------------- */
export function PlayerPickModal({
  title,
  subtitle,
  options,
  onPick,
  onClose,
}: {
  title: string
  subtitle?: string
  options: PlayerOption[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  return (
    <Modal open onClose={onClose} title={title} size="sm">
      {subtitle && <p className="mb-3 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      <div className="space-y-1">
        {options.length === 0 && (
          <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
            No eligible players.
          </p>
        )}
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 px-3 py-2.5 text-left hover:border-brand-400 hover:bg-brand-50"
          >
            <Avatar name={o.name} src={o.photoURL} size={32} />
            <span className="flex-1 font-medium text-ink-800 dark:text-ink-200">{o.name}</span>
            {o.hint && <span className="text-xs text-ink-400 dark:text-ink-500">{o.hint}</span>}
          </button>
        ))}
      </div>
    </Modal>
  )
}

/* ----------------------------- Wicket modal ----------------------------- */
export interface WicketResult {
  type: WicketType
  outBatterId: string
  fielderId: string | null
  runs: number
}

export function WicketModal({
  strikerId,
  nonStrikerId,
  battingPlayers,
  fieldingPlayers,
  retiredHurtEnabled = true,
  activeExtra = null,
  onConfirm,
  onClose,
}: {
  strikerId: string
  nonStrikerId: string | null
  battingPlayers: Player[]
  fieldingPlayers: Player[]
  /** Whether "Retired hurt" is offered as a wicket type, per the match's rules. */
  retiredHurtEnabled?: boolean
  /** The extra currently selected on the score pad, if any — narrows which dismissal
   *  types are cricket-legal (e.g. no "bowled" on a Wide or No ball). */
  activeExtra?: ExtraType | null
  onConfirm: (r: WicketResult) => void
  onClose: () => void
}) {
  const legalTypes = activeExtra ? LEGAL_TYPES_BY_EXTRA[activeExtra] : null
  const [type, setType] = useState<WicketType>(legalTypes ? legalTypes[0] : 'bowled')
  const [outBatterId, setOutBatterId] = useState(strikerId)
  const [fielderId, setFielderId] = useState('')
  const [runs, setRuns] = useState(0)
  const wicketTypes = Object.entries(WICKET_TYPE_LABELS).filter(
    ([k]) =>
      (retiredHurtEnabled || k !== 'retired_hurt') &&
      (!legalTypes || legalTypes.includes(k as WicketType)),
  )

  const needsFielder = type === 'caught' || type === 'stumped' || type === 'run_out'
  const canChooseEnd = type === 'run_out'

  const name = (id: string) =>
    battingPlayers.find((p) => p.id === id)?.displayName ?? 'Batter'

  return (
    <Modal
      open
      onClose={onClose}
      title="Wicket!"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              onConfirm({
                type,
                outBatterId,
                fielderId: fielderId || null,
                runs,
              })
            }
          >
            Confirm wicket
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="How out?">
          <Select value={type} onChange={(e) => setType(e.target.value as WicketType)}>
            {wicketTypes.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Batter out">
          <Select
            value={outBatterId}
            onChange={(e) => setOutBatterId(e.target.value)}
            disabled={!canChooseEnd}
          >
            <option value={strikerId}>{name(strikerId)} (striker)</option>
            {nonStrikerId && (
              <option value={nonStrikerId}>
                {name(nonStrikerId)} (non-striker)
              </option>
            )}
          </Select>
        </Field>

        {needsFielder && (
          <Field label={type === 'run_out' ? 'Fielder (run out)' : 'Fielder'}>
            <Select value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
              <option value="">— select —</option>
              {fieldingPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {(type === 'run_out' || type === 'retired_hurt') && (
          <Field label="Runs completed on this ball">
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setRuns(r)}
                  className={`h-10 flex-1 rounded-lg border font-semibold ${
                    runs === r
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </Field>
        )}

        {!wicketCountsAsDismissal(type) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Retired hurt does not count as a dismissal — the batter can return.
          </p>
        )}
      </div>
    </Modal>
  )
}
