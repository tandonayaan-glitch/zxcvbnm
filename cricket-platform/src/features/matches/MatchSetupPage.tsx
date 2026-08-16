import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  ListChecks,
  Settings2,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageLoader,
  Select,
} from '@/components/ui/primitives'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/toast'
import { listTeams } from '@/services/teams.service'
import { listPlayers } from '@/services/players.service'
import { listTournaments } from '@/services/tournaments.service'
import { listUsers } from '@/services/users.service'
import {
  createMatch,
  getMatch,
  updateMatch,
} from '@/services/matches.service'
import { snapshotVersion, changedKeys } from '@/services/versionHistory.service'
import { useAuthStore, ownerScope } from '@/store/authStore'
import { cn } from '@/lib/cn'
import { MATCH_FORMAT_LABELS, MATCH_FORMAT_OVERS } from '@/lib/format'
import { STAGE_ORDER, STAGE_LABELS, hasKnockoutPhase } from '@/domain/bracket'
import {
  computeAutoPowerplayOvers,
  defaultMaxWickets,
  DEFAULT_TEAM_SIZE,
} from '@/domain/matchRules'
import type {
  KnockoutStage,
  MatchFormat,
  MatchTeamRef,
  Player,
  Team,
  TossDecision,
} from '@/types'

interface FormState {
  title: string
  tournamentId: string
  stage: '' | KnockoutStage
  format: MatchFormat
  oversPerInnings: number
  ballsPerOver: number
  venue: string
  date: string
  time: string
  isPublic: boolean
  scorerId: string
  teamAId: string
  teamBId: string
  squadA: string[]
  squadB: string[]
  tossWinner: 'A' | 'B' | ''
  tossDecision: TossDecision
  teamSize: number
  maxWickets: number
  powerplayMode: 'auto' | 'manual'
  powerplayOvers: number
  lastManStanding: boolean
  retiredHurtEnabled: boolean
  superOverEnabled: boolean
}

const STEPS = [
  { label: 'Details', icon: <Settings2 size={16} /> },
  { label: 'Teams', icon: <Shield size={16} /> },
  { label: 'Playing XI', icon: <Users size={16} /> },
  { label: 'Toss', icon: <Coins size={16} /> },
  { label: 'Match Rules', icon: <SlidersHorizontal size={16} /> },
  { label: 'Review', icon: <ListChecks size={16} /> },
]

/**
 * Split a stored timestamp into the `YYYY-MM-DD` / `HH:mm` parts the date &
 * time inputs expect, using *local* getters. This must stay local because the
 * save path parses the form back with `new Date('YYYY-MM-DDTHH:mm')`, which JS
 * interprets as local time — formatting with `toISOString()` (UTC) here would
 * shift the time by the timezone offset on every edit.
 */
