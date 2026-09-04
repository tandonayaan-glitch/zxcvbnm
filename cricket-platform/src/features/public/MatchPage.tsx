import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Radio,
  MapPin,
  Calendar,
  Settings2,
  Pencil,
  Award,
  Download,
  FileJson,
  Printer,
  TrendingUp,
  Target,
  BarChart3,
  ClipboardList,
  Images,
  MessageSquare,
} from 'lucide-react'
import {
  Card,
  LiveBadge,
  PageLoader,
  Badge,
} from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { listPlayers } from '@/services/players.service'
import { subscribeMatch, updateMatch, listAllMatches } from '@/services/matches.service'
import { setPlayerOfTheMatch, subscribeDeliveries } from '@/services/scoring.service'
import { ScorecardView } from '@/features/scorecard/ScorecardView'
import { MatchGraphs } from '@/components/charts/MatchGraphs'
import { MatchInsights } from '@/components/charts/MatchInsights'
import { WagonWheel } from '@/components/charts/WagonWheel'
import { PitchMap } from '@/components/charts/PitchMap'
import { listBallMeta } from '@/services/ballMeta.service'
import { wagonWheelData, hasWagonWheelData } from '@/domain/wagonWheel'
import { pitchMapData, hasPitchMapData } from '@/domain/pitchMap'
import { ScorecardConfigModal } from '@/features/scorecard/ScorecardConfigModal'
import { matchToCSV, matchToJSON, exportSlug } from '@/domain/matchExport'
import { downloadBlob } from '@/lib/download'
import { MatchGallery } from '@/components/media/MatchGallery'
import { MatchMediaSection } from '@/components/broadcast/MatchMediaSection'
import { CommentSection } from '@/components/media/CommentSection'
import { MatchReactions } from '@/components/media/MatchReactions'
import { ShareButton } from '@/components/ui/ShareButton'
import { QRCodeButton } from '@/components/ui/QRCodeButton'
import { EmbedButton } from '@/components/ui/EmbedButton'
import { AddToCalendarButton } from '@/components/ui/AddToCalendarButton'
import { computeHeadToHead } from '@/domain/headToHead'
import { matchTopPerformers } from '@/domain/matchPerformers'
import { chaseWinProbability } from '@/domain/winProbability'
import { projectFirstInningsScore } from '@/domain/expectedScore'
import { useAuthStore, canScore, isAdmin } from '@/store/authStore'
import { PremiumGate } from '@/components/guards/PremiumGate'
import { useBgStore } from '@/store/bgStore'
import {
  ballsToOvers,
  formatDate,
  formatRate,
  runRate,
  requiredRate,
} from '@/lib/format'
import type { Delivery, Match, ScorecardConfig } from '@/types'

