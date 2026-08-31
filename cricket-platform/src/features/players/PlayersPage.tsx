import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Users,
  History,
} from 'lucide-react'
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SavedFiltersBar } from '@/components/ui/SavedFiltersBar'
import { VersionHistoryModal } from '@/components/ui/VersionHistoryModal'
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
import { createLinkedAccount } from '@/services/auth.service'
import { softDelete } from '@/services/trash.service'
import { snapshotVersion, changedKeys } from '@/services/versionHistory.service'
import { aggregatePlayerStats, buildLeaderboards } from '@/domain/stats'
import { LeaderboardCard } from '@/components/stats/LeaderboardCard'
import { PLAYER_ROLE_LABELS, BOWLING_STYLE_LABELS } from '@/lib/format'
import { useAuthStore, ownerScope, canBuildRoster } from '@/store/authStore'
import { permissionAwareMessage } from '@/lib/firebaseError'
import { PlayerFormModal } from './PlayerFormModal'
import { CredentialsDialog } from './CredentialsDialog'
import type { Player } from '@/types'

export function PlayersPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const canAdd = canBuildRoster(profile)
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
  const [credentials, setCredentials] = useState<{
    playerName: string
    username: string
    password: string
  } | null>(null)
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null)

  const teamName = useMemo(() => {
    const map = new Map((teams.data ?? []).map((t) => [t.id, t.shortName]))
    return (id: string) => map.get(id) ?? '—'
  }, [teams.data])

  const currentFilter = { search, roleFilter }
  function applySavedFilter(f: Record<string, string>) {
    setSearch(f.search ?? '')
    setRoleFilter(f.roleFilter ?? '')
  }

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

  async function handleSave(
    input: PlayerInput,
    id?: string,
    createLogin?: boolean,
    reason?: string,
  ) {
    try {
      if (id) {
        const prev = editing // pre-edit snapshot for undo
        await updatePlayer(id, input)
        if (prev) {
          await snapshotVersion(
            'player',
            id,
            prev,
            changedKeys(prev, input),
            profile,
            reason,
          )
        }
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
        if (createLogin) {
          try {
            const creds = await createLinkedAccount(input.displayName)
            await updatePlayer(newId, { linkedUserId: creds.uid })
            setCredentials({
              playerName: input.displayName,
              username: creds.username,
              password: creds.password,
            })
          } catch (e) {
            toast.error(
              `Player created, but the linked account failed: ${
                e instanceof Error ? e.message : 'unknown error'
              }`,
            )
          }
        }
      }
      setShowForm(false)
      setEditing(null)
      players.refetch()
    } catch (e) {
      toast.error(
        permissionAwareMessage(
          e,
          "You don't have permission to add players. Ask an admin for Team Manager access.",
        ),
      )
    }
  }

  async function toggleActive(p: Player) {
    try {
      await setPlayerActive(p.id, !p.active)
      toast.success(p.active ? `${p.fullName} archived` : `${p.fullName} restored`)
      players.refetch()
    } catch (e) {
      toast.error(
        permissionAwareMessage(
          e,
          "You don't have permission to change this player. Only its owner or a master admin can.",
        ),
      )
    }
  }

  /** Runs from the confirm dialog; rethrows so the dialog surfaces the real reason inline
   *  instead of the button appearing to do nothing. */
  async function doDelete(p: Player) {
    await softDelete('player', p.id, profile)
    toast.success('Player moved to Trash')
    players.refetch()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Players"
        subtitle="Manage your player roster, roles and team assignments."
        actions={
          canAdd ? (
            <Button
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              <Plus size={16} /> Add player
            </Button>
          ) : undefined
        }
      />

      {topBoards.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500"
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

      <div className="mb-4">
        <SavedFiltersBar
          pageKey="players"
          current={currentFilter}
          onApply={applySavedFilter}
        />
      </div>

      {players.loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="No players yet"
          description={
            canAdd
              ? 'Add your first player to start building teams and scoring matches.'
              : "You don't have permission to add players yet — ask an admin for Team Manager access."
          }
          action={
            canAdd ? (
              <Button onClick={() => setShowForm(true)}>
                <Plus size={16} /> Add player
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
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
                  <tr key={p.id} className="border-b border-ink-50 dark:border-ink-800 hover:bg-ink-50/50">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/player/${p.id}`}
                        className="flex items-center gap-3 font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                      >
                        <Avatar name={p.fullName} src={p.photoURL} size={34} />
                        <div>
                          <div>{p.fullName}</div>
                          <div className="text-xs text-ink-400 dark:text-ink-500">
                            {p.displayName}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="blue">{PLAYER_ROLE_LABELS[p.role]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-600 dark:text-ink-400">
                      {BOWLING_STYLE_LABELS[p.bowlingStyle]}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600 dark:text-ink-400">
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
                          className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-800 dark:hover:text-ink-200"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Edit history"
                          aria-label={`Edit history for ${p.fullName}`}
                          onClick={() => setHistoryPlayerId(p.id)}
                          className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-800 dark:hover:text-ink-200"
                        >
                          <History size={16} />
                        </button>
                        <button
                          title={
                            p.active
                              ? 'Archive (hide from squad selection)'
                              : 'Restore (make selectable again)'
                          }
                          aria-label={`${p.active ? 'Archive' : 'Restore'} ${p.fullName}`}
                          onClick={() => toggleActive(p)}
                          className="rounded-md p-1.5 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-800 dark:hover:text-ink-200"
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
                          onClick={() => setConfirmDelete(p)}
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
          existingPlayers={players.data ?? []}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {credentials && (
        <CredentialsDialog
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}

      {historyPlayerId && (
        <VersionHistoryModal
          entityType="player"
          entityId={historyPlayerId}
          onClose={() => setHistoryPlayerId(null)}
          onRestored={() => players.refetch()}
        />
      )}

      {/* keep ConfirmDialog last so it stacks above other modals */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Move player to Trash"
        message={
          confirmDelete ? (
            <>
              Move <strong>{confirmDelete.fullName}</strong> to Trash? They'll stop appearing in
              rosters and squad pickers. You can restore them from Trash later.
            </>
          ) : null
        }
        confirmLabel="Move to Trash"
        onConfirm={async () => {
          if (confirmDelete) await doDelete(confirmDelete)
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
