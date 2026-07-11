import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Archive, ArchiveRestore, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageLoader,
  Select,
} from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { usePaginated } from '@/hooks/usePaginated'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/toast'
import {
  listPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  setPlayerActive,
  type PlayerInput,
} from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listAllMatches } from '@/services/matches.service'
import { aggregatePlayerStats, buildLeaderboards } from '@/domain/stats'
import { LeaderboardCard } from '@/components/stats/LeaderboardCard'
import { PLAYER_ROLE_LABELS, BOWLING_STYLE_LABELS } from '@/lib/format'
import { useAuthStore, ownerScope } from '@/store/authStore'
import { PlayerFormModal } from './PlayerFormModal'
import type { Player } from '@/types'

export function PlayersPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const players = useAsync(listPlayers, [])
  const matches = useAsync(listAllMatches, [])

  // Global rankings (not owner-scoped — these are platform-wide leaderboards).
  const playerMap = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  )
  const leaderboards = useMemo(
    () => buildLeaderboards(aggregatePlayerStats(matches.data ?? [])),
    [matches.data],
  )
  const topBoards = leaderboards.filter((b) =>
    ['runs', 'wickets', 'sr'].includes(b.key),
  )
  const teams = useAsync(listTeams, [])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [editing, setEditing] = useState<Player | null>(null)
  const [showForm, setShowForm] = useState(false)

  const teamName = useMemo(() => {
    const map = new Map((teams.data ?? []).map((t) => [t.id, t.shortName]))
    return (id: string) => map.get(id) ?? '—'
  }, [teams.data])

  const filtered = useMemo(() => {
    const list = players.data ?? []
    const q = search.toLowerCase().trim()
    return list.filter((p) => {
      if (scope && p.ownerId !== scope) return false
      if (roleFilter && p.role !== roleFilter) return false
      if (!q) return true
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q)
      )
    })
  }, [players.data, search, roleFilter, scope])

  const { page, setPage, pageCount, pageItems, totalItems, pageSize } =
    usePaginated(filtered, 20)

  async function handleSave(input: PlayerInput, id?: string) {
    try {
      if (id) {
        const prev = editing // pre-edit snapshot for undo
        await updatePlayer(id, input)
        toast.undo('Player updated', async () => {
          if (!prev) return
          await updatePlayer(id, {
            fullName: prev.fullName,
            displayName: prev.displayName,
            shortName: prev.shortName,
            role: prev.role,
            battingStyle: prev.battingStyle,
            bowlingStyle: prev.bowlingStyle,
            photoURL: prev.photoURL ?? null,
            teamIds: prev.teamIds,
            active: prev.active,
          })
          players.refetch()
          toast.info('Change reverted')
        })
      } else {
        const newId = await createPlayer({ ...input, ownerId: profile?.id })
        toast.undo('Player created', async () => {
          await deletePlayer(newId)
          players.refetch()
          toast.info('Player removed')
        })
      }
      setShowForm(false)
      setEditing(null)
      players.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function toggleActive(p: Player) {
    await setPlayerActive(p.id, !p.active)
    players.refetch()
  }

  async function handleDelete(p: Player) {
    if (!confirm(`Delete ${p.fullName}? This cannot be undone.`)) return
    await deletePlayer(p.id)
    toast.success('Player deleted')
    players.refetch()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Players"
        subtitle="Manage your player roster, roles and team assignments."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            <Plus size={16} /> Add player
          </Button>
        }
      />

      {topBoards.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">
            Global rankings
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {topBoards.map((board, i) => (
              <LeaderboardCard
                key={board.key}
                board={board}
                players={playerMap}
                limit={5}
                tone={i}
              />
            ))}
          </div>
        </div>
      )}

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players…"
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="sm:w-48"
          >
            <option value="">All roles</option>
            {Object.entries(PLAYER_ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {players.loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="No players yet"
          description="Add your first player to start building teams and scoring matches."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add player
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-semibold">Player</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Bowling</th>
                  <th className="px-4 py-3 font-semibold">Teams</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/player/${p.id}`}
                        className="flex items-center gap-3 font-medium text-ink-900 hover:text-brand-700"
                      >
                        <Avatar name={p.fullName} src={p.photoURL} size={34} />
                        <div>
                          <div>{p.fullName}</div>
                          <div className="text-xs text-ink-400">
                            {p.displayName}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="blue">{PLAYER_ROLE_LABELS[p.role]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {BOWLING_STYLE_LABELS[p.bowlingStyle]}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">
                      {p.teamIds.length
                        ? p.teamIds.map(teamName).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.active ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="gray">Archived</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Edit"
                          aria-label={`Edit ${p.fullName}`}
                          onClick={() => {
                            setEditing(p)
                            setShowForm(true)
                          }}
                          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title={p.active ? 'Archive' : 'Restore'}
                          aria-label={`${p.active ? 'Archive' : 'Restore'} ${p.fullName}`}
                          onClick={() => toggleActive(p)}
                          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                        >
                          {p.active ? (
                            <Archive size={16} />
                          ) : (
                            <ArchiveRestore size={16} />
                          )}
                        </button>
                        <button
                          title="Delete"
                          aria-label={`Delete ${p.fullName}`}
                          onClick={() => handleDelete(p)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <PlayerFormModal
          player={editing}
          teams={teams.data ?? []}
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
