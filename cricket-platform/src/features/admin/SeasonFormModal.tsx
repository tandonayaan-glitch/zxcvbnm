import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import type { Club, Season, SeasonStatus } from '@/types'
import type { SeasonInput } from '@/services/seasons.service'

function toDateInput(ms?: number | null): string {
  if (!ms) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

export function SeasonFormModal({
  season,
  clubs,
  onClose,
  onSave,
}: {
  season: Season | null
  clubs: Club[]
  onClose: () => void
  onSave: (input: SeasonInput, id?: string) => void | Promise<void>
}) {
  const [name, setName] = useState(season?.name ?? '')
  const [clubId, setClubId] = useState(season?.clubId ?? '')
  const [status, setStatus] = useState<SeasonStatus>(season?.status ?? 'upcoming')
  const [startDate, setStartDate] = useState(toDateInput(season?.startDate))
  const [endDate, setEndDate] = useState(toDateInput(season?.endDate))
  const [description, setDescription] = useState(season?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) return setError('Season name is required.')
    setSaving(true)
    setError(null)
    const input: SeasonInput = {
      name: name.trim(),
      clubId: clubId || null,
      status,
      startDate: startDate ? new Date(startDate).getTime() : null,
      endDate: endDate ? new Date(endDate).getTime() : null,
      description: description.trim() || undefined,
    }
    try {
      await onSave(input, season?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={season ? 'Edit season' : 'New season'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {season ? 'Save changes' : 'Create season'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026" />
        </Field>
        <Field label="Club (optional)">
          <Select value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">No club — platform-wide</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as SeasonStatus)}>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </Select>
        </Field>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about the season…"
          />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
