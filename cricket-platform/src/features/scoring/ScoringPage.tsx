import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Undo2,
  Radio,
  ClipboardList,
  Trophy,
  RefreshCw,
  Eye,
  Keyboard,
  Ban,
  RotateCcw,
  Award,
} from 'lucide-react'
import { Button, Card, PageLoader, Spinner } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { SyncQueuePanel } from '@/components/ui/SyncQueuePanel'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { listPlayers } from '@/services/players.service'
import { subscribeMatch, updateMatch } from '@/services/matches.service'
import {
  startMatch,
  setOpeners,
  setBowler,
  setIncomingBatter,
  recordBall,
  undoLastBall,
  startSecondInnings,
  endInnings,
  abandonMatch,
  reopenMatch,
  setPlayerOfTheMatch,
  battingFirstTeamId,
  squadFor,
  subscribeDeliveries,
} from '@/services/scoring.service'
import { recomputeAllStats, recomputeTournamentStandings } from '@/services/stats.service'
import { recordBallMeta } from '@/services/ballMeta.service'
import { ShotDetailPrompt } from './ShotDetailPrompt'
import { ScorecardView } from '@/features/scorecard/ScorecardView'
import { ballsToOvers, runRate, requiredRate, formatRate } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import { useBgStore } from '@/store/bgStore'
import { cn } from '@/lib/cn'
import {
  PlayerPickModal,
  WicketModal,
  type WicketResult,
} from './ScoringModals'
import type { BallInput, Delivery, ExtraType, Match, Player } from '@/types'

