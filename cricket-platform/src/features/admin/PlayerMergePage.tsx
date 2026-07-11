import { useMemo, useState } from 'react'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card, CardBody, CardHeader, PageLoader, Select, Field, EmptyState } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore } from '@/store/authStore'
import { listPlayers } from '@/services/players.service'
import { mergePlayers } from '@/services/playerMerge.service'

export function PlayerMergePage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const players = useAsync(listPlayers, [])
  const [keepId, setKeepId] = useState('')
  const [mergeId, setMergeId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [merging, setMerging] = useState(false)

  const keepPlayer = useMemo(
    () => players.data?.find((p) => p.id === keepId) ?? null,
    [players.data, keepId],
  )
  const mergePlayer = useMemo(
    () => players.data?.find((p) => p.id === mergeId) ?? null,
    [players.data, mergeId],
  )
  const canMerge = !!keepId && !!mergeId && keepId !== mergeId

  async function doMerge() {
    if (!keepPlayer || !mergePlayer) return
    setMerging(true)
    try {
      await mergePlayers(profile, keepPlayer.id, mergePlayer.id)
      toast.success(`Merged "${mergePlayer.fullName}" into "${keepPlayer.fullName}"`)
      setConfirming(false)
      setMergeId('')
      players.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMerging(false)
    }
  }

  if (players.loading) return <PageLoader label="Loading players…" />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merge duplicate players"
        subtitle="Fold a duplicate profile into the profile you want to keep — every match, team, and stat reference moves over, then the duplicate is deleted."
      />

      {!players.data?.length ? (
        <EmptyState title="No players yet" description="Create players before merging duplicates." />
      ) : (
        <Card>
          <CardHeader title="Choose the two profiles" />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <Field label="Keep this profile">
                <Select value={keepId} onChange={(e) => setKeepId(e.target.value)}>
                  <option value="">Select a player…</option>
                  {players.data.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.id === mergeId}>
                      {p.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="hidden justify-center pb-2.5 sm:flex">
                <ArrowRight className="text-ink-400" size={20} />
              </div>
              <Field label="Merge away (will be deleted)">
                <Select value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
                  <option value="">Select a player…</option>
                  {players.data.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.id === keepId}>
                      {p.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {canMerge && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  Every match squad, scorecard entry, ball-by-ball delivery, and team roster spot
                  held by <strong>{mergePlayer?.fullName}</strong> will be rewritten to point at{' '}
                  <strong>{keepPlayer?.fullName}</strong>, stats will be recomputed, and the{' '}
                  <strong>{mergePlayer?.fullName}</strong> profile will be permanently deleted. This
                  cannot be undone.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button disabled={!canMerge} onClick={() => setConfirming(true)}>
                Merge players
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Modal
        open={confirming}
        onClose={() => !merging && setConfirming(false)}
        title="Confirm merge"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={merging}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doMerge} disabled={merging}>
              {merging ? 'Merging…' : 'Merge & delete duplicate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Merge <strong>{mergePlayer?.fullName}</strong> into <strong>{keepPlayer?.fullName}</strong>{' '}
          and permanently delete the duplicate profile?
        </p>
      </Modal>
    </div>
  )
}
