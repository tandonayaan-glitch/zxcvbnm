import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trophy, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoader,
} from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { usePaginated } from '@/hooks/usePaginated'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/toast'
import {
  listTournaments,
  createTournament,
  updateTournament,
  deleteTournament,
  type TournamentInput,
} from '@/services/tournaments.service'
import { listTeams } from '@/services/teams.service'
import { listClubs } from '@/services/clubs.service'
import { listSeasons } from '@/services/seasons.service'
import { formatDate } from '@/lib/format'
import { useAuthStore, ownerScope } from '@/store/authStore'
import { TournamentFormModal } from './TournamentFormModal'
import type { Tournament, TournamentStatus } from '@/types'

const STATUS_TONE: Record<TournamentStatus, 'green' | 'amber' | 'gray'> = {
  ongoing: 'green',
  upcoming: 'amber',
  completed: 'gray',
}

export function TournamentsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const tournaments = useAsync(listTournaments, [])
  const teams = useAsync(listTeams, [])
  const clubs = useAsync(listClubs, [])
  const seasons = useAsync(listSeasons, [])
  const [editing, setEditing] = useState<Tournament | null>(null)
  const [showForm, setShowForm] = useState(false)

  const scopedTournaments = (tournaments.data ?? []).filter(
    (t) => !scope || t.ownerId === scope,
  )
  const scopedTeams = (teams.data ?? []).filter(
    (t) => !scope || t.ownerId === scope,
  )
  const scopedClubs = (clubs.data ?? []).filter((c) => !scope || c.ownerId === scope)
  const scopedSeasons = (seasons.data ?? []).filter((s) => !scope || s.ownerId === scope)
  const clubName = (id?: string | null) => scopedClubs.find((c) => c.id === id)?.name
  const seasonName = (id?: string | null) => scopedSeasons.find((s) => s.id === id)?.name
  const { page, setPage, pageCount, pageItems, totalItems, pageSize } =
    usePaginated(scopedTournaments, 12)

  async function handleSave(input: TournamentInput, id?: string) {
    try {
      if (id) {
        const prev = editing // pre-edit snapshot for undo
        await updateTournament(id, input)
        toast.undo('Tournament updated', async () => {
          if (!prev) return
          const { id: _i, createdAt: _c, updatedAt: _u, ...prevInput } = prev
          await updateTournament(id, prevInput)
          tournaments.refetch()
          toast.info('Change reverted')
        })
      } else {
        const newId = await createTournament({ ...input, ownerId: profile?.id })
        toast.undo('Tournament created', async () => {
          await deleteTournament(newId)
          tournaments.refetch()
          toast.info('Tournament removed')
        })
      }
      setShowForm(false)
      setEditing(null)
      tournaments.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleDelete(t: Tournament) {
    if (!confirm(`Delete ${t.name}?`)) return
    await deleteTournament(t.id)
    toast.success('Tournament deleted')
    tournaments.refetch()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tournaments"
        subtitle="Run leagues and knockouts with fixtures, results and standings."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            <Plus size={16} /> New tournament
          </Button>
        }
      />

      {tournaments.loading ? (
        <PageLoader />
      ) : scopedTournaments.length === 0 ? (
        <EmptyState
          icon={<Trophy size={40} />}
          title="No tournaments yet"
          description="Create a tournament, add teams, and schedule fixtures."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus size={16} /> New tournament
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Trophy size={20} />
                  </span>
                  <div>
                    <Link
                      to={`/tournament/${t.id}`}
                      className="font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {t.name}
                    </Link>
                    <div className="text-xs capitalize text-ink-500">
                      {t.format.replace('_', ' + ')}
                      {(clubName(t.clubId) || seasonName(t.seasonId)) &&
                        ` · ${[clubName(t.clubId), seasonName(t.seasonId)].filter(Boolean).join(' / ')}`}
                    </div>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-ink-600">
                <div>
                  <div className="text-xs text-ink-400">Teams</div>
                  {t.teamIds?.length ?? 0}
                </div>
                <div>
                  <div className="text-xs text-ink-400">Overs</div>
                  {t.oversPerInnings}
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-ink-400">Dates</div>
                  {formatDate(t.startDate)} – {formatDate(t.endDate)}
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-1 border-t border-ink-100 pt-2">
                <Link
                  to={`/tournament/${t.id}`}
                  className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Manage
                </Link>
                <button
                  onClick={() => {
                    setEditing(t)
                    setShowForm(true)
                  }}
                  aria-label={`Edit ${t.name}`}
                  title="Edit"
                  className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  aria-label={`Delete ${t.name}`}
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

      {scopedTournaments.length > 0 && (
        <Card className="mt-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            totalItems={totalItems}
            pageSize={pageSize}
            onChange={setPage}
          />
        </Card>
      )}

      {showForm && (
        <TournamentFormModal
          tournament={editing}
          teams={scopedTeams}
          clubs={scopedClubs}
          seasons={scopedSeasons}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
