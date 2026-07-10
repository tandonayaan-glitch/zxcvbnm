import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Field, Input, Textarea } from '@/components/ui/primitives'
import type { Club } from '@/types'
import type { ClubInput } from '@/services/clubs.service'

export function ClubFormModal({
  club,
  onClose,
  onSave,
}: {
  club: Club | null
  onClose: () => void
  onSave: (input: ClubInput, id?: string) => void | Promise<void>
}) {
  const [name, setName] = useState(club?.name ?? '')
  const [shortName, setShortName] = useState(club?.shortName ?? '')
  const [logoURL, setLogoURL] = useState(club?.logoURL ?? '')
  const [homeVenue, setHomeVenue] = useState(club?.homeVenue ?? '')
  const [description, setDescription] = useState(club?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) return setError('Club name is required.')
    setSaving(true)
    setError(null)
    const input: ClubInput = {
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      logoURL: logoURL.trim() || null,
      homeVenue: homeVenue.trim() || undefined,
      description: description.trim() || undefined,
    }
    try {
      await onSave(input, club?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={club ? 'Edit club' : 'New club'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {club ? 'Save changes' : 'Create club'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Short name">
          <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
        </Field>
        <Field label="Home venue">
          <Input value={homeVenue} onChange={(e) => setHomeVenue(e.target.value)} />
        </Field>
        <Field label="Logo URL">
          <Input value={logoURL ?? ''} onChange={(e) => setLogoURL(e.target.value)} placeholder="https://…" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about the club…"
          />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
