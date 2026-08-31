import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Field, Input, Select } from '@/components/ui/primitives'
import { ImageUploadField } from '@/components/ui/ImageUploadField'
import { PLAYER_ROLE_LABELS, BOWLING_STYLE_LABELS } from '@/lib/format'
import type {
  BattingStyle,
  BowlingStyle,
  Player,
  PlayerRole,
  Team,
} from '@/types'
import type { PlayerInput } from '@/services/players.service'

/** Forgiving name normalisation for the duplicate check — lower-case, strip punctuation,
 *  collapse whitespace. Matches `domain/duplicateDetection.ts`'s own `norm`. */
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

export function PlayerFormModal({
  player,
  teams,
  existingPlayers = [],
  onClose,
  onSave,
}: {
  player: Player | null
  teams: Team[]
  /** Roster the new/edited player is joining, so an exact same-name active player can be
   *  flagged before a likely-accidental duplicate is created. */
  existingPlayers?: Player[]
  onClose: () => void
  onSave: (
    input: PlayerInput,
    id?: string,
    createLogin?: boolean,
    reason?: string,
  ) => void | Promise<void>
}) {
  const [fullName, setFullName] = useState(player?.fullName ?? '')
  const [displayName, setDisplayName] = useState(player?.displayName ?? '')
  const [shortName, setShortName] = useState(player?.shortName ?? '')
  const [role, setRole] = useState<PlayerRole>(player?.role ?? 'batter')
  const [battingStyle, setBattingStyle] = useState<BattingStyle>(
    player?.battingStyle ?? 'right_hand',
  )
  const [bowlingStyle, setBowlingStyle] = useState<BowlingStyle>(
    player?.bowlingStyle ?? 'none',
  )
  const [photoURL, setPhotoURL] = useState(player?.photoURL ?? '')
  const [teamIds, setTeamIds] = useState<string[]>(player?.teamIds ?? [])
  const [active, setActive] = useState(player?.active ?? true)
  const [createLogin, setCreateLogin] = useState(!player)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTeam(id: string) {
    setTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  // Non-blocking heads-up: an *active* player with the same normalised full name already
  // exists (two real people can share a name, so this informs rather than prevents).
  const dupName = (() => {
    const n = normName(fullName)
    if (!n) return null
    const hit = existingPlayers.find(
      (p) => p.id !== player?.id && p.active !== false && normName(p.fullName) === n,
    )
    return hit ? hit.fullName : null
  })()

  async function submit() {
    if (!fullName.trim()) return setError('Full name is required.')
    setSaving(true)
    setError(null)
    const input: PlayerInput = {
      fullName: fullName.trim(),
      displayName: displayName.trim() || fullName.trim(),
      shortName: shortName.trim() || undefined,
      role,
      battingStyle,
      bowlingStyle,
      photoURL: photoURL.trim() || null,
      teamIds,
      active,
    }
    try {
      await onSave(input, player?.id, createLogin, reason.trim() || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={player ? 'Edit player' : 'Add player'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {player ? 'Save changes' : 'Create player'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          {dupName && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              An active player named “{dupName}” already exists. Create anyway only if this is a
              different person.
            </p>
          )}
        </Field>
        <Field label="Display name" hint="Shown on scorecards">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="auto from full name"
          />
        </Field>
        <Field label="Short name">
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. RS"
          />
        </Field>
        <Field label="Playing role">
          <Select value={role} onChange={(e) => setRole(e.target.value as PlayerRole)}>
            {Object.entries(PLAYER_ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Batting style">
          <Select
            value={battingStyle}
            onChange={(e) => setBattingStyle(e.target.value as BattingStyle)}
          >
            <option value="right_hand">Right-hand bat</option>
            <option value="left_hand">Left-hand bat</option>
          </Select>
        </Field>
        <Field label="Bowling style">
          <Select
            value={bowlingStyle}
            onChange={(e) => setBowlingStyle(e.target.value as BowlingStyle)}
          >
            {Object.entries(BOWLING_STYLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Photo (optional)">
          <ImageUploadField value={photoURL} onChange={setPhotoURL} folder="players" />
        </Field>
        <Field label="Status">
          <Select
            value={active ? 'active' : 'archived'}
            onChange={(e) => setActive(e.target.value === 'active')}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </div>

      {!player && (
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink-800 dark:text-ink-200">
          <input
            type="checkbox"
            checked={createLogin}
            onChange={(e) => setCreateLogin(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Create a linked login account for this player
            <span className="block text-xs text-ink-500 dark:text-ink-400">
              Generates a temporary username/password you can hand to the player. They'll be
              asked to choose their own on first login.
            </span>
          </span>
        </label>
      )}

      {teams.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-300">Teams</div>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeam(t.id)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  teamIds.includes(t.id)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {player && (
        <div className="mt-4">
          <Field label="Reason for this change (optional)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. corrected spelling"
            />
          </Field>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
