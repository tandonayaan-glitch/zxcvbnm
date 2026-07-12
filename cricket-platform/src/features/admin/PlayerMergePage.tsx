import { useMemo, useState } from 'react'
import { ArrowRight, AlertTriangle, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, Button, Card, CardBody, CardHeader, PageLoader, Select, Field, EmptyState } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { useAuthStore } from '@/store/authStore'
import { listPlayers } from '@/services/players.service'
import { mergePlayers } from '@/services/playerMerge.service'
import { findDuplicateCandidates } from '@/domain/duplicateDetection'

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

  const candidates = useMemo(
    () => findDuplicateCandidates(players.data ?? []).slice(0, 10),
    [players.data],
  )
  const nameOf = (id: string) => players.data?.find((p) => p.id === id)?.fullName ?? id

  function review(aId: string, bId: string) {
    setKeepId(aId)
    setMergeId(bId)
  }

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
        <>
          {candidates.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Sparkles size={16} /> Suggested duplicates
                  </span>
                }
                subtitle="Similar names found automatically — review before merging, nothing happens until you confirm below."
              />
              <CardBody className="space-y-2">
                {candidates.map((c) => (
                  <div
                    key={`${c.playerAId}-${c.playerBId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2 dark:border-ink-800"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-ink-900 dark:text-ink-50">
                        {nameOf(c.playerAId)}
                      </span>
                      <ArrowRight size={14} className="text-ink-400" />
                      <span className="font-medium text-ink-900 dark:text-ink-50">
                        {nameOf(c.playerBId)}
                      </span>
                      <Badge tone={c.similarity >= 0.9 ? 'red' : 'amber'}>
                        {Math.round(c.similarity * 100)}% similar
                      </Badge>
                      {c.sameTeam && <Badge tone="blue">Same team</Badge>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => review(c.playerAId, c.playerBId)}
                    >
                      Review
                    </Button>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

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
        </>
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