export function MatchPage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const players = useAsync(listPlayers, [])
  const allMatches = useAsync(listAllMatches, [])
  const ballMeta = useAsync(() => listBallMeta(id), [id])

  const [match, setMatch] = useState<Match | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [potmOpen, setPotmOpen] = useState(false)

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
    const st = match?.status
    setTone(
      st === 'live' || st === 'innings_break'
        ? 'live'
        : st === 'completed' || st === 'abandoned'
          ? 'completed'
          : st === 'setup'
            ? 'upcoming'
            : 'default',
    )
    return () => setTone('default')
  }, [match?.status, setTone])

  const playerById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  )
  const name = (pid?: string | null) =>
    (pid && playerById.get(pid)?.displayName) || '—'

  // This page re-renders on every scored ball (live onSnapshot subscription),
  // so head-to-head — which only depends on the two team IDs and the platform
  // match list, not the live innings — is memoised to avoid recomputing on
  // every ball. Hooks must run unconditionally before the early returns below.
  const h2h = useMemo(
    () =>
      match
        ? computeHeadToHead(match.teamA.id, match.teamB.id, allMatches.data ?? [])
        : null,
    [match?.teamA.id, match?.teamB.id, allMatches.data],
  )
  const stars = useMemo(() => (match ? matchTopPerformers(match) : null), [match])

  useDocumentMeta(
    match ? `${match.teamA.name} vs ${match.teamB.name}` : 'Match',
    match
      ? (match.result?.summary ?? `${match.format} · ${match.oversPerInnings} overs${match.venue ? ` at ${match.venue}` : ''}`)
      : undefined,
  )

  if (loading || players.loading) return <PageLoader />
  if (!match || !h2h || !stars)
    return (
      <div className="mx-auto max-w-md py-20 text-center text-ink-500 dark:text-ink-400">
        Match not found.
      </div>
    )

  const live = match.status === 'live' || match.status === 'innings_break'
  const admin = canScore(profile)

  async function saveConfig(cfg: ScorecardConfig) {
    await updateMatch(match!.id, { scorecardConfig: cfg, isPublic: match!.isPublic })
    setCfgOpen(false)
    toast.success('Scorecard updated')
  }

  async function choosePotm(pid: string) {
    await setPlayerOfTheMatch(match!.id, pid)
    setPotmOpen(false)
    toast.success('Player of the match set')
  }

  const allSquad = [...match.squadA, ...match.squadB]
  const hasScorecard = match.innings.length > 0
  const teamShortById = (tid: string) =>
    tid === match.teamA.id ? match.teamA.shortName : match.teamB.shortName

  function exportCSV() {
    downloadBlob(
      `${exportSlug(match!)}.csv`,
      matchToCSV(match!, players.data ?? []),
      'text/csv;charset=utf-8',
    )
  }
  function exportJSON() {
    downloadBlob(
      `${exportSlug(match!)}.json`,
      matchToJSON(match!, deliveries),
      'application/json',
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <Card className="mb-4 overflow-hidden">
        <div className="bg-ink-900 px-5 py-4 text-white">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {live ? (
                <LiveBadge />
              ) : match.status === 'completed' ? (
                <Badge tone="gray">Completed</Badge>
              ) : match.status === 'abandoned' ? (
                <Badge tone="red">Abandoned</Badge>
              ) : (
                <Badge tone="amber">Upcoming</Badge>
              )}
              {match.tournamentName && (
                <Link
                  to={match.tournamentId ? `/tournament/${match.tournamentId}` : '#'}
                  className="text-xs text-ink-300 hover:text-white"
                >
                  {match.tournamentName}
                </Link>
              )}
            </div>
            <ShareButton variant="icon" title={`${match.teamA.name} vs ${match.teamB.name}`} />
            <QRCodeButton title={`${match.teamA.name} vs ${match.teamB.name}`} />
            <PremiumGate feature="embeddable_widgets" fallback={null}>
              <EmbedButton matchId={match.id} />
            </PremiumGate>
            <PremiumGate feature="fixtures_calendar" fallback={null}>
              <AddToCalendarButton match={match} />
            </PremiumGate>
          </div>
          <h1 className="text-xl font-bold">
            {match.teamA.name} vs {match.teamB.name}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-300">
            {match.venue && (
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {match.venue}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar size={13} /> {formatDate(match.scheduledAt ?? match.createdAt)}
            </span>
            <span>
              {match.format} · {match.oversPerInnings} ov
            </span>
          </div>
          {match.toss && (
            <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
              Toss:{' '}
              {match.toss.wonByTeamId === match.teamA.id
                ? match.teamA.name
                : match.teamB.name}{' '}
              chose to {match.toss.decision}
            </p>
          )}
        </div>

        {match.result && (
          <div className="bg-pitch-50 px-5 py-2.5 text-center font-semibold text-pitch-700">
            {match.result.summary}
          </div>
        )}

        {match.linkedMatchId && (
          <div className="border-t border-ink-100 dark:border-ink-800 px-5 py-2.5 text-center text-sm">
            <Link
              to={`/match/${match.linkedMatchId}`}
              className="font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              View linked Super Over match
            </Link>
          </div>
        )}

        {/* Admin/scorer actions */}
        {admin && (
          <div className="flex flex-wrap gap-2 border-t border-ink-100 dark:border-ink-800 px-5 py-3">
            {live && (
              <Link
                to={`/scoring/${match.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Radio size={15} /> Score live
              </Link>
            )}
            {match.status === 'setup' && (
              <>
                <Link
                  to={`/scoring/${match.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-pitch-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-pitch-700"
                >
                  Start scoring
                </Link>
                <Link
                  to={`/matches/new?edit=${match.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <Pencil size={15} /> Edit setup
                </Link>
              </>
            )}
            {isAdmin(profile) && (
              <button
                onClick={() => setCfgOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <Settings2 size={15} /> Customize scorecard
              </button>
            )}
            {match.status === 'completed' && (
              <button
                onClick={() => setPotmOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <Award size={15} /> Player of the match
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Jump to a section further down the page — only sections that will
          actually render for this match get a link. */}
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {deliveries.length > 0 && (
          <SectionJumpLink targetId="match-insights" icon={<BarChart3 size={14} />}>
            Insights
          </SectionJumpLink>
        )}
        {hasScorecard && (
          <SectionJumpLink targetId="match-scorecard" icon={<ClipboardList size={14} />}>
            Scorecard
          </SectionJumpLink>
        )}
        <SectionJumpLink targetId="match-gallery" icon={<Images size={14} />}>
          Photos
        </SectionJumpLink>
        <SectionJumpLink targetId="match-comments" icon={<MessageSquare size={14} />}>
          Comments
        </SectionJumpLink>
      </div>

      {/* Head-to-head */}
      {h2h.played > 0 && (
        <Card className="mb-4 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Head to head · {h2h.played} meeting{h2h.played === 1 ? '' : 's'}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 text-center">
              <div className="truncate text-sm font-medium text-ink-700 dark:text-ink-300">
                {match.teamA.shortName}
              </div>
              <div className="text-2xl font-extrabold text-ink-900 dark:text-ink-50">
                {h2h.aWins}
              </div>
            </div>
            <div className="text-center text-xs text-ink-400 dark:text-ink-500">
              <div>won</div>
              {(h2h.tied > 0 || h2h.noResult > 0) && (
                <div className="mt-0.5">
                  {h2h.tied > 0 && `${h2h.tied} tie`}
                  {h2h.tied > 0 && h2h.noResult > 0 && ' · '}
                  {h2h.noResult > 0 && `${h2h.noResult} NR`}
                </div>
              )}
            </div>
            <div className="flex-1 text-center">
              <div className="truncate text-sm font-medium text-ink-700 dark:text-ink-300">
                {match.teamB.shortName}
              </div>
              <div className="text-2xl font-extrabold text-ink-900 dark:text-ink-50">
                {h2h.bWins}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Live mini panel */}
      {live && match.innings[match.currentInnings] && (
        <LivePanel match={match} name={name} />
      )}

      {match.playerOfTheMatchId && (
        <Card className="mb-4 flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Award size={20} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
              Player of the match
            </div>
            <Link
              to={`/player/${match.playerOfTheMatchId}`}
              className="font-semibold text-ink-900 dark:text-ink-50 hover:text-brand-700"
            >
              {name(match.playerOfTheMatchId)}
            </Link>
          </div>
        </Card>
      )}

      {/* Star performers */}
      {hasScorecard && (stars.batter || stars.bowler) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {stars.batter && (
            <Link
              to={`/player/${stars.batter.playerId}`}
              className="flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-pitch-100 text-pitch-700">
                <TrendingUp size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  Top batter
                </div>
                <div className="truncate font-semibold text-ink-900 dark:text-ink-50">
                  {name(stars.batter.playerId)}
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400">
                  {stars.batter.runs}
                  {stars.batter.out ? '' : '*'} ({stars.batter.balls}) ·{' '}
                  {teamShortById(stars.batter.teamId)}
                </div>
              </div>
            </Link>
          )}
          {stars.bowler && (
            <Link
              to={`/player/${stars.bowler.playerId}`}
              className="flex items-center gap-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <Target size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  Top bowler
                </div>
                <div className="truncate font-semibold text-ink-900 dark:text-ink-50">
                  {name(stars.bowler.playerId)}
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400">
                  {stars.bowler.wickets}/{stars.bowler.runs} ·{' '}
                  {teamShortById(stars.bowler.teamId)}
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Analytics graphs */}
      {deliveries.length > 0 && (
        <div id="match-insights" className="mb-4 scroll-mt-4">
          <PremiumGate feature="performance_charts">
            <MatchGraphs match={match} deliveries={deliveries} />
          </PremiumGate>
        </div>
      )}

      {/* Match insights */}
      {deliveries.length > 0 && (
        <div className="mb-4">
          <MatchInsights match={match} deliveries={deliveries} name={name} />
        </div>
      )}

      {/* Wagon wheel / bowling map — only when the scorer chose to tag shots
          during scoring; this data isn't captured automatically. */}
      {(ballMeta.data?.length ?? 0) > 0 && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          {hasWagonWheelData(ballMeta.data!) && (
            <WagonWheel zones={wagonWheelData(deliveries, ballMeta.data!)} />
          )}
          {hasPitchMapData(ballMeta.data!) && (
            <PremiumGate feature="pitch_map">
              <PitchMap cells={pitchMapData(deliveries, ballMeta.data!)} />
            </PremiumGate>
          )}
        </div>
      )}

      <div className="mb-3">
        <MatchReactions matchId={match.id} />
      </div>

      {/* Export toolbar */}
      {hasScorecard && (
        <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Export
          </span>
          <PremiumGate feature="data_export" fallback={null}>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              <Download size={15} /> CSV
            </button>
            <button
              onClick={exportJSON}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              <FileJson size={15} /> JSON
            </button>
          </PremiumGate>
          <button
            onClick={() => window.print()}
            title="Opens the browser print dialog — choose &quot;Save as PDF&quot; as the destination for a PDF file"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>
      )}

      <div id="match-media" className="mb-4 scroll-mt-4">
        <MatchMediaSection
          matchId={match.id}
          matchStatus={match.status}
          canManage={admin}
          deliveries={deliveries}
          ballMeta={ballMeta.data ?? []}
          match={match}
          playerName={name}
        />
      </div>

      {/* Scorecard */}
      <div id="match-scorecard" className="scroll-mt-4">
        <ScorecardView
          match={match}
          players={players.data ?? []}
          deliveries={deliveries}
        />
      </div>

      <div id="match-gallery" className="mt-4 scroll-mt-4">
        <PremiumGate feature="match_photo_galleries" ownerId={match.ownerId}>
          <MatchGallery matchId={match.id} canManage={admin} />
        </PremiumGate>
      </div>

      <div id="match-comments" className="mt-4 scroll-mt-4">
        <CommentSection matchId={match.id} />
      </div>

      {cfgOpen && (
        <ScorecardConfigModal
          config={match.scorecardConfig}
          onClose={() => setCfgOpen(false)}
          onSave={saveConfig}
        />
      )}

      {potmOpen && (
        <Modal open onClose={() => setPotmOpen(false)} title="Player of the match" size="sm">
          <div className="space-y-1">
            {allSquad.map((pid) => (
              <button
                key={pid}
                onClick={() => choosePotm(pid)}
                className="flex w-full items-center justify-between rounded-lg border border-ink-200 dark:border-ink-800 px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50"
              >
                {name(pid)}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

/** A small "jump to section" pill — scrolls an in-page anchor into view rather
 *  than navigating, so every section stays reachable by scrolling exactly as
 *  before; this is purely an optional shortcut on top of that. */
function SectionJumpLink({
  targetId,
  icon,
  children,
}: {
  targetId: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      onClick={() =>
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
    >
      {icon} {children}
    </button>
  )
}

function LivePanel({
  match,
  name,
}: {
  match: Match
  name: (id?: string | null) => string
}) {
  const inn = match.innings[match.currentInnings]
  const crr = runRate(inn.totalRuns, inn.legalBalls, match.ballsPerOver)
  const battingShort =
    inn.battingTeamId === match.teamA.id
      ? match.teamA.shortName
      : match.teamB.shortName
  const chasing = inn.target != null
  const ballsLeft = match.oversPerInnings * match.ballsPerOver - inn.legalBalls
  const need = inn.target != null ? Math.max(0, inn.target - inn.totalRuns) : 0
  const rrr = chasing ? requiredRate(need, ballsLeft, match.ballsPerOver) : 0
  const battingSquadSize =
    inn.battingTeamId === match.teamA.id ? match.squadA.length : match.squadB.length
  const wicketsRemaining = Math.max(0, (battingSquadSize || 11) - 1 - inn.wickets)
  // Expected Score — only meaningful for a first innings with no target yet;
  // a chase compares crr against the required rate instead.
  const projected = !chasing
    ? projectFirstInningsScore({
        currentRuns: inn.totalRuns,
        ballsBowled: inn.legalBalls,
        ballsRemaining: ballsLeft,
        wicketsRemaining,
        ballsPerOver: match.ballsPerOver,
      })
    : 0
  const winProbability = chasing
    ? chaseWinProbability({
        runsNeeded: need,
        ballsRemaining: ballsLeft,
        wicketsRemaining,
        ballsPerOver: match.ballsPerOver,
      })
    : null

  const striker = inn.battingCard.find((b) => b.playerId === inn.strikerId)
  const nonStriker = inn.battingCard.find((b) => b.playerId === inn.nonStrikerId)
  const bowler = inn.bowlingCard.find((b) => b.playerId === inn.bowlerId)

  return (
    <Card className="mb-4 p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-extrabold text-ink-900 dark:text-ink-50">
            {battingShort} {inn.totalRuns}/{inn.wickets}
          </div>
          <div className="text-sm text-ink-500 dark:text-ink-400">
            {ballsToOvers(inn.legalBalls, match.ballsPerOver)} ov · CRR{' '}
            {formatRate(crr)}
          </div>
          {!chasing && ballsLeft > 0 && inn.legalBalls > 0 && (
            <div className="text-xs text-ink-400 dark:text-ink-500">
              Expected score: {projected}
            </div>
          )}
        </div>
        {chasing && (
          <div className="text-right text-sm">
            <div className="font-semibold text-brand-700">
              Need {need} in {ballsLeft}
            </div>
            <div className="text-ink-500 dark:text-ink-400">
              Target {inn.target} · RRR {formatRate(rrr)}
            </div>
            {ballsLeft > 0 && (
              <div
                className={`text-xs font-medium ${
                  crr >= rrr ? 'text-pitch-600' : 'text-red-600'
                }`}
              >
                {crr >= rrr ? 'Ahead' : 'Behind'} by {formatRate(Math.abs(crr - rrr))}{' '}
                run{Math.abs(crr - rrr) === 1 ? '' : 's'}/ov
              </div>
            )}
          </div>
        )}
      </div>

      {chasing && winProbability != null && ballsLeft > 0 && match.status !== 'completed' && (
        <div className="mt-3 border-t border-ink-100 dark:border-ink-800 pt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
            <span>{battingShort} win probability (heuristic estimate)</span>
            <span className="font-semibold text-ink-700 dark:text-ink-300">{winProbability}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-pitch-500 transition-all"
              style={{ width: `${winProbability}%` }}
            />
          </div>
        </div>
      )}

      {match.status === 'innings_break' ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Innings break — 2nd innings about to begin.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-100 dark:border-ink-800 pt-3 text-sm">
          <div>
            <div className="text-ink-700 dark:text-ink-300">
              {name(inn.strikerId)}
              <span className="text-pitch-600">*</span>{' '}
              <b>
                {striker?.runs ?? 0} ({striker?.balls ?? 0})
              </b>
            </div>
            <div className="text-ink-600 dark:text-ink-400">
              {name(inn.nonStrikerId)}{' '}
              <b>
                {nonStriker?.runs ?? 0} ({nonStriker?.balls ?? 0})
              </b>
            </div>
          </div>
          <div className="border-l border-ink-100 dark:border-ink-800 pl-3">
            <div className="text-xs uppercase tracking-wide text-ink-400 dark:text-ink-500">
              Bowler
            </div>
            <div className="text-ink-700 dark:text-ink-300">
              {name(inn.bowlerId)}{' '}
              {bowler && (
                <b>
                  {bowler.wickets}-{bowler.runsConceded} (
                  {ballsToOvers(bowler.legalBalls, match.ballsPerOver)})
                </b>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-xs text-ink-400 dark:text-ink-500">Recent</span>
        {inn.recentBalls.map((b, i) => (
          <span
            key={i}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
              b.kind === 'wicket'
                ? 'bg-red-600 text-white'
                : b.kind === 'boundary'
                  ? 'bg-pitch-600 text-white'
                  : b.kind === 'extra'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300'
            }`}
          >
            {b.token}
          </span>
        ))}
      </div>
    </Card>
  )
}
