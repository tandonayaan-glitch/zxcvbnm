import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Building2, CalendarRange, Pencil, History, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { VersionHistoryModal } from '@/components/ui/VersionHistoryModal'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import {
  listClubs,
  createClub,
  updateClub,
  type ClubInput,
} from '@/services/clubs.service'
import {
  listSeasons,
  createSeason,
  updateSeason,
  type SeasonInput,
} from '@/services/seasons.service'
import { formatDate } from '@/lib/format'
import { softDelete } from '@/services/trash.service'
import { snapshotVersion, changedKeys } from '@/services/versionHistory.service'
import { useAuthStore, ownerScope } from '@/store/authStore'
import { ClubFormModal } from './ClubFormModal'
import { SeasonFormModal } from './SeasonFormModal'
import type { Club, Season, SeasonStatus } from '@/types'

const STATUS_TONE: Record<SeasonStatus, 'green' | 'amber' | 'gray'> = {
  ongoing: 'green',
  upcoming: 'amber',
  completed: 'gray',
}

export function ClubsSeasonsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const [tab, setTab] = useState<'clubs' | 'seasons'>('clubs')

  const clubs = useAsync(listClubs, [])
  const seasons = useAsync(listSeasons, [])
  const [editingClub, setEditingClub] = useState<Club | null>(null)
  const [showClubForm, setShowClubForm] = useState(false)
  const [editingSeason, setEditingSeason] = useState<Season | null>(null)
  const [showSeasonForm, setShowSeasonForm] = useState(false)
  const [historyClubId, setHistoryClubId] = useState<string | null>(null)

  const scopedClubs = (clubs.data ?? []).filter((c) => !scope || c.ownerId === scope)
  const scopedSeasons = (seasons.data ?? []).filter((s) => !scope || s.ownerId === scope)
  const clubName = (id?: string | null) =>
    (clubs.data ?? []).find((c) => c.id === id)?.name

  async function handleSaveClub(input: ClubInput, id?: string) {
    try {
      if (id) {
        const prev = editingClub
        await updateClub(id, input)
        if (prev) await snapshotVersion('club', id, prev, changedKeys(prev, input), profile)
        toast.success('Club updated')
      } else {
        await createClub({ ...input, ownerId: profile?.id })
        toast.success('Club created')
      }
      setShowClubForm(false)
      setEditingClub(null)
      clubs.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleDeleteClub(c: Club) {
    if (!confirm(`Move ${c.name} to Trash? Teams/tournaments/seasons linked to it keep their club reference. You can restore it from Trash later.`)) return
    await softDelete('club', c.id, profile)
    toast.success('Club moved to Trash')
    clubs.refetch()
  }

  async function handleSaveSeason(input: SeasonInput, id?: string) {
    try {
      if (id) {
        await updateSeason(id, input)
        toast.success('Season updated')
      } else {
        await createSeason({ ...input, ownerId: profile?.id })
        toast.success('Season created')
      }
      setShowSeasonForm(false)
      setEditingSeason(null)
      seasons.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleDeleteSeason(s: Season) {
    if (!confirm(`Move ${s.name} to Trash? Tournaments linked to it keep their season reference. You can restore it from Trash later.`)) return
    await softDelete('season', s.id, profile)
    toast.success('Season moved to Trash')
    seasons.refetch()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Clubs & Seasons"
        subtitle="Organise teams under clubs and group tournaments into seasons."
        actions={
          tab === 'clubs' ? (
            <Button
              onClick={() => {
                setEditingClub(null)
                setShowClubForm(true)
              }}
            >
              <Plus size={16} /> Add club
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditingSeason(null)
                setShowSeasonForm(true)
              }}
            >
              <Plus size={16} /> Add season
            </Button>
          )
        }
      />

      <Tabs
        className="mb-4"
        tabs={[
          { key: 'clubs', label: `Clubs (${scopedClubs.length})` },
          { key: 'seasons', label: `Seasons (${scopedSeasons.length})` },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'clubs' | 'seasons')}
      />

      {tab === 'clubs' ? (
        clubs.loading ? (
          <PageLoader />
        ) : scopedClubs.length === 0 ? (
          <EmptyState
            icon={<Building2 size={40} />}
            title="No clubs yet"
            description="Create a club to group teams under a shared organisation."
            action={
              <Button onClick={() => setShowClubForm(true)}>
                <Plus size={16} /> Add club
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scopedClubs.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                      <Building2 size={20} />
                    </span>
                    <div>
                      <div className="font-semibold text-ink-900 dark:text-ink-50">{c.name}</div>
                      {c.shortName && (
                        <div className="text-xs text-ink-500 dark:text-ink-400">{c.shortName}</div>
                      )}
                    </div>
                  </div>
                </div>
                {c.homeVenue && (
                  <div className="mt-3 text-sm text-ink-600 dark:text-ink-400">
                    <span className="text-xs text-ink-400 dark:text-ink-500">Home venue </span>
                    {c.homeVenue}
                  </div>
                )}
                <div className="mt-3 flex justify-end gap-1 border-t border-ink-100 dark:border-ink-800 pt-2">
                  <Link
                    to={`/club/${c.id}`}
                    className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => {
                      setEditingClub(c)
                      setShowClubForm(true)
                    }}
                    aria-label={`Edit ${c.name}`}
                    title="Edit"
                    className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setHistoryClubId(c.id)}
                    aria-label={`Edit history for ${c.name}`}
                    title="Edit history"
                    className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                  >
                    <History size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteClub(c)}
                    aria-label={`Delete ${c.name}`}
                    title="Delete"
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : seasons.loading ? (
        <PageLoader />
      ) : scopedSeasons.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={40} />}
          title="No seasons yet"
          description="Create a season to group tournaments (e.g. by year) for archives and hall of fame."
          action={
            <Button onClick={() => setShowSeasonForm(true)}>
              <Plus size={16} /> Add season
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scopedSeasons.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <CalendarRange size={20} />
                  </span>
                  <div>
                    <div className="font-semibold text-ink-900 dark:text-ink-50">{s.name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">
                      {clubName(s.clubId) ?? 'Platform-wide'}
                    </div>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
              </div>
              <div className="mt-3 text-sm text-ink-600 dark:text-ink-400">
                <div className="text-xs text-ink-400 dark:text-ink-500">Dates</div>
                {formatDate(s.startDate)} – {formatDate(s.endDate)}
              </div>
              <div className="mt-3 flex justify-end gap-1 border-t border-ink-100 dark:border-ink-800 pt-2">
                <Link
                  to={`/season/${s.id}`}
                  className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  View
                </Link>
                <button
                  onClick={() => {
                    setEditingSeason(s)
                    setShowSeasonForm(true)
                  }}
                  aria-label={`Edit ${s.name}`}
                  title="Edit"
                  className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDeleteSeason(s)}
                  aria-label={`Delete ${s.name}`}
                  title="Delete"
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showClubForm && (
        <ClubFormModal
          club={editingClub}
          onClose={() => {
            setShowClubForm(false)
            setEditingClub(null)
          }}
          onSave={handleSaveClub}
        />
      )}
      {showSeasonForm && (
        <SeasonFormModal
          season={editingSeason}
          clubs={scopedClubs}
          onClose={() => {
            setShowSeasonForm(false)
            setEditingSeason(null)
          }}
          onSave={handleSaveSeason}
        />
      )}

      {historyClubId && (
        <VersionHistoryModal
          entityType="club"
          entityId={historyClubId}
          onClose={() => setHistoryClubId(null)}
          onRestored={() => clubs.refetch()}
        />
      )}
    </div>
  )
}
