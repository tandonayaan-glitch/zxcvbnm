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
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
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
import { useAuthStore, ownerScope } from '@/store/authStore'
import { cn } from '@/lib/cn'
import { MATCH_FORMAT_LABELS, MATCH_FORMAT_OVERS } from '@/lib/format'
import { STAGE_ORDER, STAGE_LABELS, hasKnockoutPhase } from '@/domain/bracket'
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
}

const STEPS = [
  { label: 'Details', icon: <Settings2 size={16} /> },
  { label: 'Teams', icon: <Shield size={16} /> },
  { label: 'Squads', icon: <Users size={16} /> },
  { label: 'Toss', icon: <Coins size={16} /> },
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
  const profile = useAuthStore((s) => s.profile)

  const teams = useAsync(listTeams, [])
  const players = useAsync(listPlayers, [])
  const tournaments = useAsync(listTournaments, [])
  const users = useAsync(listUsers, [])

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)
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
        })
      }
      setLoadingEdit(false)
    })
  }, [editId])

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
    if (fmt !== 'CUSTOM') set('oversPerInnings', MATCH_FORMAT_OVERS[fmt])
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

  // step validation
  function canAdvance(): boolean {
    if (step === 0) return form.title.trim().length > 0
    if (step === 1)
      return !!form.teamAId && !!form.teamBId && form.teamAId !== form.teamBId
    if (step === 2) return form.squadA.length >= 2 && form.squadB.length >= 2
    if (step === 3) return form.tossWinner !== ''
    return true
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
      venue: form.venue.trim(),
      scheduledAt,
      scorerId: form.scorerId || profile.id,
      isPublic: form.isPublic,
      createdBy: profile.id,
      ownerId: profile.id,
    }

    try {
      if (editId) {
        await updateMatch(editId, payload)
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

  if (teams.loading || players.loading || loadingEdit) return <PageLoader />

  const scorers = (users.data ?? []).filter(
    (u) => u.role === 'SCORER' || u.role === 'ADMIN',
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
                i <= step ? 'text-brand-700' : 'text-ink-400',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                  i < step
                    ? 'bg-brand-600 text-white'
                    : i === step
                      ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
                      : 'bg-ink-100 text-ink-400',
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
                onChange={(e) => set('tournamentId', e.target.value)}
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
            <Field label="Overs per innings">
              <Input
                type="number"
                min={1}
                value={form.oversPerInnings}
                onChange={(e) => set('oversPerInnings', Number(e.target.value))}
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
              <div className="mb-2 text-sm font-medium text-ink-700">
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
                          : 'border-ink-200 hover:border-ink-300',
                      )}
                    >
                      <div className="font-semibold text-ink-900">{t?.name}</div>
                      <div className="text-sm text-ink-500">{t?.shortName}</div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-ink-700">
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
                        : 'border-ink-200 text-ink-700 hover:border-ink-300',
                    )}
                  >
                    {d} first
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: review */}
        {step === 4 && teamA && teamB && (
          <ReviewStep
            form={form}
            teamA={teamA}
            teamB={teamB}
            playerById={playerById}
          />
        )}

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}
          >
            <ChevronLeft size={16} /> {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
              Next <ChevronRight size={16} />
            </Button>
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
        <span className="font-semibold text-ink-900">{title}</span>
        <span className="text-sm text-ink-500">{selected.length} selected</span>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
        {candidates.length === 0 && (
          <p className="px-2 py-3 text-sm text-ink-500">No players available.</p>
        )}
        {candidates.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-ink-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => onToggle(p.id)}
              className="h-4 w-4"
            />
            <Avatar name={p.fullName} src={p.photoURL} size={26} />
            <span className="text-sm text-ink-800">{p.fullName}</span>
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
      <div className="rounded-xl bg-ink-50 p-4">
        <div className="text-lg font-bold text-ink-900">
          {teamA.name} vs {teamB.name}
        </div>
        <div className="mt-1 text-ink-600">
          {form.format} · {form.oversPerInnings} overs/innings ·{' '}
          {form.venue || 'Venue TBD'}
        </div>
        <div className="mt-1 text-ink-600">
          {tossTeam.name} won the toss & chose to {form.tossDecision} first
        </div>
        <div className="mt-1 text-ink-500">
          {form.isPublic ? 'Public match' : 'Private match'}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-semibold text-ink-800">
            {teamA.shortName} XI ({form.squadA.length})
          </div>
          <p className="text-ink-600">{names(form.squadA) || '—'}</p>
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink-800">
            {teamB.shortName} XI ({form.squadB.length})
          </div>
          <p className="text-ink-600">{names(form.squadB) || '—'}</p>
        </div>
      </div>
    </div>
  )
}