export function ScoringPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const players = useAsync(listPlayers, [])

  const [match, setMatch] = useState<Match | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [activeExtra, setActiveExtra] = useState<ExtraType | null>(null)
  const [wicketOpen, setWicketOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [pendingMeta, setPendingMeta] = useState<{ deliveryId: string; showZone: boolean } | null>(
    null,
  )
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [potmOpen, setPotmOpen] = useState(false)
  const [scorecardOpen, setScorecardOpen] = useState(false)
  // Touch-primary devices (phones/tablets) have no physical keyboard, so the shortcuts this
  // button leads to don't apply — hide the discovery affordance rather than resize it. The
  // underlying keydown handling in ScoringShortcuts is untouched, so a keyboard-attached device
  // (e.g. a tablet with a keyboard case) keeps working exactly the same either way.
  const [touchPrimary] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true,
  )

  useEffect(() => {
    const unsub = subscribeMatch(id, (m) => {
      setMatch(m)
      setLoading(false)
    })
    const unsubD = subscribeDeliveries(id, setDeliveries)
    return () => {
      unsub()
      unsubD()
    }
  }, [id])

  const setTone = useBgStore((s) => s.setTone)
  useEffect(() => {
    setTone('live')
    return () => setTone('default')
  }, [setTone])

  const playerById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  )
  const name = (pid?: string | null) =>
    (pid && playerById.get(pid)?.displayName) || '—'

  if (loading || players.loading) return <PageLoader label="Loading match…" />
  if (!match)
    return (
      <div className="mx-auto max-w-md py-16 text-center text-ink-500 dark:text-ink-400">
        Match not found.
      </div>
    )

  const inn = match.innings[match.currentInnings]
  const curDeliveries = deliveries.filter(
    (d) => d.inningsIndex === match.currentInnings,
  )
  const nextSeq = curDeliveries.length

  const battingSquad = inn ? squadFor(match, inn.battingTeamId) : []
  const bowlingSquad = inn ? squadFor(match, inn.bowlingTeamId) : []

  const battingTeamShort =
    inn?.battingTeamId === match.teamA.id
      ? match.teamA.shortName
      : match.teamB.shortName

  /* ------------------------- actions ------------------------- */
  async function guard(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function score(runs: number, extra?: ExtraType) {
    const m = match!
    setPendingMeta(null)
    await guard(async () => {
      const input: BallInput = { runs, extra }
      const { delivery } = await recordBall(m, input, {
        sequence: nextSeq,
        scorerId: profile?.id,
      })
      setActiveExtra(null)
      setPendingMeta({ deliveryId: delivery.id, showZone: extra !== 'wide' })
    })
  }

  async function confirmWicket(r: WicketResult) {
    const m = match!
    setWicketOpen(false)
    setPendingMeta(null)
    await guard(async () => {
      const input: BallInput = {
        runs: r.runs,
        wicket: {
          type: r.type,
          outBatterId: r.outBatterId,
          fielderId: r.fielderId,
        },
      }
      const { delivery } = await recordBall(m, input, {
        sequence: nextSeq,
        scorerId: profile?.id,
      })
      setPendingMeta({ deliveryId: delivery.id, showZone: r.type !== 'run_out' })
    })
  }

  async function saveShotMeta(patch: Parameters<typeof recordBallMeta>[2]) {
    if (!pendingMeta) return
    try {
      // Merge-write, so tapping zone then line then length accumulates on
      // the same doc rather than overwriting each other.
      await recordBallMeta(match!.id, pendingMeta.deliveryId, patch)
    } catch {
      // best-effort — never interrupt scoring for an optional enrichment
    }
  }

  async function publish() {
    setPublishing(true)
    try {
      await recomputeAllStats()
      if (match?.tournamentId)
        await recomputeTournamentStandings(match.tournamentId)
      toast.success('Stats & standings updated')
    } catch {
      toast.error('Could not update stats')
    } finally {
      setPublishing(false)
    }
  }

  async function choosePotm(pid: string) {
    setPotmOpen(false)
    await guard(() => setPlayerOfTheMatch(match!.id, pid || null))
  }

  async function editToss(wonByTeamId: string, decision: 'bat' | 'bowl') {
    const m = match!
    const battingFirstTeamId =
      decision === 'bat'
        ? wonByTeamId
        : wonByTeamId === m.teamA.id
          ? m.teamB.id
          : m.teamA.id
    await guard(() =>
      updateMatch(m.id, { toss: { wonByTeamId, decision }, battingFirstTeamId }),
    )
  }

  /* ------------------------- lifecycle screens ------------------------- */

  if (match.status === 'setup') {
    const battingId = battingFirstTeamId(match)
    const battingName =
      battingId === match.teamA.id ? match.teamA.name : match.teamB.name
    return (
      <PreMatch
        match={match}
        battingName={battingName}
        onStart={() => guard(() => startMatch(match))}
        onEditToss={editToss}
        busy={busy}
      />
    )
  }

  if (match.status === 'completed' || match.status === 'abandoned') {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <Trophy size={48} className="mx-auto text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold text-ink-900 dark:text-ink-50">Match complete</h1>
        <p className="mt-2 text-lg font-semibold text-pitch-700">
          {match.result?.summary}
        </p>
        {match.result?.outcome === 'tie' && match.superOverEnabled && (
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Super Over enabled per match rules — to be scored as a separate match.
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigate(`/match/${match.id}`)}>
            <Eye size={16} /> View scorecard
          </Button>
          <Button variant="outline" onClick={publish} loading={publishing}>
            <RefreshCw size={16} /> Update stats
          </Button>
          {match.status === 'completed' && (
            <Button variant="outline" onClick={() => setPotmOpen(true)}>
              <Award size={16} />
              {match.playerOfTheMatchId
                ? `POTM: ${name(match.playerOfTheMatchId)}`
                : 'Player of the match'}
            </Button>
          )}
        </div>
        {match.status === 'abandoned' && (
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('Reopen this match and resume scoring live?'))
                  guard(() => reopenMatch(match))
              }}
              loading={busy}
            >
              <RotateCcw size={16} /> Reopen match
            </Button>
          </div>
        )}
        {potmOpen && (
          <PlayerPickModal
            title="Player of the match"
            subtitle="Pick from either squad, or clear the current award."
            options={[
              { id: '', name: 'No award / clear' },
              ...[...match.squadA, ...match.squadB].map((pid) =>
                playerOption(playerById.get(pid), pid),
              ),
            ]}
            onPick={choosePotm}
            onClose={() => setPotmOpen(false)}
          />
        )}
      </div>
    )
  }

  if (match.status === 'innings_break') {
    const first = match.innings[0]
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Innings break</h1>
        <Card className="mt-4 p-5">
          <div className="text-3xl font-bold text-ink-900 dark:text-ink-50">
            {first.totalRuns}/{first.wickets}
          </div>
          <div className="text-ink-500 dark:text-ink-400">
            {ballsToOvers(first.legalBalls, match.ballsPerOver)} overs
          </div>
          <p className="mt-3 text-lg font-semibold text-brand-700">
            Target: {first.totalRuns + 1}
          </p>
        </Card>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            size="lg"
            onClick={() => guard(() => startSecondInnings(match))}
            loading={busy}
          >
            Start 2nd innings
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate(`/match/${match.id}`)}>
            <Eye size={16} /> Scorecard
          </Button>
        </div>
      </div>
    )
  }

  // status === 'live'
  if (!inn) return <PageLoader />

  const needOpeners = !inn.strikerId && !inn.nonStrikerId

  const battedOutIds = new Set(
    inn.battingCard.filter((b) => b.out).map((b) => b.playerId),
  )
  const atCrease = new Set([inn.strikerId, inn.nonStrikerId].filter(Boolean) as string[])

  const incomingOptions = battingSquad
    .filter((pid) => !battedOutIds.has(pid) && !atCrease.has(pid))
    .map((pid) => playerOption(playerById.get(pid), pid))

  /**
   * True "no partner remains" state: Last Man Standing is enabled, a batter
   * slot is empty, and there's nobody left in the squad to fill it. The
   * engine still requires a non-null non-striker for every ball (that's
   * unchanged — see ROADMAP_V4 Slice 2.1a), so this can only be resolved by
   * ending the innings, not by continuing to score solo.
   */
  const lastManStranded =
    !inn.isComplete &&
    !!match.lastManStanding &&
    incomingOptions.length === 0 &&
    (!inn.strikerId || !inn.nonStrikerId) &&
    !needOpeners

  const needBatter =
    !inn.isComplete &&
    (!inn.strikerId || !inn.nonStrikerId) &&
    !needOpeners &&
    !lastManStranded
  const needBowler =
    !inn.isComplete && !!inn.strikerId && !!inn.nonStrikerId && !inn.bowlerId

  const bowlerOptions = bowlingSquad
    .filter((pid) => pid !== inn.lastBowlerId)
    .map((pid) => playerOption(playerById.get(pid), pid))

  const overNum = Math.floor(inn.legalBalls / match.ballsPerOver) + 1

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <ScoreHeader match={match} name={name} battingTeamShort={battingTeamShort} />

      {/* batters + bowler */}
      <Card className="mb-3 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <BatterLine
              label="Striker"
              card={inn.battingCard.find((b) => b.playerId === inn.strikerId)}
              name={name(inn.strikerId)}
              striker
            />
            <BatterLine
              label="Non-striker"
              card={inn.battingCard.find((b) => b.playerId === inn.nonStrikerId)}
              name={name(inn.nonStrikerId)}
            />
          </div>
          <div className="border-l border-ink-100 dark:border-ink-800 pl-4">
            <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
              Bowler
            </div>
            <div className="font-semibold text-ink-900 dark:text-ink-50">{name(inn.bowlerId)}</div>
            {(() => {
              const b = inn.bowlingCard.find((x) => x.playerId === inn.bowlerId)
              if (!b) return <div className="text-sm text-ink-400 dark:text-ink-500">—</div>
              return (
                <div className="text-sm text-ink-600 dark:text-ink-400">
                  {ballsToOvers(b.legalBalls, match.ballsPerOver)}-{b.maidens}-
                  {b.runsConceded}-{b.wickets}
                </div>
              )
            })()}
            <div className="mt-2 text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
              Partnership
            </div>
            <div className="text-sm text-ink-700 dark:text-ink-300">
              {inn.partnershipRuns} ({inn.partnershipBalls})
            </div>
          </div>
        </div>

        {/* recent balls */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto border-t border-ink-100 dark:border-ink-800 pt-3">
          <span className="mr-1 text-xs text-ink-400 dark:text-ink-500">This over</span>
          {ballsThisOver(curDeliveries, inn, match.ballsPerOver).map((d, i) => (
            <BallToken key={i} d={d} />
          ))}
        </div>

        {pendingMeta && (
          <ShotDetailPrompt
            showZone={pendingMeta.showZone}
            onPickZone={(z) => saveShotMeta({ zone: z })}
            onPickLine={(l) => saveShotMeta({ line: l })}
            onPickLength={(l) => saveShotMeta({ length: l })}
            onDismiss={() => setPendingMeta(null)}
          />
        )}
      </Card>

      {/* Prompts */}
      {needOpeners && (
        <OpenersPanel
          battingSquad={battingSquad}
          bowlingSquad={bowlingSquad}
          playerById={playerById}
          onConfirm={(s, ns, b) =>
            guard(() =>
              setOpeners(match, { strikerId: s, nonStrikerId: ns, bowlerId: b }),
            )
          }
        />
      )}

      {needBatter && (
        <PlayerPickModal
          title="New batter"
          subtitle="Select the next batter to come in."
          options={incomingOptions}
          onPick={(pid) => guard(() => setIncomingBatter(match, pid))}
          onClose={() => {}}
        />
      )}

      {needBowler && !needBatter && (
        <PlayerPickModal
          title={`Bowler for over ${overNum}`}
          subtitle="Select the bowler for this over."
          options={bowlerOptions}
          onPick={(pid) => guard(() => setBowler(match, pid))}
          onClose={() => {}}
        />
      )}

      {lastManStranded && (
        <Card className="mb-3 p-4 text-center">
          <p className="font-semibold text-ink-800 dark:text-ink-200">
            No partner remains for {battingTeamShort}
          </p>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Every other player is already out or at the crease — with Last Man Standing, this
            innings can only be closed now.
          </p>
          <Button
            className="mt-3"
            onClick={() => {
              if (confirm('End the current innings now?')) guard(() => endInnings(match))
            }}
            loading={busy}
          >
            End innings
          </Button>
        </Card>
      )}

      {/* Score pad */}
      {!needOpeners && !needBatter && !needBowler && !inn.isComplete && !lastManStranded && (
        <>
          <ScoringShortcuts
            busy={busy}
            activeExtra={activeExtra}
            canUndo={curDeliveries.length > 0}
            onRun={(r) => score(r, activeExtra ?? undefined)}
            onToggleExtra={(e) => setActiveExtra((cur) => (cur === e ? null : e))}
            onClearExtra={() => setActiveExtra(null)}
            onWicket={() => setWicketOpen(true)}
            onUndo={() => guard(() => undoLastBall(match))}
            onEndInnings={() => {
              if (confirm('End the current innings now?')) guard(() => endInnings(match))
            }}
          />
          <ScorePad
            activeExtra={activeExtra}
            busy={busy}
            onRun={(r) => score(r, activeExtra ?? undefined)}
            onToggleExtra={(e) => setActiveExtra((cur) => (cur === e ? null : e))}
            onWicket={() => setWicketOpen(true)}
            onUndo={() => guard(() => undoLastBall(match))}
            canUndo={curDeliveries.length > 0}
            onShowShortcuts={touchPrimary ? undefined : () => setShortcutsOpen(true)}
          />
        </>
      )}

      {inn.isComplete && (
        <Card className="p-4 text-center">
          <p className="font-semibold text-ink-800 dark:text-ink-200">
            Innings complete — {inn.closeReason.replace('_', ' ')}
          </p>
          <Button
            className="mt-3"
            onClick={() =>
              guard(async () => {
                // recordBall already transitions; this is a manual fallback
                if (match.currentInnings === 0) await startSecondInnings(match)
              })
            }
          >
            Continue
          </Button>
        </Card>
      )}

      <SyncQueuePanel className="mt-3" />

      {/* Footer actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Radio size={14} className="text-red-500" /> Scoring live · auto-saved
          {busy && <Spinner size={14} />}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScorecardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <ClipboardList size={15} /> Scorecard
          </button>
          <button
            onClick={() => {
              if (confirm('End the current innings now?'))
                guard(() => endInnings(match))
            }}
            className="rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            End innings
          </button>
          <button
            onClick={() => {
              if (confirm('Abandon this match? This ends it with no result and cannot be undone from here (it can be reopened afterward).'))
                guard(() => abandonMatch(match))
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Ban size={14} /> Abandon match
          </button>
        </div>
      </div>

      {wicketOpen && inn.strikerId && (
        <WicketModal
          strikerId={inn.strikerId}
          nonStrikerId={inn.nonStrikerId}
          battingPlayers={(players.data ?? []).filter((p) =>
            battingSquad.includes(p.id),
          )}
          fieldingPlayers={(players.data ?? []).filter((p) =>
            bowlingSquad.includes(p.id),
          )}
          retiredHurtEnabled={match.retiredHurtEnabled !== false}
          activeExtra={activeExtra}
          onConfirm={confirmWicket}
          onClose={() => setWicketOpen(false)}
        />
      )}

      <ShortcutsHelpModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <Modal
        open={scorecardOpen}
        onClose={() => setScorecardOpen(false)}
        title="Scorecard"
        size="xl"
      >
        <ScorecardView match={match} players={players.data ?? []} deliveries={deliveries} />
      </Modal>
    </div>
  )
}

/* ============================ sub-components ============================ */

/**
 * Keyboard shortcuts for live scoring. Renders nothing — a child component so its
 * `useEffect` can be mounted/unmounted exactly when the score pad is (the parent
 * has early returns before this point in the render, which rules out placing a
 * hook here directly without breaking the rules-of-hooks).
 */
function ScoringShortcuts({
  busy,
  activeExtra,
  canUndo,
  onRun,
  onToggleExtra,
  onClearExtra,
  onWicket,
  onUndo,
  onEndInnings,
}: {
  busy: boolean
  activeExtra: ExtraType | null
  canUndo: boolean
  onRun: (r: number) => void
  onToggleExtra: (e: ExtraType) => void
  onClearExtra: () => void
  onWicket: () => void
  onUndo: () => void
  onEndInnings: () => void
}) {
  useEffect(() => {
    function isTypingTarget(el: Element | null): boolean {
      const tag = el?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(document.activeElement)) return
      const key = e.key.toLowerCase()
      if (key === 'escape') {
        if (activeExtra) {
          e.preventDefault()
          onClearExtra()
        }
        return
      }
      if (busy) return
      if (['0', '1', '2', '3', '4', '6'].includes(key)) {
        e.preventDefault()
        onRun(Number(key))
        return
      }
      switch (key) {
        case 'w':
          e.preventDefault()
          onWicket()
          break
        case 'q':
          e.preventDefault()
          onToggleExtra('wide')
          break
        case 'n':
          e.preventDefault()
          onToggleExtra('no_ball')
          break
        case 'b':
          e.preventDefault()
          onToggleExtra('bye')
          break
        case 'l':
          e.preventDefault()
          onToggleExtra('leg_bye')
          break
        case 'u':
          if (canUndo) {
            e.preventDefault()
            onUndo()
          }
          break
        case 'e':
          e.preventDefault()
          onEndInnings()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, activeExtra, canUndo, onRun, onToggleExtra, onClearExtra, onWicket, onUndo, onEndInnings])

  return null
}

const SHORTCUT_LIST: { keys: string; label: string }[] = [
  { keys: '0 1 2 3 4 6', label: 'Score that many runs' },
  { keys: 'W', label: 'Wicket' },
  { keys: 'Q', label: 'Wide (toggle, then tap/press a run key)' },
  { keys: 'N', label: 'No ball (toggle, then tap/press a run key)' },
  { keys: 'B', label: 'Bye' },
  { keys: 'L', label: 'Leg bye' },
  { keys: 'U', label: 'Undo last ball' },
  { keys: 'E', label: 'End innings' },
  { keys: 'Esc', label: 'Cancel a selected extra' },
]

function ShortcutsHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <div className="space-y-2">
        {SHORTCUT_LIST.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-700 dark:text-ink-300">{s.label}</span>
            <span className="flex shrink-0 gap-1">
              {s.keys.split(' ').map((k) => (
                <kbd
                  key={k}
                  className="rounded border border-ink-300 bg-ink-50 px-1.5 py-0.5 font-mono text-xs text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">
        Disabled while typing in a text field, and ignored with Ctrl/Cmd/Alt held down.
      </p>
    </Modal>
  )
}

function playerOption(p: Player | undefined, id: string) {
  return { id, name: p?.displayName ?? 'Player', photoURL: p?.photoURL }
}

function ScoreHeader({
  match,
  name,
  battingTeamShort,
}: {
  match: Match
  name: (id?: string | null) => string
  battingTeamShort: string
}) {
  const inn = match.innings[match.currentInnings]
  const crr = runRate(inn.totalRuns, inn.legalBalls, match.ballsPerOver)
  const chasing = inn.target != null
  const ballsLeft = match.oversPerInnings * match.ballsPerOver - inn.legalBalls
  const need = inn.target != null ? Math.max(0, inn.target - inn.totalRuns) : 0
  const rrr = chasing ? requiredRate(need, ballsLeft, match.ballsPerOver) : 0

  return (
    <Card className="sticky top-2 z-20 mb-3 overflow-hidden shadow-md">
      <div className="bg-ink-900 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-300">{match.title}</span>
          <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-xs font-bold uppercase">
            Live
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-3xl font-extrabold">
              {battingTeamShort} {inn.totalRuns}/{inn.wickets}
            </div>
            <div className="text-ink-300">
              {ballsToOvers(inn.legalBalls, match.ballsPerOver)} /{' '}
              {match.oversPerInnings} ov · CRR {formatRate(crr)}
            </div>
          </div>
          {chasing && (
            <div className="text-right text-sm">
              <div className="text-ink-300">Target {inn.target}</div>
              <div className="font-semibold">
                Need {need} in {ballsLeft}
              </div>
              <div className="text-ink-300">RRR {formatRate(rrr)}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function BatterLine({
  label,
  card,
  name,
  striker,
}: {
  label: string
  card?: { runs: number; balls: number; fours: number; sixes: number }
  name: string
  striker?: boolean
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-ink-900 dark:text-ink-50">
          {name}
          {striker && <span className="text-pitch-600"> *</span>}
        </span>
        {card && (
          <span className="text-sm text-ink-600 dark:text-ink-400">
            {card.runs} ({card.balls})
          </span>
        )}
      </div>
      {card && (card.fours > 0 || card.sixes > 0) && (
        <div className="text-xs text-ink-400 dark:text-ink-500">
          {card.fours}×4 · {card.sixes}×6
        </div>
      )}
    </div>
  )
}

function BallToken({ d }: { d: Delivery }) {
  let label = String(d.runsOffBat)
  let cls = 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300'
  if (d.wicket && d.wicket.type !== 'retired_hurt') {
    label = 'W'
    cls = 'bg-red-600 text-white'
  } else if (d.extraType === 'wide') {
    label = `wd${d.extraRuns - 1 || ''}`
    cls = 'bg-amber-100 text-amber-800'
  } else if (d.extraType === 'no_ball') {
    label = `nb${d.runsOffBat || ''}`
    cls = 'bg-amber-100 text-amber-800'
  } else if (d.extraType === 'bye') {
    label = `${d.totalRuns}b`
    cls = 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400'
  } else if (d.extraType === 'leg_bye') {
    label = `${d.totalRuns}lb`
    cls = 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400'
  } else if (d.runsOffBat === 4 || d.runsOffBat === 6) {
    cls = 'bg-pitch-600 text-white'
  } else if (d.runsOffBat === 0) {
    label = '•'
  }
  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold',
        cls,
      )}
    >
      {label}
    </span>
  )
}

function ballsThisOver(
  deliveries: Delivery[],
  inn: { legalBalls: number },
  ballsPerOver: number,
): Delivery[] {
  // gather deliveries belonging to the current (in-progress) over
  const completedOvers = Math.floor(inn.legalBalls / ballsPerOver)
  return deliveries.filter((d) => d.overNumber === completedOvers).slice(-10)
}

function ScorePad({
  activeExtra,
  busy,
  onRun,
  onToggleExtra,
  onWicket,
  onUndo,
  canUndo,
  onShowShortcuts,
}: {
  activeExtra: ExtraType | null
  busy: boolean
  onRun: (r: number) => void
  onToggleExtra: (e: ExtraType) => void
  onWicket: () => void
  onUndo: () => void
  canUndo: boolean
  onShowShortcuts?: () => void
}) {
  const runs = [0, 1, 2, 3, 4, 6]
  const extras: { key: ExtraType; label: string; shortcut: string }[] = [
    { key: 'wide', label: 'Wide', shortcut: 'Q' },
    { key: 'no_ball', label: 'No ball', shortcut: 'N' },
    { key: 'bye', label: 'Bye', shortcut: 'B' },
    { key: 'leg_bye', label: 'Leg bye', shortcut: 'L' },
  ]
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
          Score pad
        </span>
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-400 hover:bg-ink-100 hover:text-ink-600 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-300"
          >
            <Keyboard size={13} /> Shortcuts
          </button>
        )}
      </div>
      {activeExtra && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <b className="capitalize">{activeExtra.replace('_', ' ')}</b> selected —
          tap a number for runs ran (tap 0 for just the extra).
        </div>
      )}
      <div className="grid grid-cols-3 gap-2.5">
        {runs.map((r) => (
          <button
            key={r}
            disabled={busy}
            onClick={() => onRun(r)}
            className={cn(
              'relative flex h-16 items-center justify-center rounded-xl text-2xl font-bold transition active:scale-95 disabled:opacity-50',
              r === 4 || r === 6
                ? 'bg-pitch-600 text-white hover:bg-pitch-700'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-800 dark:text-ink-200 hover:bg-ink-200',
            )}
          >
            {r}
            <kbd className="absolute right-1.5 top-1.5 text-[10px] font-normal opacity-60">
              {r}
            </kbd>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {extras.map((e) => (
          <button
            key={e.key}
            onClick={() => onToggleExtra(e.key)}
            className={cn(
              'relative h-11 rounded-lg border text-sm font-semibold',
              activeExtra === e.key
                ? 'border-amber-500 bg-amber-100 text-amber-800'
                : 'border-ink-300 dark:border-ink-700 text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800',
            )}
          >
            {e.label}
            <kbd className="absolute right-1 top-1 text-[9px] font-normal opacity-60">
              {e.shortcut}
            </kbd>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onWicket}
          disabled={busy}
          className="relative h-12 rounded-lg bg-red-600 font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          Wicket
          <kbd className="absolute right-1.5 top-1.5 text-[10px] font-normal opacity-70">W</kbd>
        </button>
        <button
          onClick={onUndo}
          disabled={busy || !canUndo}
          className="relative flex h-12 items-center justify-center gap-2 rounded-lg border border-ink-300 dark:border-ink-700 font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40"
        >
          <Undo2 size={18} /> Undo
          <kbd className="absolute right-1.5 top-1.5 text-[10px] font-normal opacity-60">U</kbd>
        </button>
      </div>
    </Card>
  )
}

function PreMatch({
  match,
  battingName,
  onStart,
  onEditToss,
  busy,
}: {
  match: Match
  battingName: string
  onStart: () => void
  onEditToss: (wonByTeamId: string, decision: 'bat' | 'bowl') => void
  busy: boolean
}) {
  const [editingToss, setEditingToss] = useState(false)
  const [tossWinner, setTossWinner] = useState<'A' | 'B'>(
    match.toss?.wonByTeamId === match.teamB.id ? 'B' : 'A',
  )
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>(
    match.toss?.decision ?? 'bat',
  )

  function saveToss() {
    onEditToss(tossWinner === 'A' ? match.teamA.id : match.teamB.id, tossDecision)
    setEditingToss(false)
  }

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">{match.title}</h1>
      <p className="mt-1 text-ink-500 dark:text-ink-400">
        {match.teamA.name} vs {match.teamB.name}
      </p>
      <Card className="mt-5 p-5 text-left">
        <div className="text-sm text-ink-600 dark:text-ink-400">
          <div>
            <b>Format:</b> {match.format} · {match.oversPerInnings} overs
          </div>
          {!editingToss && match.toss && (
            <div className="mt-1 flex items-center justify-between gap-2">
              <span>
                <b>Toss:</b>{' '}
                {match.toss.wonByTeamId === match.teamA.id
                  ? match.teamA.name
                  : match.teamB.name}{' '}
                chose to {match.toss.decision}
              </span>
              <button
                onClick={() => {
                  setTossWinner(match.toss?.wonByTeamId === match.teamB.id ? 'B' : 'A')
                  setTossDecision(match.toss?.decision ?? 'bat')
                  setEditingToss(true)
                }}
                className="shrink-0 text-xs font-semibold text-brand-600 hover:underline"
              >
                Edit
              </button>
            </div>
          )}
          {editingToss && (
            <div className="mt-2 space-y-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3">
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-700 dark:text-ink-300">
                  Who won the toss?
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['A', 'B'] as const).map((slot) => {
                    const t = slot === 'A' ? match.teamA : match.teamB
                    return (
                      <button
                        key={slot}
                        onClick={() => setTossWinner(slot)}
                        className={cn(
                          'rounded-lg border-2 p-2 text-left text-sm',
                          tossWinner === slot
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-ink-200 dark:border-ink-800 hover:border-ink-300',
                        )}
                      >
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-700 dark:text-ink-300">
                  Elected to
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['bat', 'bowl'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setTossDecision(d)}
                      className={cn(
                        'rounded-lg border-2 p-2 text-sm font-semibold capitalize',
                        tossDecision === d
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 dark:border-ink-800 text-ink-700 dark:text-ink-300 hover:border-ink-300',
                      )}
                    >
                      {d} first
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingToss(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveToss} loading={busy}>
                  Save toss
                </Button>
              </div>
            </div>
          )}
          <div className="mt-1">
            <b>Batting first:</b> {battingName}
          </div>
          <div className="mt-1">
            <b>Wickets:</b> {match.maxWickets ?? Math.max(match.squadA.length, match.squadB.length) - 1}
            {' · '}
            <b>Team size:</b> {match.teamSize ?? Math.max(match.squadA.length, match.squadB.length)}
            {' · '}
            <b>Powerplay:</b> {match.powerplayOvers ?? '—'} overs
          </div>
          {(match.lastManStanding || match.retiredHurtEnabled === false || match.superOverEnabled) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.lastManStanding && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  Last man standing
                </span>
              )}
              {match.retiredHurtEnabled === false && (
                <span className="rounded-full bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-xs font-medium text-ink-600 dark:text-ink-400">
                  No retired hurt
                </span>
              )}
              {match.superOverEnabled && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Super Over
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
      <Button className="mt-6" size="lg" onClick={onStart} loading={busy}>
        Start match
      </Button>
    </div>
  )
}

function OpenersPanel({
  battingSquad,
  bowlingSquad,
  playerById,
  onConfirm,
}: {
  battingSquad: string[]
  bowlingSquad: string[]
  playerById: Map<string, Player>
  onConfirm: (strikerId: string, nonStrikerId: string, bowlerId: string) => void
}) {
  const [striker, setStriker] = useState('')
  const [nonStriker, setNonStriker] = useState('')
  const [bowler, setBowler] = useState('')
  const nm = (id: string) => playerById.get(id)?.displayName ?? 'Player'

  const ready = striker && nonStriker && bowler && striker !== nonStriker

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-semibold text-ink-900 dark:text-ink-50">Set openers & bowler</h3>
      <div className="space-y-3">
        <PickRow
          label="Striker"
          options={battingSquad}
          value={striker}
          exclude={nonStriker}
          nm={nm}
          onChange={setStriker}
        />
        <PickRow
          label="Non-striker"
          options={battingSquad}
          value={nonStriker}
          exclude={striker}
          nm={nm}
          onChange={setNonStriker}
        />
        <PickRow
          label="Opening bowler"
          options={bowlingSquad}
          value={bowler}
          nm={nm}
          onChange={setBowler}
        />
      </div>
      <Button
        className="mt-4"
        block
        disabled={!ready}
        onClick={() => onConfirm(striker, nonStriker, bowler)}
      >
        Start scoring
      </Button>
    </Card>
  )
}

function PickRow({
  label,
  options,
  value,
  exclude,
  nm,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  exclude?: string
  nm: (id: string) => string
  onChange: (id: string) => void
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-ink-700 dark:text-ink-300">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm"
      >
        <option value="">Select…</option>
        {options.map((id) => (
          <option key={id} value={id} disabled={id === exclude}>
            {nm(id)}
          </option>
        ))}
      </select>
    </div>
  )
}
