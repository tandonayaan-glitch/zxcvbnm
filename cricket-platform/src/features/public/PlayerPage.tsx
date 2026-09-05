import { useParams, Link } from 'react-router-dom'
import { User, Flag, Star, Award, Target, TrendingUp, Download, FileJson, Printer } from 'lucide-react'
import { Avatar, Badge, Card, PageLoader, EmptyState } from '@/components/ui/primitives'
import { FollowButton } from '@/components/ui/FollowButton'
import { FollowToggle } from '@/components/ui/FollowToggle'
import { RatingWidget } from '@/components/reputation/RatingWidget'
import { ShareButton } from '@/components/ui/ShareButton'
import { QRCodeButton } from '@/components/ui/QRCodeButton'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { Tabs } from '@/components/ui/Tabs'
import { useMemo, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { getPlayer, getPlayersByIds } from '@/services/players.service'
import { getTeamsByIds } from '@/services/teams.service'
import { getPlayerStats, getPlayerPerformances } from '@/services/stats.service'
import { listAllMatches } from '@/services/matches.service'
import { listTournaments } from '@/services/tournaments.service'
import { listSeasons } from '@/services/seasons.service'
import { getDeliveries } from '@/services/scoring.service'
import { listBallMeta } from '@/services/ballMeta.service'
import { computeAchievements, computeAwards } from '@/domain/achievements'
import { playerTournamentSplits, playerSeasonSplits } from '@/domain/playerSplits'
import { playerTimeline } from '@/domain/playerTimeline'
import { aggregatePlayerStats } from '@/domain/stats'
import { batterVsBowlerBreakdown } from '@/domain/batterVsBowler'
import { batterVsPaceSpin, bowlerVsBattingHand } from '@/domain/styleMatchups'
import {
  computeFormTrend,
  playerConsistency,
  careerPhasePerformance,
  strongestAndWeakestPhase,
} from '@/domain/careerIntelligence'
import { careerPerformanceScore } from '@/domain/performanceScore'
import { identifyDevelopmentAreas, suggestDrills } from '@/domain/playerDevelopment'
import { wagonWheelData } from '@/domain/wagonWheel'
import { pitchMapData } from '@/domain/pitchMap'
import { playerToCSV, playerToJSON } from '@/domain/playerExport'
import { downloadBlob, slugify } from '@/lib/download'
import { AchievementsPanel } from '@/components/stats/AchievementsPanel'
import { PlayerForm } from '@/components/charts/PlayerForm'
import { PlayerRadar } from '@/components/charts/PlayerRadar'
import { WagonWheel } from '@/components/charts/WagonWheel'
import { PitchMap } from '@/components/charts/PitchMap'
import { playerRadarProfile } from '@/domain/radar'
import { PremiumGate } from '@/components/guards/PremiumGate'
import type { BallMeta, Delivery, Match } from '@/types'
import {
  battingAverage,
  strikeRate,
  economy,
  bowlingAverage,
  bowlingStrikeRate,
  formatBestBowling,
  ballsToOvers,
  PLAYER_ROLE_LABELS,
  BOWLING_STYLE_LABELS,
  formatDate,
} from '@/lib/format'

export function PlayerPage() {
  const { id = '' } = useParams()
  const player = useAsync(() => getPlayer(id), [id])
  const stats = useAsync(() => getPlayerStats(id), [id])
  const perfs = useAsync(() => getPlayerPerformances(id), [id])
  const matches = useAsync(listAllMatches, [])
  const tournaments = useAsync(listTournaments, [])
  const seasons = useAsync(listSeasons, [])
  const teams = useAsync(
    () => (player.data ? getTeamsByIds(player.data.teamIds) : Promise.resolve([])),
    [player.data],
  )
  const [tab, setTab] = useState('overview')
  // Lazy-loaded: fetching every delivery across every match this player
  // batted in is meaningfully more expensive than the other tabs' already-
  // aggregated data, so only fire it once the visitor actually opens the tab.
  const [vsBowlerOpened, setVsBowlerOpened] = useState(false)

  // These recompute over every completed match, so they're memoised on the
  // underlying data. Hooks must run unconditionally before the loading/
  // not-found early returns below (Rules of Hooks).
  const splits = useMemo(
    () => playerTournamentSplits(id, matches.data ?? []),
    [id, matches.data],
  )
  const seasonIdByTournamentId = useMemo(
    () => new Map((tournaments.data ?? []).map((t) => [t.id, t.seasonId ?? null])),
    [tournaments.data],
  )
  const seasonNameById = useMemo(
    () => new Map((seasons.data ?? []).map((s) => [s.id, s.name])),
    [seasons.data],
  )
  const seasonSplits = useMemo(
    () =>
      playerSeasonSplits(id, matches.data ?? [], seasonIdByTournamentId, seasonNameById),
    [id, matches.data, seasonIdByTournamentId, seasonNameById],
  )
  const hasSeasonData = seasonSplits.some((sp) => sp.seasonId)
  const timeline = useMemo(
    () => playerTimeline(id, matches.data ?? []),
    [id, matches.data],
  )
  // Global rankings — where this player sits among all ranked players.
  const rankings = useMemo(() => {
    const allStatsArr = [...aggregatePlayerStats(matches.data ?? []).values()]
    const rankIn = (key: 'runs' | 'wickets' | 'sixes') => {
      const sorted = allStatsArr
        .filter((st) => st[key] > 0)
        .sort((a, b) => b[key] - a[key])
      const idx = sorted.findIndex((st) => st.playerId === id)
      return idx >= 0 ? { rank: idx + 1, total: sorted.length } : null
    }
    return (
      [
        { label: 'Runs', ...rankIn('runs') },
        { label: 'Wickets', ...rankIn('wickets') },
        { label: 'Sixes', ...rankIn('sixes') },
      ] as { label: string; rank?: number; total?: number }[]
    ).filter((r) => r.rank)
  }, [id, matches.data])
  // Prefer the live tournament name; fall back to the name denormalised on
  // the match (covers legacy/seed matches that never stored one).
  const tournamentNameById = useMemo(
    () => new Map((tournaments.data ?? []).map((tn) => [tn.id, tn.name])),
    [tournaments.data],
  )
  const splitName = (sp: (typeof splits)[number]) =>
    (sp.tournamentId && tournamentNameById.get(sp.tournamentId)) ||
    sp.tournamentName

  // Where this player ranks by runs within each tournament they've played in
  // (per-scope, as opposed to the platform-wide `rankings` above).
  const splitRunsRank = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const sp of splits) {
      if (!sp.tournamentId) continue
      const tMatches = (matches.data ?? []).filter(
        (m) => m.tournamentId === sp.tournamentId,
      )
      const sorted = [...aggregatePlayerStats(tMatches).values()]
        .filter((st) => st.runs > 0)
        .sort((a, b) => b.runs - a.runs)
      const idx = sorted.findIndex((st) => st.playerId === id)
      map.set(sp.tournamentId, idx >= 0 ? idx + 1 : null)
    }
    return map
  }, [splits, matches.data, id])

  const vsBowlerDeliveries = useAsync(async () => {
    if (!vsBowlerOpened) return []
    // Both batted and bowled matches — the batted half feeds vs-bowler/pace-vs-spin below,
    // the bowled half feeds this player's own vs-batting-hand split just after it. One fetch
    // covers both rather than gating a second heavy delivery load behind its own flag.
    const relevantMatchIds = [
      ...new Set(
        (perfs.data ?? [])
          .filter((p) => p.batting || p.bowling)
          .map((p) => p.matchId),
      ),
    ]
    const lists = await Promise.all(relevantMatchIds.map((mid) => getDeliveries(mid)))
    return lists.flat()
  }, [vsBowlerOpened, perfs.data])
  const vsBowlerRows = useMemo(
    () => batterVsBowlerBreakdown(vsBowlerDeliveries.data ?? [], id),
    [vsBowlerDeliveries.data, id],
  )
  const vsBowlerNames = useAsync(
    () => getPlayersByIds(vsBowlerRows.map((r) => r.bowlerId)),
    [vsBowlerRows],
  )
  const vsBowlerNameById = useMemo(
    () => new Map((vsBowlerNames.data ?? []).map((pl) => [pl.id, pl.fullName])),
    [vsBowlerNames.data],
  )
  // Pace vs spin: join each faced delivery to the bowler's declared style. Reuses the
  // already-loaded deliveries + bowler docs from the vs-Bowler view, so no extra fetch.
  const paceSpinSplit = useMemo(() => {
    const styleById = new Map(
      (vsBowlerNames.data ?? []).map((pl) => [pl.id, pl.bowlingStyle as string | undefined]),
    )
    return batterVsPaceSpin(vsBowlerDeliveries.data ?? [], styleById, id)
  }, [vsBowlerDeliveries.data, vsBowlerNames.data, id])

  // This player's own bowling, split by the striker's batting hand — deliveries where THIS
  // player is the bowler, from the same combined fetch above. Needs the batting hand of every
  // striker faced, which vsBowlerNames (bowler docs) doesn't cover, so a second small lookup.
  const bowledDeliveries = useMemo(
    () => (vsBowlerDeliveries.data ?? []).filter((d) => d.bowlerId === id),
    [vsBowlerDeliveries.data, id],
  )
  const facedBatterIds = useMemo(
    () => [...new Set(bowledDeliveries.map((d) => d.strikerId))],
    [bowledDeliveries],
  )
  const facedBatters = useAsync(() => getPlayersByIds(facedBatterIds), [facedBatterIds])
  const bowlerHandSplit = useMemo(() => {
    const handById = new Map(
      (facedBatters.data ?? []).map((pl) => [pl.id, pl.battingStyle as string | undefined]),
    )
    return bowlerVsBattingHand(bowledDeliveries, handById, id)
  }, [bowledDeliveries, facedBatters.data, id])

  // Career wagon wheel / bowling heat map — same lazy-load-on-tab-open reasoning
  // as vsBowler above, but heavier still (deliveries *and* ballMeta per match),
  // so gated behind its own "opened" flag rather than piggy-backing on
  // vsBowlerOpened. wagonWheelData/pitchMapData already filter internally by
  // player id, so one combined fetch across every match this player featured
  // in (batted or bowled) feeds both charts.
  const [analysisOpened, setAnalysisOpened] = useState(false)
  const analysisData = useAsync(async () => {
    if (!analysisOpened)
      return { deliveries: [] as Delivery[], ballMeta: [] as BallMeta[], byMatch: [] as { matchId: string; deliveries: Delivery[] }[] }
    const matchIds = [...new Set((perfs.data ?? []).map((p) => p.matchId))]
    const pairs = await Promise.all(
      matchIds.map(async (mid) => ({
        matchId: mid,
        deliveries: await getDeliveries(mid),
        ballMeta: await listBallMeta(mid),
      })),
    )
    return {
      deliveries: pairs.flatMap((p) => p.deliveries),
      ballMeta: pairs.flatMap((p) => p.ballMeta),
      byMatch: pairs.map((p) => ({ matchId: p.matchId, deliveries: p.deliveries })),
    }
  }, [analysisOpened, perfs.data])
  // Career Intelligence: reuses the exact same lazy delivery fetch above (no second heavy
  // fetch) but keeps each match's own deliveries paired with its own Match doc, since phase
  // boundaries (powerplay/death-over counts) depend on that match's own format/overs — lost
  // once deliveries from many matches are flattened into one array, which is why
  // careerPhasePerformance() needs the pairing rather than the flat `deliveries` above.
  const matchByIdMap = useMemo(() => new Map((matches.data ?? []).map((m) => [m.id, m])), [matches.data])
  const matchDeliveryPairs = useMemo(
    () =>
      (analysisData.data?.byMatch ?? [])
        .map((p) => ({ match: matchByIdMap.get(p.matchId), deliveries: p.deliveries }))
        .filter((p): p is { match: Match; deliveries: Delivery[] } => !!p.match),
    [analysisData.data, matchByIdMap],
  )
  const phaseLines = useMemo(() => careerPhasePerformance(matchDeliveryPairs, id), [matchDeliveryPairs, id])
  const phaseExtremes = useMemo(() => strongestAndWeakestPhase(phaseLines), [phaseLines])
  const formTrend = useMemo(() => computeFormTrend(perfs.data ?? []), [perfs.data])
  const consistencyRow = useMemo(() => playerConsistency(matches.data ?? [], id), [matches.data, id])
  const careerScore = useMemo(
    () => (stats.data ? careerPerformanceScore(stats.data) : null),
    [stats.data],
  )
  const developmentAreas = useMemo(
    () => identifyDevelopmentAreas({ phaseLines, paceSpin: paceSpinSplit, consistency: consistencyRow, formTrend }),
    [phaseLines, paceSpinSplit, consistencyRow, formTrend],
  )
  const drillSuggestions = useMemo(() => suggestDrills(developmentAreas), [developmentAreas])
  const wagonZones = useMemo(
    () => wagonWheelData(analysisData.data?.deliveries ?? [], analysisData.data?.ballMeta ?? [], id),
    [analysisData.data, id],
  )
  const pitchCells = useMemo(
    () => pitchMapData(analysisData.data?.deliveries ?? [], analysisData.data?.ballMeta ?? [], id),
    [analysisData.data, id],
  )
  const hasWagonData = wagonZones.some((z) => z.balls > 0)
  const hasPitchData = pitchCells.some((c) => c.balls > 0)

  useDocumentMeta(
    player.data?.fullName ?? 'Player',
    player.data
      ? `${player.data.fullName} — batting and bowling stats, career timeline on CricketHub.`
      : undefined,
  )

  if (player.loading) return <PageLoader />
  if (!player.data)
    return (
      <div className="mx-auto max-w-md py-20">
        <EmptyState icon={<User size={40} />} title="Player not found" />
      </div>
    )

  const p = player.data
  const s = stats.data
  const dismissals = s ? s.inningsBatted - s.notOuts : 0

  // Resolve the live tournament name for export too (matches the on-page
  // "By tournament" tab, which uses splitName for the same reason).
  const exportSplits = splits.map((sp) => ({ ...sp, tournamentName: splitName(sp) }))

  function exportCSV() {
    downloadBlob(
      `${slugify(p.fullName)}-${p.id}.csv`,
      playerToCSV({
        player: p,
        stats: s ?? null,
        splits: exportSplits,
        performances: perfs.data ?? [],
      }),
      'text/csv;charset=utf-8',
    )
  }
  function exportJSON() {
    downloadBlob(
      `${slugify(p.fullName)}-${p.id}.json`,
      playerToJSON({
        player: p,
        stats: s ?? null,
        splits: exportSplits,
        performances: perfs.data ?? [],
      }),
      'application/json',
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Card className="mb-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={p.fullName} src={p.photoURL} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">{p.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="blue">{PLAYER_ROLE_LABELS[p.role]}</Badge>
              <span className="text-sm text-ink-500 dark:text-ink-400">
                {p.battingStyle === 'right_hand' ? 'RHB' : 'LHB'}
                {p.bowlingStyle !== 'none' &&
                  ` · ${BOWLING_STYLE_LABELS[p.bowlingStyle]}`}
              </span>
            </div>
            {(teams.data ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(teams.data ?? []).map((t) => (
                  <Link
                    key={t.id}
                    to={`/team/${t.id}`}
                    className="text-sm font-medium text-brand-700 hover:underline"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <ShareButton variant="icon" title={p.fullName} />
              <QRCodeButton title={p.fullName} />
              <FollowButton kind="players" id={p.id} />
              <FollowToggle targetType="player" targetId={p.id} />
            </div>
            <RatingWidget targetType="player" targetId={p.id} linkedUserId={p.linkedUserId} />
            <Link
              to={`/compare?a=${p.id}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Compare
            </Link>
            <div className="flex gap-1.5">
              <PremiumGate
                feature="data_export"
                fallback={null}
              >
                <button
                  onClick={exportCSV}
                  title="Export CSV"
                  className="inline-flex items-center gap-1 rounded-lg border border-ink-300 dark:border-ink-700 px-2 py-1 text-xs font-medium text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <Download size={13} /> CSV
                </button>
                <button
                  onClick={exportJSON}
                  title="Export JSON"
                  className="inline-flex items-center gap-1 rounded-lg border border-ink-300 dark:border-ink-700 px-2 py-1 text-xs font-medium text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <FileJson size={13} /> JSON
                </button>
              </PremiumGate>
              <button
                onClick={() => window.print()}
                title="Print / Save as PDF"
                className="inline-flex items-center gap-1 rounded-lg border border-ink-300 dark:border-ink-700 px-2 py-1 text-xs font-medium text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <Printer size={13} /> PDF
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        className="mb-4"
        active={tab}
        onChange={(k) => {
          setTab(k)
          if (k === 'vsbowler') setVsBowlerOpened(true)
          if (k === 'analysis' || k === 'career') setAnalysisOpened(true)
        }}
        tabs={[
          { key: 'overview', label: 'Overview' },
          ...((perfs.data ?? []).length > 0
            ? [{ key: 'career', label: 'Career Intelligence' }]
            : []),
          ...(splits.length > 0
            ? [{ key: 'tournaments', label: 'By tournament' }]
            : []),
          ...(hasSeasonData ? [{ key: 'seasons', label: 'By season' }] : []),
          ...(timeline.length > 0
            ? [{ key: 'timeline', label: 'Timeline' }]
            : []),
          { key: 'achievements', label: 'Achievements' },
          ...((perfs.data ?? []).some((p) => p.batting || p.bowling)
            ? [{ key: 'vsbowler', label: 'Matchups' }]
            : []),
          ...((perfs.data ?? []).length > 0
            ? [{ key: 'analysis', label: 'Shot & Line Analysis' }]
            : []),
          { key: 'matches', label: 'Match log' },
          { key: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'career' && (
        <div className="space-y-4">
          {careerScore && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
                Performance Score
              </h3>
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                A documented, reproducible score — batting + bowling + fielding contributions,
                weighted the same way across every player on this platform. Not a fitted model.
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold text-ink-900 dark:text-ink-50">{careerScore.total}</div>
                  <div className="text-[11px] text-ink-500">Total</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-ink-800 dark:text-ink-200">{careerScore.battingScore}</div>
                  <div className="text-[11px] text-ink-500">Batting</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-ink-800 dark:text-ink-200">{careerScore.bowlingScore}</div>
                  <div className="text-[11px] text-ink-500">Bowling</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-ink-800 dark:text-ink-200">{careerScore.fieldingScore}</div>
                  <div className="text-[11px] text-ink-500">Fielding</div>
                </div>
              </div>
              {careerScore.factors.length > 0 && (
                <ul className="mt-3 list-inside list-disc text-xs text-ink-600 dark:text-ink-400">
                  {careerScore.factors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {formTrend && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">Form trend</h3>
              <p className="text-sm text-ink-700 dark:text-ink-300">
                Last {formTrend.recentInnings} innings averaging {formTrend.recentAverage}, vs{' '}
                {formTrend.priorAverage} in the {formTrend.priorInnings} before that —{' '}
                <span
                  className={
                    formTrend.direction === 'improving'
                      ? 'font-semibold text-green-600'
                      : formTrend.direction === 'regressing'
                        ? 'font-semibold text-red-600'
                        : 'font-semibold text-ink-500'
                  }
                >
                  {formTrend.direction}
                </span>
                .
              </p>
            </Card>
          )}

          {consistencyRow && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">Consistency</h3>
              <p className="text-sm text-ink-700 dark:text-ink-300">
                {consistencyRow.variation.toFixed(0)}% variation in runs per innings across{' '}
                {consistencyRow.innings} innings (average {consistencyRow.average.toFixed(1)}) — lower
                means more consistent.
              </p>
            </Card>
          )}

          {analysisOpened && analysisData.loading ? (
            <PageLoader label="Loading phase data across every match…" />
          ) : (
            phaseLines.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
                  Batting by phase (career)
                </h3>
                <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                  Across every completed match this player has batted in, using each match's own
                  powerplay/death-over boundaries.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {phaseLines.map((l) => (
                    <div key={l.phase} className="rounded-lg border border-ink-100 p-2 text-center dark:border-ink-800">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                        {l.phase}
                      </div>
                      <div className="text-sm font-bold text-ink-900 dark:text-ink-50">
                        {l.runs} <span className="font-normal text-ink-500">({l.balls})</span>
                      </div>
                      <div className="text-[11px] text-ink-500">SR {l.strikeRate.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
                {(phaseExtremes.strongest || phaseExtremes.weakest) && (
                  <p className="mt-3 text-xs text-ink-600 dark:text-ink-400">
                    {phaseExtremes.strongest && (
                      <>Strongest: <span className="font-semibold capitalize">{phaseExtremes.strongest.phase}</span> (SR {phaseExtremes.strongest.strikeRate.toFixed(1)}). </>
                    )}
                    {phaseExtremes.weakest && (
                      <>Weakest: <span className="font-semibold capitalize">{phaseExtremes.weakest.phase}</span> (SR {phaseExtremes.weakest.strikeRate.toFixed(1)}).</>
                    )}
                  </p>
                )}
              </Card>
            )
          )}

          {developmentAreas.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
                Development — strengths &amp; weaknesses
              </h3>
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                Detected from real performance gaps (a strike-rate or consistency swing large
                enough to matter), not a subjective read.
              </p>
              <ul className="space-y-1.5 text-sm">
                {developmentAreas.map((a) => (
                  <li key={a.key} className="flex items-start gap-2">
                    <span
                      className={
                        a.kind === 'strength'
                          ? 'mt-0.5 h-2 w-2 shrink-0 rounded-full bg-green-500'
                          : 'mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500'
                      }
                    />
                    <span>
                      <span className="font-medium text-ink-900 dark:text-ink-50">{a.label}</span>{' '}
                      <span className="text-ink-500 dark:text-ink-400">— {a.evidence}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {drillSuggestions.length > 0 && (
                <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    General suggestions for these weakness types
                  </h4>
                  <p className="mb-2 text-[11px] text-ink-400">
                    Generic cricket-coaching suggestions matched to the weakness type above — not
                    personalized training advice (this platform has no training-log data).
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {drillSuggestions.map((d) => (
                      <li key={d.forAreaKey}>
                        <span className="font-medium text-ink-900 dark:text-ink-50">{d.title}</span>
                        <span className="text-ink-500 dark:text-ink-400"> — {d.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {!careerScore && !formTrend && !consistencyRow && phaseLines.length === 0 && !analysisData.loading && (
            <EmptyState title="Not enough data yet" description="Play more completed matches to build career intelligence." />
          )}
        </div>
      )}

      {tab === 'achievements' &&
        (stats.loading ? (
          <PageLoader />
        ) : (
          <AchievementsPanel
            achievements={computeAchievements(
              s ?? {
                playerId: id,
                matches: 0,
                inningsBatted: 0,
                notOuts: 0,
                runs: 0,
                ballsFaced: 0,
                highScore: 0,
                highScoreNotOut: false,
                fours: 0,
                sixes: 0,
                thirties: 0,
                fifties: 0,
                hundreds: 0,
                inningsBowled: 0,
                ballsBowled: 0,
                runsConceded: 0,
                wickets: 0,
                maidens: 0,
                bestBowlingWkts: 0,
                bestBowlingRuns: 0,
                fiveWktHauls: 0,
                catches: 0,
                runOuts: 0,
                stumpings: 0,
                updatedAt: 0,
              },
            )}
            awards={computeAwards(id, matches.data ?? [])}
          />
        ))}

      {tab === 'vsbowler' &&
        (vsBowlerDeliveries.loading ? (
          <PageLoader />
        ) : vsBowlerRows.length === 0 && !bowlerHandSplit.hasData ? (
          <EmptyState
            title="No deliveries yet"
            description="This player hasn't faced or bowled a ball in a completed match yet."
          />
        ) : (
          <div className="space-y-4">
            {bowlerHandSplit.hasData && (
              <Card className="p-4">
                <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
                  Bowling vs right- and left-handers
                </h3>
                <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                  Split by the striker&rsquo;s declared batting hand, across every ball this
                  player has bowled in a completed match.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['Vs right-hand', bowlerHandSplit.vsRight],
                    ['Vs left-hand', bowlerHandSplit.vsLeft],
                  ] as const).map(([label, h]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-ink-100 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-800/50"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
                        {label}
                      </div>
                      <div className="mt-1 text-lg font-bold text-ink-900 dark:text-ink-50">
                        {h.wickets} <span className="text-sm font-medium text-ink-500">wkts</span>
                      </div>
                      <dl className="mt-1 space-y-0.5 text-xs text-ink-600 dark:text-ink-400">
                        <div className="flex justify-between"><dt>Balls</dt><dd>{h.balls}</dd></div>
                        <div className="flex justify-between"><dt>Runs</dt><dd>{h.runsConceded}</dd></div>
                        <div className="flex justify-between"><dt>Economy</dt><dd>{h.economy.toFixed(2)}</dd></div>
                        <div className="flex justify-between"><dt>Strike rate</dt><dd>{h.strikeRate == null ? '—' : h.strikeRate.toFixed(1)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {paceSpinSplit.hasClassifiedData ? (
              <Card className="p-4">
                <h3 className="mb-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
                  Pace vs spin
                </h3>
                <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                  Split by each bowler&rsquo;s declared style across every ball faced in a completed
                  match. Deterministic — computed from ball-by-ball data, not an estimate.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['Vs pace', paceSpinSplit.pace],
                    ['Vs spin', paceSpinSplit.spin],
                  ] as const).map(([label, s]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-ink-100 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-800/50"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
                        {label}
                      </div>
                      <div className="mt-1 text-lg font-bold text-ink-900 dark:text-ink-50">
                        {s.runs} <span className="text-sm font-medium text-ink-500">runs</span>
                      </div>
                      <dl className="mt-1 space-y-0.5 text-xs text-ink-600 dark:text-ink-400">
                        <div className="flex justify-between"><dt>Balls</dt><dd>{s.balls}</dd></div>
                        <div className="flex justify-between"><dt>Strike rate</dt><dd>{s.strikeRate.toFixed(1)}</dd></div>
                        <div className="flex justify-between"><dt>Average</dt><dd>{s.average == null ? '—' : s.average.toFixed(1)}</dd></div>
                        <div className="flex justify-between"><dt>Dismissals</dt><dd>{s.dismissals}</dd></div>
                        <div className="flex justify-between"><dt>Boundary %</dt><dd>{s.boundaryPct.toFixed(1)}</dd></div>
                        <div className="flex justify-between"><dt>Dot %</dt><dd>{s.dotPct.toFixed(1)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
                {paceSpinSplit.unknown.balls > 0 && (
                  <p className="mt-2 text-[11px] text-ink-400 dark:text-ink-500">
                    {paceSpinSplit.unknown.balls} ball{paceSpinSplit.unknown.balls === 1 ? '' : 's'} faced
                    against a bowler with no declared style — excluded from the split above.
                  </p>
                )}
              </Card>
            ) : null}
            {vsBowlerRows.length > 0 && (
            <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <th className="px-4 py-2.5 font-semibold">Bowler</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Runs</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Balls</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Dis.</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Avg</th>
                  <th className="px-2 py-2.5 text-right font-semibold">SR</th>
                  <th className="px-2 py-2.5 text-right font-semibold">4s</th>
                  <th className="px-3 py-2.5 text-right font-semibold">6s</th>
                </tr>
              </thead>
              <tbody>
                {vsBowlerRows.map((r) => (
                  <tr key={r.bowlerId} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/player/${r.bowlerId}`}
                        className="font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                      >
                        {vsBowlerNameById.get(r.bowlerId) ?? '—'}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {r.runs}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.balls}</td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {r.dismissals}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {battingAverage(r.runs, r.dismissals)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {strikeRate(r.runs, r.balls)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.fours}</td>
                    <td className="px-3 py-2.5 text-right text-ink-600 dark:text-ink-400">{r.sixes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </Card>
            )}
          </div>
        ))}

      {tab === 'analysis' &&
        (analysisData.loading ? (
          <PageLoader />
        ) : !hasWagonData && !hasPitchData ? (
          <EmptyState
            title="No tagged deliveries yet"
            description="Shot placement and line/length data only exist for deliveries the scorer chose to tag while scoring — none of this player's matches have any yet."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {hasWagonData && <WagonWheel zones={wagonZones} />}
            {hasPitchData && (
              <PremiumGate feature="pitch_map">
                <PitchMap cells={pitchCells} />
              </PremiumGate>
            )}
          </div>
        ))}

      {tab === 'overview' &&
        (stats.loading ? (
          <PageLoader />
        ) : !s || s.matches === 0 ? (
          <EmptyState
            title="No stats yet"
            description="Stats will appear once this player features in completed matches."
          />
        ) : (
          <div className="space-y-4">
            {rankings.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rankings.map((r) => (
                  <Link
                    key={r.label}
                    to="/stats"
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-3 py-1.5 text-sm hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    <span className="font-bold text-brand-700">#{r.rank}</span>
                    <span className="text-ink-600 dark:text-ink-400">{r.label}</span>
                    <span className="text-xs text-ink-400 dark:text-ink-500">of {r.total}</span>
                  </Link>
                ))}
              </div>
            )}
            <PremiumGate feature="recent_form_charts">
              <PlayerForm performances={perfs.data ?? []} />
            </PremiumGate>
            <PremiumGate feature="player_radar">
              <PlayerRadar axes={playerRadarProfile(s)} />
            </PremiumGate>
            <div className="grid gap-4 sm:grid-cols-2">
            <StatBlock
              title="Batting"
              rows={[
                ['Matches', s.matches],
                ['Innings', s.inningsBatted],
                ['Not outs', s.notOuts],
                ['Runs', s.runs],
                ['Balls faced', s.ballsFaced],
                ['Highest', `${s.highScore}${s.highScoreNotOut ? '*' : ''}`],
                ['Average', battingAverage(s.runs, dismissals)],
                ['Strike rate', strikeRate(s.runs, s.ballsFaced)],
                ['Fours', s.fours],
                ['Sixes', s.sixes],
                ['50s / 100s', `${s.fifties} / ${s.hundreds}`],
              ]}
            />
            <StatBlock
              title="Bowling"
              rows={[
                ['Innings', s.inningsBowled],
                ['Overs', ballsToOvers(s.ballsBowled)],
                ['Runs', s.runsConceded],
                ['Wickets', s.wickets],
                ['Best', formatBestBowling(s.bestBowlingWkts, s.bestBowlingRuns)],
                ['Average', bowlingAverage(s.runsConceded, s.wickets)],
                ['Economy', economy(s.runsConceded, s.ballsBowled)],
                ['Strike rate', bowlingStrikeRate(s.ballsBowled, s.wickets)],
                ['Maidens', s.maidens],
                ['5-wkt hauls', s.fiveWktHauls],
              ]}
            />
            <StatBlock
              title="Fielding"
              rows={[
                ['Catches', s.catches],
                ['Run outs', s.runOuts],
                ['Stumpings', s.stumpings],
              ]}
            />
            </div>
          </div>
        ))}

      {tab === 'tournaments' && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                <th className="px-4 py-2.5 font-semibold">Tournament</th>
                <th className="px-2 py-2.5 text-right font-semibold">M</th>
                <th className="px-2 py-2.5 text-right font-semibold">Runs</th>
                <th className="px-2 py-2.5 text-right font-semibold">Rank</th>
                <th className="px-2 py-2.5 text-right font-semibold">HS</th>
                <th className="px-2 py-2.5 text-right font-semibold">Avg</th>
                <th className="px-2 py-2.5 text-right font-semibold">SR</th>
                <th className="px-2 py-2.5 text-right font-semibold">Wkts</th>
                <th className="px-2 py-2.5 text-right font-semibold">Best</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ct</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((sp) => {
                const st = sp.stats
                return (
                  <tr key={sp.tournamentId ?? '__none__'} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="px-4 py-2.5">
                      {sp.tournamentId ? (
                        <Link
                          to={`/tournament/${sp.tournamentId}`}
                          className="font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                        >
                          {splitName(sp)}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink-500 dark:text-ink-400">
                          {splitName(sp)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{st.matches}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {st.runs}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {sp.tournamentId && splitRunsRank.get(sp.tournamentId)
                        ? `#${splitRunsRank.get(sp.tournamentId)}`
                        : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {st.highScore}
                      {st.highScoreNotOut ? '*' : ''}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {battingAverage(st.runs, st.inningsBatted - st.notOuts)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {strikeRate(st.runs, st.ballsFaced)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {st.wickets}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {formatBestBowling(st.bestBowlingWkts, st.bestBowlingRuns)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-600 dark:text-ink-400">{st.catches}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'seasons' && (
        <PremiumGate feature="season_splits">
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                <th className="px-4 py-2.5 font-semibold">Season</th>
                <th className="px-2 py-2.5 text-right font-semibold">M</th>
                <th className="px-2 py-2.5 text-right font-semibold">Runs</th>
                <th className="px-2 py-2.5 text-right font-semibold">HS</th>
                <th className="px-2 py-2.5 text-right font-semibold">Avg</th>
                <th className="px-2 py-2.5 text-right font-semibold">SR</th>
                <th className="px-2 py-2.5 text-right font-semibold">Wkts</th>
                <th className="px-2 py-2.5 text-right font-semibold">Best</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ct</th>
              </tr>
            </thead>
            <tbody>
              {seasonSplits.map((sp) => {
                const st = sp.stats
                return (
                  <tr key={sp.seasonId ?? '__none__'} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          sp.seasonId
                            ? 'font-medium text-ink-900 dark:text-ink-50'
                            : 'font-medium text-ink-500 dark:text-ink-400'
                        }
                      >
                        {sp.seasonName}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">{st.matches}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {st.runs}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {st.highScore}
                      {st.highScoreNotOut ? '*' : ''}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {battingAverage(st.runs, st.inningsBatted - st.notOuts)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {strikeRate(st.runs, st.ballsFaced)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink-900 dark:text-ink-50">
                      {st.wickets}
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-600 dark:text-ink-400">
                      {formatBestBowling(st.bestBowlingWkts, st.bestBowlingRuns)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-600 dark:text-ink-400">{st.catches}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        </PremiumGate>
      )}

      {tab === 'timeline' && (
        <Card className="p-5">
          <ol className="relative ml-1 space-y-5 border-l-2 border-ink-100 dark:border-ink-800 pl-5">
            {timeline.map((e, i) => (
              <li key={`${e.matchId}-${e.title}-${i}`} className="relative">
                <span className="absolute -left-[30px] flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 ring-4 ring-white">
                  <TimelineIcon icon={e.icon} />
                </span>
                <Link to={`/match/${e.matchId}`} className="block hover:opacity-80">
                  <div className="font-semibold text-ink-900 dark:text-ink-50">{e.title}</div>
                  <div className="text-sm text-ink-600 dark:text-ink-400">{e.detail}</div>
                  <div className="text-xs text-ink-400 dark:text-ink-500">{formatDate(e.date)}</div>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {tab === 'matches' &&
        (perfs.loading ? (
          <PageLoader />
        ) : (perfs.data ?? []).length === 0 ? (
          <EmptyState title="No match performances yet" />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <th className="px-4 py-2.5 font-semibold">Match</th>
                  <th className="px-4 py-2.5 font-semibold">Batting</th>
                  <th className="px-4 py-2.5 font-semibold">Bowling</th>
                </tr>
              </thead>
              <tbody>
                {(perfs.data ?? []).map((perf) => (
                  <tr key={perf.matchId} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/match/${perf.matchId}`}
                        className="font-medium text-ink-900 dark:text-ink-50 hover:text-brand-700"
                      >
                        vs {perf.opponent}
                      </Link>
                      <div className="text-xs text-ink-400 dark:text-ink-500">
                        {formatDate(perf.date)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-700 dark:text-ink-300">
                      {perf.batting
                        ? `${perf.batting.runs}${
                            perf.batting.out ? '' : '*'
                          } (${perf.batting.balls})`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ink-700 dark:text-ink-300">
                      {perf.bowling
                        ? `${perf.bowling.wickets}/${perf.bowling.runs} (${perf.bowling.overs})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

      {tab === 'activity' && (
        <Card className="p-4">
          <ActivityFeed refId={id} max={15} />
        </Card>
      )}
    </div>
  )
}

function TimelineIcon({ icon }: { icon: string }) {
  const size = 14
  if (icon === 'debut') return <Flag size={size} />
  if (icon === 'hundred') return <Award size={size} />
  if (icon === 'fifty') return <Star size={size} />
  if (icon === 'fivefor') return <Target size={size} />
  return <TrendingUp size={size} />
}

function StatBlock({
  title,
  rows,
}: {
  title: string
  rows: [string, string | number][]
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 px-4 py-2.5 font-semibold text-ink-900 dark:text-ink-50">
        {title}
      </div>
      <div className="divide-y divide-ink-50">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-2 text-sm">
            <span className="text-ink-500 dark:text-ink-400">{label}</span>
            <span className="font-semibold text-ink-900 dark:text-ink-50">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
