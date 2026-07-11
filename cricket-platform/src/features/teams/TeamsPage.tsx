import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Shield, Pencil, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
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
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  type TeamInput,
} from '@/services/teams.service'
import { listPlayers } from '@/services/players.service'
import { listClubs } from '@/services/clubs.service'
import { useAuthStore, ownerScope } from '@/store/authStore'
import { TeamFormModal } from './TeamFormModal'
import type { Team } from '@/types'

export function TeamsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const teams = useAsync(listTeams, [])
  const players = useAsync(listPlayers, [])
  const clubs = useAsync(listClubs, [])
  const [editing, setEditing] = useState<Team | null>(null)
  const [showForm, setShowForm] = useState(false)

  const scopedTeams = useMemo(
    () => (teams.data ?? []).filter((t) => !scope || t.ownerId === scope),
    [teams.data, scope],
  )
  const scopedPlayers = useMemo(
    () => (players.data ?? []).filter((p) => !scope || p.ownerId === scope),
    [players.data, scope],
  )
  const playerCount = scopedPlayers.length
  const scopedClubs = useMemo(
    () => (clubs.data ?? []).filter((c) => !scope || c.ownerId === scope),
    [clubs.data, scope],
  )
  const clubName = (id?: string | null) => scopedClubs.find((c) => c.id === id)?.name
  const { page, setPage, pageCount, pageItems, totalItems, pageSize } =
    usePaginated(scopedTeams, 12)

  async function handleSave(input: TeamInput, id?: string) {
    try {
      if (id) {
        const prev = editing // pre-edit snapshot for undo
        await updateTeam(id, input)
        toast.undo('Team updated', async () => {
          if (!prev) return
          const { id: _i, createdAt: _c, updatedAt: _u, ...prevInput } = prev
          await updateTeam(id, prevInput)
          teams.refetch()
          toast.info('Change reverted')
        })
      } else {
        const newId = await createTeam({ ...input, ownerId: profile?.id })
        toast.undo('Team created', async () => {
          await deleteTeam(newId)
          teams.refetch()
          toast.info('Team removed')
        })
      }
      setShowForm(false)
      setEditing(null)
      teams.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleDelete(t: Team) {
    if (!confirm(`Delete ${t.name}?`)) return
    await deleteTeam(t.id)
    toast.success('Team deleted')
    teams.refetch()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Teams"
        subtitle="Create teams, manage squads and assign captains."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            <Plus size={16} /> Add team
          </Button>
        }
      />

      {teams.loading ? (
        <PageLoader />
      ) : scopedTeams.length === 0 ? (
        <EmptyState
          icon={<Shield size={40} />}
          title="No teams yet"
          description="Create your first team and add players to its squad."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add team
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-4"
                style={{
                  background: `linear-gradient(135deg, ${t.primaryColor}22, ${t.secondaryColor}22)`,
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg font-bold text-white"
                  style={{ backgroundColor: t.primaryColor }}
                >
                  {t.shortName}
                </div>
                <div className="min-w-0">
                  <Link
                    to={`/team/${t.id}`}
                    className="block truncate font-semibold text-ink-900 hover:text-brand-700"
                  >
                    {t.name}
                  </Link>
                  <div className="text-xs text-ink-500">
                    {t.playerIds.length} players
                    {t.clubId && clubName(t.clubId) && ` · ${clubName(t.clubId)}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-ink-100 px-4 py-2.5">
                <div className="flex -space-x-2">
                  {t.playerIds.slice(0, 5).map((pid) => {
                    const p = scopedPlayers.find((x) => x.id === pid)
                    return (
                      <div key={pid} className="ring-2 ring-white rounded-full">
                        <Avatar name={p?.fullName ?? '?'} size={26} />
                      </div>
                    )
                  })}
                  {t.playerIds.length === 0 && (
                    <span className="text-xs text-ink-400">No squad</span>
                  )}
                </div>
                <div className="flex gap-1">
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
              </div>
            </Card>
          ))}
        </div>
      )}

      {scopedTeams.length > 0 && (
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

      {!players.loading && playerCount === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-500">
          <Users size={15} /> Tip: add players first so you can build squads.
        </p>
      )}

      {showForm && (
        <TeamFormModal
          team={editing}
          players={scopedPlayers}
          clubs={scopedClubs}
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