function localDateParts(ms: number): { date: string; time: string } {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

export function MatchSetupPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const duplicateId = params.get('duplicate')
  const profile = useAuthStore((s) => s.profile)

  const teams = useAsync(listTeams, [])
  const players = useAsync(listPlayers, [])
  const tournaments = useAsync(listTournaments, [])
  const users = useAsync(listUsers, [])

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)
  const [loadingDuplicate, setLoadingDuplicate] = useState(!!duplicateId)
  const [editReason, setEditReason] = useState('')
  const [form, setForm] = useState<FormState>({
    title: '',
    tournamentId: '',
    stage: '',
    format: 'T20',
    oversPerInnings: 20,
    ballsPerOver: 6,
    venue: '',
    date: '',
    time: '',
    isPublic: true,
    scorerId: '',
    teamAId: '',
    teamBId: '',
    squadA: [],
    squadB: [],
    tossWinner: '',
    tossDecision: 'bat',
    teamSize: DEFAULT_TEAM_SIZE,
    maxWickets: defaultMaxWickets(DEFAULT_TEAM_SIZE),
    powerplayMode: 'auto',
    powerplayOvers: computeAutoPowerplayOvers(20),
    lastManStanding: false,
    retiredHurtEnabled: true,
    superOverEnabled: false,
  })

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Load existing match when editing.
  useEffect(() => {
    if (!editId) return
    getMatch(editId).then((m) => {
      if (m) {
        setForm({
          title: m.title,
          tournamentId: m.tournamentId ?? '',
          stage: m.stage ?? '',
          format: m.format,
          oversPerInnings: m.oversPerInnings,
          ballsPerOver: m.ballsPerOver,
          venue: m.venue ?? '',
          date: m.scheduledAt ? localDateParts(m.scheduledAt).date : '',
          time: m.scheduledAt ? localDateParts(m.scheduledAt).time : '',
          isPublic: m.isPublic,
          scorerId: m.scorerId ?? '',
          teamAId: m.teamA.id,
          teamBId: m.teamB.id,
          squadA: m.squadA,
          squadB: m.squadB,
          tossWinner: m.toss
            ? m.toss.wonByTeamId === m.teamA.id
              ? 'A'
              : 'B'
            : '',
          tossDecision: m.toss?.decision ?? 'bat',
          teamSize: m.teamSize ?? DEFAULT_TEAM_SIZE,
          maxWickets: m.maxWickets ?? defaultMaxWickets(m.teamSize ?? DEFAULT_TEAM_SIZE),
          powerplayMode: m.powerplayMode ?? 'auto',
          powerplayOvers: m.powerplayOvers ?? computeAutoPowerplayOvers(m.oversPerInnings),
          lastManStanding: m.lastManStanding ?? false,
          retiredHurtEnabled: m.retiredHurtEnabled ?? true,
          superOverEnabled: m.superOverEnabled ?? false,
        })
      }
      setLoadingEdit(false)
    })
  }, [editId])

  // Load a source match to pre-fill a rematch. Deliberately excludes title (would
  // literally duplicate it), date/time (a rematch is a new fixture, not the same
  // timestamp), toss (a new match needs its own coin toss), and stage (a duplicated
  // "Final" would silently carry the knockout-stage tag onto an unrelated new match).
  useEffect(() => {
    if (!duplicateId) return
    getMatch(duplicateId).then((m) => {
      if (m) {
        setForm((f) => ({
          ...f,
          // Explicitly reset rather than relying on the form's initial blank state —
          // MatchSetupPage doesn't necessarily remount between modes (e.g. React Router
          // won't remount it going from ?edit= to ?duplicate= on the same route), so a
          // stale title/date/time/toss from a prior mode could otherwise leak through.
          title: '',
          date: '',
          time: '',
          tossWinner: '',
          tossDecision: 'bat',
          tournamentId: m.tournamentId ?? '',
          stage: '',
          format: m.format,
          oversPerInnings: m.oversPerInnings,
          ballsPerOver: m.ballsPerOver,
          venue: m.venue ?? '',
          isPublic: m.isPublic,
          scorerId: m.scorerId ?? '',
          teamAId: m.teamA.id,
          teamBId: m.teamB.id,
          squadA: m.squadA,
          squadB: m.squadB,
          teamSize: m.teamSize ?? DEFAULT_TEAM_SIZE,
          maxWickets: m.maxWickets ?? defaultMaxWickets(m.teamSize ?? DEFAULT_TEAM_SIZE),
          powerplayMode: m.powerplayMode ?? 'auto',
          powerplayOvers: m.powerplayOvers ?? computeAutoPowerplayOvers(m.oversPerInnings),
          lastManStanding: m.lastManStanding ?? false,
          retiredHurtEnabled: m.retiredHurtEnabled ?? true,
          superOverEnabled: m.superOverEnabled ?? false,
        }))
      }
      setLoadingDuplicate(false)
    })
  }, [duplicateId])

  const scope = ownerScope(profile)
  const scopedTeams = useMemo(
    () => (teams.data ?? []).filter((t) => !scope || t.ownerId === scope),
    [teams.data, scope],
  )
  const scopedPlayers = useMemo(
    () => (players.data ?? []).filter((p) => !scope || p.ownerId === scope),
    [players.data, scope],
  )
  const scopedTournaments = useMemo(
    () => (tournaments.data ?? []).filter((t) => !scope || t.ownerId === scope),
    [tournaments.data, scope],
  )
  const teamById = useMemo(
    () => new Map(scopedTeams.map((t) => [t.id, t])),
    [scopedTeams],
  )
  const playerById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  )

  const teamA = form.teamAId ? teamById.get(form.teamAId) : undefined
  const teamB = form.teamBId ? teamById.get(form.teamBId) : undefined

  const selectedTournament = form.tournamentId
    ? scopedTournaments.find((t) => t.id === form.tournamentId)
    : undefined
  const showStage =
    !!selectedTournament && hasKnockoutPhase(selectedTournament.format)

  function onFormatChange(fmt: MatchFormat) {
    set('format', fmt)
    if (fmt !== 'CUSTOM') {
      const overs = MATCH_FORMAT_OVERS[fmt]
      set('oversPerInnings', overs)
      if (form.powerplayMode === 'auto') {
        set('powerplayOvers', computeAutoPowerplayOvers(overs, selectedTournament?.defaultPowerplayOvers))
      }
    }
  }

  function onOversChange(overs: number) {
    set('oversPerInnings', overs)
    if (form.powerplayMode === 'auto') {
      set('powerplayOvers', computeAutoPowerplayOvers(overs, selectedTournament?.defaultPowerplayOvers))
    }
  }

  function onPowerplayModeChange(mode: 'auto' | 'manual') {
    set('powerplayMode', mode)
    if (mode === 'auto') {
      set(
        'powerplayOvers',
        computeAutoPowerplayOvers(form.oversPerInnings, selectedTournament?.defaultPowerplayOvers),
      )
    }
  }

  function onTeamSizeChange(size: number) {
    set('teamSize', size)
    set('maxWickets', defaultMaxWickets(size))
  }

  // Pre-fill Match Rules from the tournament's configured defaults (once, on selection).
  function onTournamentChange(id: string) {
    set('tournamentId', id)
    const t = scopedTournaments.find((x) => x.id === id)
    if (!t) return
    if (t.defaultTeamSize != null) {
      set('teamSize', t.defaultTeamSize)
      set('maxWickets', t.defaultMaxWickets ?? defaultMaxWickets(t.defaultTeamSize))
    } else if (t.defaultMaxWickets != null) {
      set('maxWickets', t.defaultMaxWickets)
    }
    if (form.powerplayMode === 'auto') {
      set('powerplayOvers', computeAutoPowerplayOvers(form.oversPerInnings, t.defaultPowerplayOvers))
    }
  }

  // Pre-fill squads from team rosters when a team is picked.
  function chooseTeam(slot: 'A' | 'B', teamId: string) {
    const t = teamById.get(teamId)
    const squad = t ? [...t.playerIds] : []
    if (slot === 'A') {
      set('teamAId', teamId)
      set('squadA', squad)
    } else {
      set('teamBId', teamId)
      set('squadB', squad)
    }
  }

  function candidatePlayers(team: Team | undefined): Player[] {
    const all = scopedPlayers
    if (!team) return all
    // team squad first, then everyone else (so you can add guests)
    const inTeam = new Set(team.playerIds)
    return [
      ...all.filter((p) => inTeam.has(p.id)),
      ...all.filter((p) => !inTeam.has(p.id)),
    ]
  }

  function toggleSquad(slot: 'A' | 'B', pid: string) {
    const key = slot === 'A' ? 'squadA' : 'squadB'
    const cur = form[key]
    set(key, cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid])
  }

  // step validation — keep this and advanceBlockedReason() adjacent and in sync: every
  // condition here should have a matching branch there explaining *why* it failed.
  function canAdvance(): boolean {
    if (step === 0) return form.title.trim().length > 0
    if (step === 1)
      return !!form.teamAId && !!form.teamBId && form.teamAId !== form.teamBId
    if (step === 2) return form.squadA.length >= 2 && form.squadB.length >= 2
    if (step === 3) return form.tossWinner !== ''
    if (step === 4)
      return (
        form.oversPerInnings >= 1 &&
        form.oversPerInnings <= 120 &&
        form.ballsPerOver >= 1 &&
        form.ballsPerOver <= 12 &&
        form.teamSize >= 2 &&
        form.maxWickets >= 1 &&
        form.powerplayOvers >= 0 &&
        form.powerplayOvers <= form.oversPerInnings
      )
    return true
  }

  /** Why "Next" is disabled on the current step, for display next to the button.
   *  Purely cosmetic — mirrors canAdvance()'s conditions but never changes gating. */
  function advanceBlockedReason(): string | undefined {
    if (step === 0) {
      if (!form.title.trim()) return 'Enter a match title to continue.'
      return undefined
    }
    if (step === 1) {
      if (!form.teamAId) return 'Select Team A to continue.'
      if (!form.teamBId) return 'Select Team B to continue.'
      if (form.teamAId === form.teamBId) return 'Team A and Team B must be different teams.'
      return undefined
    }
    if (step === 2) {
      if (form.squadA.length < 2)
        return `Pick at least 2 players for ${teamA?.shortName ?? 'Team A'}'s Playing XI.`
      if (form.squadB.length < 2)
        return `Pick at least 2 players for ${teamB?.shortName ?? 'Team B'}'s Playing XI.`
      return undefined
    }
    if (step === 3) {
      if (form.tossWinner === '') return 'Select who won the toss to continue.'
      return undefined
    }
    if (step === 4) {
      if (form.oversPerInnings < 1 || form.oversPerInnings > 120)
        return 'Overs per innings must be between 1 and 120.'
      if (form.ballsPerOver < 1 || form.ballsPerOver > 12)
        return 'Balls per over must be between 1 and 12.'
      if (form.teamSize < 2) return 'Team size must be at least 2.'
      if (form.maxWickets < 1) return 'Number of wickets must be at least 1.'
      if (form.powerplayOvers < 0) return 'Powerplay overs cannot be negative.'
      if (form.powerplayOvers > form.oversPerInnings)
        return 'Powerplay overs cannot exceed the total overs per innings.'
      return undefined
    }
    return undefined
  }

  async function submit() {
    if (!teamA || !teamB || !profile) return
    setSaving(true)
    const refA: MatchTeamRef = {
      id: teamA.id,
      name: teamA.name,
      shortName: teamA.shortName,
      color: teamA.primaryColor,
    }
    const refB: MatchTeamRef = {
      id: teamB.id,
      name: teamB.name,
      shortName: teamB.shortName,
      color: teamB.primaryColor,
    }
    const tossWinnerId = form.tossWinner === 'A' ? teamA.id : teamB.id
    const battingFirstTeamId =
      form.tossDecision === 'bat'
        ? tossWinnerId
        : tossWinnerId === teamA.id
          ? teamB.id
          : teamA.id

    const scheduledAt =
      form.date
        ? new Date(`${form.date}T${form.time || '00:00'}`).getTime()
        : null

    const tournament = tournaments.data?.find((t) => t.id === form.tournamentId)
    const stage =
      tournament && hasKnockoutPhase(tournament.format) && form.stage
        ? form.stage
        : null

    const payload = {
      title:
        form.title.trim() || `${teamA.name} vs ${teamB.name}`,
      tournamentId: form.tournamentId || null,
      tournamentName: tournament?.name ?? null,
      stage,
      format: form.format,
      oversPerInnings: Number(form.oversPerInnings) || 20,
      ballsPerOver: Number(form.ballsPerOver) || 6,
      teamA: refA,
      teamB: refB,
      squadA: form.squadA,
      squadB: form.squadB,
      toss: { wonByTeamId: tossWinnerId, decision: form.tossDecision },
      battingFirstTeamId,
      maxWickets: Number(form.maxWickets) || defaultMaxWickets(DEFAULT_TEAM_SIZE),
      teamSize: Number(form.teamSize) || DEFAULT_TEAM_SIZE,
      powerplayMode: form.powerplayMode,
      powerplayOvers: Number(form.powerplayOvers) || 0,
      lastManStanding: form.lastManStanding,
      retiredHurtEnabled: form.retiredHurtEnabled,
      superOverEnabled: form.superOverEnabled,
      venue: form.venue.trim(),
      scheduledAt,
      scorerId: form.scorerId || profile.id,
      isPublic: form.isPublic,
      createdBy: profile.id,
      ownerId: profile.id,
    }

    try {
      if (editId) {
        const prevMatch = await getMatch(editId)
        await updateMatch(editId, payload)
        if (prevMatch) {
          await snapshotVersion(
            'match',
            editId,
            prevMatch,
            changedKeys(prevMatch, payload),
            profile,
            editReason.trim() || undefined,
          )
        }
        toast.success('Match updated')
        navigate(`/match/${editId}`)
      } else {
        const id = await createMatch(payload)
        toast.success('Match created — ready to score')
        navigate(`/scoring/${id}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save match')
    } finally {
      setSaving(false)
    }
  }

  if (teams.loading || players.loading || loadingEdit || loadingDuplicate) return <PageLoader />

  const scorers = (users.data ?? []).filter(
    (u) => u.role === 'SCORER' || u.role === 'ADMIN' || u.role === 'TOURNAMENT_MANAGER',
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={editId ? 'Edit match' : 'New match'}
        subtitle="Set up a match the way you want to score it."
      />

      {/* Stepper */}
      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-2',
                i <= step ? 'text-brand-700' : 'text-ink-400 dark:text-ink-500',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                  i < step
                    ? 'bg-brand-600 text-white'
                    : i === step
                      ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
                      : 'bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500',
                )}
              >
                {i < step ? <Check size={16} /> : i + 1}
              </span>
              <span className="hidden text-sm font-medium sm:inline">
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1',
                  i < step ? 'bg-brand-500' : 'bg-ink-200',
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="p-5">
        {/* Step 0: details */}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Match title" required>
                <Input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="e.g. Sunday League — Final"
                />
              </Field>
            </div>
            <Field label="Tournament (optional)">
              <Select
                value={form.tournamentId}
                onChange={(e) => onTournamentChange(e.target.value)}
              >
                <option value="">Standalone match</option>
                {scopedTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            {showStage && (
              <Field label="Knockout stage">
                <Select
                  value={form.stage}
                  onChange={(e) =>
                    set('stage', e.target.value as '' | KnockoutStage)
                  }
                >
                  <option value="">Group / league phase</option>
                  {STAGE_ORDER.filter((s) => s !== 'group').map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Format">
              <Select
                value={form.format}
                onChange={(e) => onFormatChange(e.target.value as MatchFormat)}
              >
                {Object.entries(MATCH_FORMAT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Venue">
              <Input
                value={form.venue}
                onChange={(e) => set('venue', e.target.value)}
                placeholder="Ground name"
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>
            <Field label="Start time">
              <Input
                type="time"
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
              />
            </Field>
            {scorers.length > 0 && (
              <Field label="Assign scorer">
                <Select
                  value={form.scorerId}
                  onChange={(e) => set('scorerId', e.target.value)}
                >
                  <option value="">Me ({profile?.displayName})</option>
                  {scorers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.role.toLowerCase()})
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Visibility">
              <Select
                value={form.isPublic ? 'public' : 'private'}
                onChange={(e) => set('isPublic', e.target.value === 'public')}
              >
                <option value="public">Public — anyone can watch</option>
                <option value="private">Private — only signed-in staff</option>
              </Select>
            </Field>
          </div>
        )}

        {/* Step 1: teams */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TeamPicker
              label="Team A"
              teams={scopedTeams}
              value={form.teamAId}
              disabledId={form.teamBId}
              onChange={(id) => chooseTeam('A', id)}
            />
            <TeamPicker
              label="Team B"
              teams={scopedTeams}
              value={form.teamBId}
              disabledId={form.teamAId}
              onChange={(id) => chooseTeam('B', id)}
            />
            {scopedTeams.length < 2 && (
              <p className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                You need at least two teams. Create teams in the Teams section.
              </p>
            )}
          </div>
        )}

        {/* Step 2: squads */}
        {step === 2 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <SquadPicker
              title={teamA?.name ?? 'Team A'}
              candidates={candidatePlayers(teamA)}
              selected={form.squadA}
              onToggle={(pid) => toggleSquad('A', pid)}
            />
            <SquadPicker
              title={teamB?.name ?? 'Team B'}
              candidates={candidatePlayers(teamB)}
              selected={form.squadB}
              onToggle={(pid) => toggleSquad('B', pid)}
            />
          </div>
        )}

        {/* Step 3: toss */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-300">
                Who won the toss?
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['A', 'B'] as const).map((slot) => {
                  const t = slot === 'A' ? teamA : teamB
                  return (
                    <button
                      key={slot}
                      onClick={() => set('tossWinner', slot)}
                      className={cn(
                        'rounded-xl border-2 p-4 text-left',
                        form.tossWinner === slot
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-ink-200 dark:border-ink-800 hover:border-ink-300',
                      )}
                    >
                      <div className="font-semibold text-ink-900 dark:text-ink-50">{t?.name}</div>
                      <div className="text-sm text-ink-500 dark:text-ink-400">{t?.shortName}</div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-300">
                Elected to
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['bat', 'bowl'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => set('tossDecision', d)}
                    className={cn(
                      'rounded-xl border-2 p-4 font-semibold capitalize',
                      form.tossDecision === d
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 dark:border-ink-800 text-ink-700 dark:text-ink-300 hover:border-ink-300',
                    )}
                  >
                    {d} first
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: match rules */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Overs per innings">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={form.oversPerInnings}
                  onChange={(e) => onOversChange(Number(e.target.value))}
                  disabled={form.format !== 'CUSTOM'}
                />
              </Field>
              <Field label="Balls per over">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.ballsPerOver}
                  onChange={(e) => set('ballsPerOver', Number(e.target.value))}
                />
              </Field>
              <Field label="Team size" hint="Playing XI per side.">
                <Input
                  type="number"
                  min={2}
                  value={form.teamSize}
                  onChange={(e) => onTeamSizeChange(Number(e.target.value))}
                />
              </Field>
              <Field label="Number of wickets" hint="Wickets down before the innings ends.">
                <Input
                  type="number"
                  min={1}
                  value={form.maxWickets}
                  onChange={(e) => set('maxWickets', Number(e.target.value))}
                />
              </Field>
            </div>

            {form.maxWickets >= form.teamSize && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Wickets ({form.maxWickets}) is at or above team size ({form.teamSize}) — unusual,
                but not invalid. Double-check this is intentional.
              </p>
            )}

            <div>
              <div className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-300">
                Powerplay
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['auto', 'manual'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onPowerplayModeChange(mode)}
                    className={cn(
                      'rounded-xl border-2 p-3 text-left font-semibold capitalize',
                      form.powerplayMode === mode
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 dark:border-ink-800 text-ink-700 dark:text-ink-300 hover:border-ink-300',
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="mt-3 max-w-[220px]">
                <Field
                  label="Powerplay overs"
                  hint={
                    form.powerplayMode === 'auto'
                      ? 'Calculated from total overs (or tournament default beyond 20 overs).'
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    min={0}
                    max={form.oversPerInnings}
                    value={form.powerplayOvers}
                    onChange={(e) => set('powerplayOvers', Number(e.target.value))}
                    disabled={form.powerplayMode === 'auto'}
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-3 border-t border-ink-100 dark:border-ink-800 pt-4">
              <ToggleRow
                label="Last man standing"
                hint="Innings continues with a lone not-out batter instead of ending one short."
                value={form.lastManStanding}
                onChange={(v) => set('lastManStanding', v)}
              />
              <ToggleRow
                label="Retired hurt"
                hint="Offer 'retired hurt' as a wicket type while scoring."
                value={form.retiredHurtEnabled}
                onChange={(v) => set('retiredHurtEnabled', v)}
              />
              <ToggleRow
                label="Super Over"
                hint="Ties are followed by a Super Over per match rules (scored separately)."
                value={form.superOverEnabled}
                onChange={(v) => set('superOverEnabled', v)}
              />
            </div>
          </div>
        )}

        {/* Step 5: review */}
        {step === 5 && teamA && teamB && (
          <>
            <ReviewStep
              form={form}
              teamA={teamA}
              teamB={teamB}
              playerById={playerById}
            />
            {editId && (
              <div className="mt-4">
                <Field label="Reason for this change (optional)">
                  <Input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g. corrected venue"
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between border-t border-ink-100 dark:border-ink-800 pt-4">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}
          >
            <ChevronLeft size={16} /> {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <div className="flex flex-col items-end gap-1.5">
              {!canAdvance() && advanceBlockedReason() && (
                <span className="text-xs text-ink-500 dark:text-ink-400">
                  {advanceBlockedReason()}
                </span>
              )}
              <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
                Next <ChevronRight size={16} />
              </Button>
            </div>
          ) : (
            <Button onClick={submit} loading={saving}>
              {editId ? 'Save match' : 'Create & score'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

function TeamPicker({
  label,
  teams,
  value,
  disabledId,
  onChange,
}: {
  label: string
  teams: Team[]
  value: string
  disabledId: string
  onChange: (id: string) => void
}) {
  return (
    <Field label={label} required>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id} disabled={t.id === disabledId}>
            {t.name} ({t.shortName})
          </option>
        ))}
      </Select>
    </Field>
  )
}

function SquadPicker({
  title,
  candidates,
  selected,
  onToggle,
}: {
  title: string
  candidates: Player[]
  selected: string[]
  onToggle: (pid: string) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-ink-900 dark:text-ink-50">{title}</span>
        <span className="text-sm text-ink-500 dark:text-ink-400">{selected.length} selected</span>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-ink-200 dark:border-ink-800 p-2">
        {candidates.length === 0 && (
          <p className="px-2 py-3 text-sm text-ink-500 dark:text-ink-400">No players available.</p>
        )}
        {candidates.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => onToggle(p.id)}
              className="h-4 w-4"
            />
            <Avatar name={p.fullName} src={p.photoURL} size={26} />
            <span className="text-sm text-ink-800 dark:text-ink-200">{p.fullName}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function ReviewStep({
  form,
  teamA,
  teamB,
  playerById,
}: {
  form: FormState
  teamA: Team
  teamB: Team
  playerById: Map<string, Player>
}) {
  const tossTeam = form.tossWinner === 'A' ? teamA : teamB
  const names = (ids: string[]) =>
    ids.map((id) => playerById.get(id)?.displayName ?? '?').join(', ')
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl bg-ink-50 dark:bg-ink-800/60 p-4">
        <div className="text-lg font-bold text-ink-900 dark:text-ink-50">
          {teamA.name} vs {teamB.name}
        </div>
        <div className="mt-1 text-ink-600 dark:text-ink-400">
          {form.format} · {form.oversPerInnings} overs/innings ·{' '}
          {form.venue || 'Venue TBD'}
        </div>
        <div className="mt-1 text-ink-600 dark:text-ink-400">
          {tossTeam.name} won the toss & chose to {form.tossDecision} first
        </div>
        <div className="mt-1 text-ink-500 dark:text-ink-400">
          {form.isPublic ? 'Public match' : 'Private match'}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>{form.maxWickets} wickets</Badge>
          <Badge>{form.teamSize}-a-side</Badge>
          <Badge>
            Powerplay: {form.powerplayOvers} over{form.powerplayOvers === 1 ? '' : 's'} (
            {form.powerplayMode})
          </Badge>
          {form.lastManStanding && <Badge>Last man standing</Badge>}
          {!form.retiredHurtEnabled && <Badge>No retired hurt</Badge>}
          {form.superOverEnabled && <Badge>Super Over</Badge>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-semibold text-ink-800 dark:text-ink-200">
            {teamA.shortName} XI ({form.squadA.length})
          </div>
          <p className="text-ink-600 dark:text-ink-400">{names(form.squadA) || '—'}</p>
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink-800 dark:text-ink-200">
            {teamB.shortName} XI ({form.squadB.length})
          </div>
          <p className="text-ink-600 dark:text-ink-400">{names(form.squadB) || '—'}</p>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-ink-800 dark:text-ink-200">{label}</div>
        <div className="text-xs text-ink-500 dark:text-ink-400">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          value ? 'bg-brand-600' : 'bg-ink-300',
        )}
        aria-pressed={value}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-ink-900 transition-transform',
            value ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
