import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Avatar, Button, Field, Input, Select } from '@/components/ui/primitives'
import type { Club, Player, Team } from '@/types'
import type { TeamInput } from '@/services/teams.service'

export function TeamFormModal({
  team,
  players,
  clubs,
  onClose,
  onSave,
}: {
  team: Team | null
  players: Player[]
  clubs: Club[]
  onClose: () => void
  onSave: (input: TeamInput, id?: string) => void | Promise<void>
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [shortName, setShortName] = useState(team?.shortName ?? '')
  const [primaryColor, setPrimaryColor] = useState(team?.primaryColor ?? '#2563eb')
  const [secondaryColor, setSecondaryColor] = useState(
    team?.secondaryColor ?? '#1e293b',
  )
  const [homeVenue, setHomeVenue] = useState(team?.homeVenue ?? '')
  const [clubId, setClubId] = useState(team?.clubId ?? '')
  const [playerIds, setPlayerIds] = useState<string[]>(team?.playerIds ?? [])
  const [captainId, setCaptainId] = useState(team?.captainId ?? '')
  const [viceCaptainId, setViceCaptainId] = useState(team?.viceCaptainId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  const squad = players.filter((p) => playerIds.includes(p.id))

  async function submit() {
    if (!name.trim()) return setError('Team name is required.')
    if (!shortName.trim()) return setError('Short name is required.')
    setSaving(true)
    setError(null)
    const input: TeamInput = {
      name: name.trim(),
      shortName: shortName.trim().toUpperCase().slice(0, 4),
      primaryColor,
      secondaryColor,
      homeVenue: homeVenue.trim() || undefined,
      clubId: clubId || null,
      playerIds,
      captainId: captainId || null,
      viceCaptainId: viceCaptainId || null,
      logoURL: team?.logoURL ?? null,
    }
    try {
      await onSave(input, team?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={team ? 'Edit team' : 'Add team'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {team ? 'Save changes' : 'Create team'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Team name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Abbreviation" required hint="3–4 letters, e.g. MUM">
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            maxLength={4}
          />
        </Field>
        <Field label="Primary colour">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-ink-300"
            />
            <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          </div>
        </Field>
        <Field label="Secondary colour">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-ink-300"
            />
            <Input
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
            />
          </div>
        </Field>
        <Field label="Home venue (optional)">
          <Input value={homeVenue} onChange={(e) => setHomeVenue(e.target.value)} />
        </Field>
        <Field label="Club (optional)">
          <Select value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">— none —</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-ink-700">
            Squad ({playerIds.length})
          </span>
        </div>
        {players.length === 0 ? (
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500">
            No players available. Add players first.
          </p>
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
            {players.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-ink-50"
              >
                <input
                  type="checkbox"
                  checked={playerIds.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4"
                />
                <Avatar name={p.fullName} src={p.photoURL} size={26} />
                <span className="text-sm text-ink-800">{p.fullName}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {squad.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Captain">
            <Select value={captainId} onChange={(e) => setCaptainId(e.target.value)}>
              <option value="">— none —</option>
              {squad.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vice-captain">
            <Select
              value={viceCaptainId}
              onChange={(e) => setViceCaptainId(e.target.value)}
            >
              <option value="">— none —</option>
              {squad.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
