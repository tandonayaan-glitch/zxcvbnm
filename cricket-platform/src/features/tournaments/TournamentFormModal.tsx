import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { ImageUploadField } from '@/components/ui/ImageUploadField'
import type {
  Club,
  Season,
  Sponsor,
  SponsorTier,
  Team,
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from '@/types'

const SPONSOR_TIERS: SponsorTier[] = ['title', 'gold', 'silver', 'partner']
import type { TournamentInput } from '@/services/tournaments.service'

function toDateInput(ms?: number | null): string {
  if (!ms) return ''
  return new Date(ms).toISOString().slice(0, 10)
}

export function TournamentFormModal({
  tournament,
  teams,
  clubs,
  seasons,
  onClose,
  onSave,
}: {
  tournament: Tournament | null
  teams: Team[]
  clubs: Club[]
  seasons: Season[]
  onClose: () => void
  onSave: (input: TournamentInput, id?: string, reason?: string) => void | Promise<void>
}) {
  const [name, setName] = useState(tournament?.name ?? '')
  const [shortName, setShortName] = useState(tournament?.shortName ?? '')
  const [format, setFormat] = useState<TournamentFormat>(
    tournament?.format ?? 'league',
  )
  const [status, setStatus] = useState<TournamentStatus>(
    tournament?.status ?? 'upcoming',
  )
  const [oversPerInnings, setOvers] = useState(tournament?.oversPerInnings ?? 20)
  const [venue, setVenue] = useState(tournament?.venue ?? '')
  const [startDate, setStartDate] = useState(toDateInput(tournament?.startDate))
  const [endDate, setEndDate] = useState(toDateInput(tournament?.endDate))
  const [description, setDescription] = useState(tournament?.description ?? '')
  const [bannerURL, setBannerURL] = useState(tournament?.bannerURL ?? '')
  const [teamIds, setTeamIds] = useState<string[]>(tournament?.teamIds ?? [])
  const [clubId, setClubId] = useState(tournament?.clubId ?? '')
  const [seasonId, setSeasonId] = useState(tournament?.seasonId ?? '')
  const [teamGroups, setTeamGroups] = useState<Record<string, string>>(
    tournament?.teamGroups ?? {},
  )
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(
    tournament?.qualifiersPerGroup ?? 2,
  )
  const [defaultTeamSize, setDefaultTeamSize] = useState(
    tournament?.defaultTeamSize != null ? String(tournament.defaultTeamSize) : '',
  )
  const [defaultMaxWickets, setDefaultMaxWickets] = useState(
    tournament?.defaultMaxWickets != null ? String(tournament.defaultMaxWickets) : '',
  )
  const [defaultPowerplayOvers, setDefaultPowerplayOvers] = useState(
    tournament?.defaultPowerplayOvers != null ? String(tournament.defaultPowerplayOvers) : '',
  )
  const [sponsors, setSponsors] = useState<Sponsor[]>(tournament?.sponsors ?? [])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSponsor() {
    setSponsors((prev) => [...prev, { name: '', tier: 'partner' }])
  }
  function updateSponsor(i: number, patch: Partial<Sponsor>) {
    setSponsors((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function removeSponsor(i: number) {
    setSponsors((prev) => prev.filter((_, idx) => idx !== i))
  }

  function toggle(id: string) {
    setTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function setGroup(teamId: string, group: string) {
    setTeamGroups((prev) => ({ ...prev, [teamId]: group }))
  }

  async function submit() {
    if (!name.trim()) return setError('Tournament name is required.')
    const overs = Number(oversPerInnings)
    if (!Number.isFinite(overs) || overs < 1 || overs > 120) {
      return setError('Overs per innings must be between 1 and 120.')
    }
    const qualifiers = Number(qualifiersPerGroup)
    if (format === 'group_knockout' && (!Number.isFinite(qualifiers) || qualifiers < 1)) {
      return setError('Teams advancing per group must be at least 1.')
    }
    setSaving(true)
    setError(null)
    const input: TournamentInput = {
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      format,
      status,
      oversPerInnings: overs,
      venue: venue.trim() || undefined,
      startDate: startDate ? new Date(startDate).getTime() : null,
      endDate: endDate ? new Date(endDate).getTime() : null,
      description: description.trim() || undefined,
      bannerURL: bannerURL.trim() || null,
      teamIds,
      clubId: clubId || null,
      seasonId: seasonId || null,
      teamGroups:
        format === 'group_knockout'
          ? Object.fromEntries(
              teamIds
                .map((id) => [id, (teamGroups[id] ?? '').trim().toUpperCase()])
                .filter(([, g]) => g),
            )
          : undefined,
      qualifiersPerGroup: format === 'group_knockout' ? qualifiers : undefined,
      defaultTeamSize: defaultTeamSize ? Number(defaultTeamSize) : undefined,
      defaultMaxWickets: defaultMaxWickets ? Number(defaultMaxWickets) : undefined,
      defaultPowerplayOvers: defaultPowerplayOvers ? Number(defaultPowerplayOvers) : undefined,
      sponsors: sponsors.some((s) => s.name.trim())
        ? sponsors
            .filter((s) => s.name.trim())
            .map((s) => ({
              name: s.name.trim(),
              tier: s.tier,
              url: s.url?.trim() || undefined,
              logoURL: s.logoURL || null,
            }))
        : undefined,
    }
    try {
      await onSave(input, tournament?.id, reason.trim() || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tournament ? 'Edit tournament' : 'New tournament'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {tournament ? 'Save changes' : 'Create tournament'}
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
        <Field label="Format">
          <Select
            value={format}
            onChange={(e) => setFormat(e.target.value as TournamentFormat)}
          >
            <option value="league">League (round robin)</option>
            <option value="knockout">Knockout</option>
            <option value="group_knockout">Group + Knockout</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as TournamentStatus)}
          >
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </Select>
        </Field>
        <Field label="Overs per innings">
          <Input
            type="number"
            min={1}
            max={120}
            value={oversPerInnings}
            onChange={(e) => setOvers(Number(e.target.value))}
          />
        </Field>
        <Field label="Venue">
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="End date">
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
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
        <Field label="Season (optional)">
          <Select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="">— none —</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about the tournament…"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Banner (optional)">
          <ImageUploadField
            value={bannerURL}
            onChange={setBannerURL}
            folder="tournaments"
            shape="square"
          />
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-300">
          Participating teams ({teamIds.length})
        </div>
        {teams.length === 0 ? (
          <p className="rounded-lg bg-ink-50 dark:bg-ink-800/60 px-3 py-2 text-sm text-ink-500 dark:text-ink-400">
            No teams available. Create teams first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
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
        )}
      </div>

      {format === 'group_knockout' && teamIds.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-300">
            Group assignment
          </div>
          <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">
            Give each team a group label (e.g. A, B). Teams left blank won't appear on the
            Groups tab.
          </p>
          <div className="mb-3 max-w-[220px]">
            <Field label="Teams advancing per group" hint="Used by the Qualification tab.">
              <Input
                type="number"
                min={1}
                value={qualifiersPerGroup}
                onChange={(e) => setQualifiersPerGroup(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {teamIds.map((id) => {
              const t = teams.find((x) => x.id === id)
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm text-ink-800 dark:text-ink-200">
                    {t?.name ?? id}
                  </span>
                  <Input
                    className="w-20"
                    value={teamGroups[id] ?? ''}
                    onChange={(e) => setGroup(id, e.target.value)}
                    placeholder="A"
                    maxLength={8}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-300">
          Match rule defaults (optional)
        </div>
        <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">
          Pre-fills the Match Rules step when scorers set up a match in this tournament.
          Leave blank to use the setup wizard's own defaults.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Team size">
            <Input
              type="number"
              min={2}
              value={defaultTeamSize}
              onChange={(e) => setDefaultTeamSize(e.target.value)}
              placeholder="11"
            />
          </Field>
          <Field label="Max wickets">
            <Input
              type="number"
              min={1}
              value={defaultMaxWickets}
              onChange={(e) => setDefaultMaxWickets(e.target.value)}
              placeholder="10"
            />
          </Field>
          <Field label="Powerplay overs" hint="Used for formats over 20 overs.">
            <Input
              type="number"
              min={0}
              value={defaultPowerplayOvers}
              onChange={(e) => setDefaultPowerplayOvers(e.target.value)}
              placeholder="10"
            />
          </Field>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-ink-700 dark:text-ink-300">
            Sponsors (optional)
          </span>
          <button
            type="button"
            onClick={addSponsor}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
          >
            <Plus size={13} /> Add sponsor
          </button>
        </div>
        {sponsors.length === 0 ? (
          <p className="rounded-lg bg-ink-50 dark:bg-ink-800/60 px-3 py-2 text-sm text-ink-500 dark:text-ink-400">
            No sponsors added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sponsors.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-lg border border-ink-200 dark:border-ink-800 p-3 sm:grid-cols-[1fr_auto_1fr_auto_auto]"
              >
                <Input
                  value={s.name}
                  onChange={(e) => updateSponsor(i, { name: e.target.value })}
                  placeholder="Sponsor name"
                />
                <Select
                  value={s.tier}
                  onChange={(e) => updateSponsor(i, { tier: e.target.value as SponsorTier })}
                >
                  {SPONSOR_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier[0].toUpperCase() + tier.slice(1)}
                    </option>
                  ))}
                </Select>
                <Input
                  value={s.url ?? ''}
                  onChange={(e) => updateSponsor(i, { url: e.target.value })}
                  placeholder="Website (optional)"
                />
                <ImageUploadField
                  value={s.logoURL ?? ''}
                  onChange={(url) => updateSponsor(i, { logoURL: url })}
                  folder="tournaments"
                  shape="square"
                />
                <button
                  type="button"
                  onClick={() => removeSponsor(i)}
                  aria-label="Remove sponsor"
                  className="justify-self-start rounded-md p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 sm:justify-self-center"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {tournament && (
        <div className="mt-4">
          <Field label="Reason for this change (optional)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. added a team"
            />
          </Field>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
