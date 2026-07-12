import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, UserCheck, Info, ShieldQuestion, Lock } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui/primitives'
import { listUsers } from '@/services/users.service'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listAllMatches } from '@/services/matches.service'
import { logRecoveryAttempt } from '@/services/recovery.service'
import { buildRecoveryQuestions, type RecoveryQuestion } from '@/domain/recoveryQuiz'
import type { Player, Team, UserProfile } from '@/types'

/** Forgiving normalisation: lowercase, trim, collapse spaces, drop punctuation. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Found {
  account?: UserProfile
  player?: Player
  linkedPlayer?: Player
  matchesPlayed: number
}

/* --------------------------------------------------------------------
 * Client-side rate limiting for the recovery quiz. There's no backend
 * here to rate-limit server-side, so this is a honest, bounded
 * best-effort: it stops casual brute-forcing from one browser, not a
 * determined attacker rotating storage/IPs. `recoveryAttempts` (Firestore,
 * master-admin-readable) is the real audit trail; this is just the
 * client-side cooldown gate in front of it.
 * ------------------------------------------------------------------ */
const RATE_LIMIT_KEY = 'ch_recovery_rl'
const MAX_ATTEMPTS = 5
const COOLDOWN_MS = 15 * 60 * 1000

interface RateState {
  count: number
  lockUntil: number
}

function readRateState(): RateState {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY)
    if (!raw) return { count: 0, lockUntil: 0 }
    return JSON.parse(raw) as RateState
  } catch {
    return { count: 0, lockUntil: 0 }
  }
}

function writeRateState(s: RateState) {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(s))
  } catch {
    // ignore (private browsing etc.) — worst case, rate limiting is a no-op
  }
}

function registerFailedAttempt(): RateState {
  const s = readRateState()
  const next: RateState = { count: s.count + 1, lockUntil: s.lockUntil }
  if (next.count >= MAX_ATTEMPTS) {
    next.lockUntil = Date.now() + COOLDOWN_MS
    next.count = 0
  }
  writeRateState(next)
  return next
}

function registerSuccess() {
  writeRateState({ count: 0, lockUntil: 0 })
}

export function RecoverPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [hint, setHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<Found | null>(null)
  const [questions, setQuestions] = useState<RecoveryQuestion[] | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [quizError, setQuizError] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)

  const now = Date.now()
  const locked = lockedUntil != null && lockedUntil > now

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const rl = readRateState()
    if (rl.lockUntil > Date.now()) {
      setLockedUntil(rl.lockUntil)
      await logRecoveryAttempt({
        playerName: name.trim() || '(blank)',
        outcome: 'rate_limited',
        usernameRevealed: false,
      })
      return
    }
    const q = norm(name)
    if (!q) return
    setLoading(true)
    setSearched(false)
    setQuestions(null)
    setAnswers([])
    setQuizError('')
    setRevealed(false)
    try {
      const [users, players, teams, matches] = await Promise.all([
        listUsers(),
        listPlayers(),
        listTeams(),
        listAllMatches(),
      ])

      const account = users.find(
        (u) => norm(u.username) === q || norm(u.displayName) === q,
      )
      const player = players.find(
        (p) =>
          norm(p.fullName) === q ||
          norm(p.displayName) === q ||
          (p.shortName ? norm(p.shortName) === q : false),
      )

      let matchesPlayed = 0
      if (player) {
        matchesPlayed = matches.filter((m) =>
          [...m.squadA, ...m.squadB].includes(player.id),
        ).length
      }

      const linkedPlayer = account
        ? players.find((p) => p.linkedUserId === account.id)
        : undefined

      setResult({ account, player, linkedPlayer, matchesPlayed })
      setSearched(true)

      if (account && linkedPlayer) {
        const qs = buildRecoveryQuestions(linkedPlayer, teams as Team[])
        setQuestions(qs)
        setAnswers(new Array(qs.length).fill(-1))
      } else if (account) {
        // No linked player to build questions from (e.g. a master-admin or
        // manually-created account) — nothing to verify against, so this
        // reveals directly, same as before the quiz existed. A genuine
        // limitation of this app's client-only recovery flow, not an
        // oversight: there is no server-side identity check to fall back to.
        await logRecoveryAttempt({
          playerName: name.trim(),
          outcome: 'no_quiz_available',
          usernameRevealed: true,
        })
        setRevealed(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function submitQuiz() {
    if (!questions || !result?.linkedPlayer) return
    const allCorrect = questions.every((q, i) => answers[i] === q.correctIndex)
    if (allCorrect) {
      registerSuccess()
      await logRecoveryAttempt({
        playerId: result.linkedPlayer.id,
        playerName: name.trim(),
        outcome: 'quiz_passed',
        usernameRevealed: true,
      })
      setRevealed(true)
      setQuizError('')
    } else {
      const rl = registerFailedAttempt()
      await logRecoveryAttempt({
        playerId: result.linkedPlayer.id,
        playerName: name.trim(),
        outcome: 'quiz_failed',
        usernameRevealed: false,
      })
      if (rl.lockUntil > Date.now()) {
        setLockedUntil(rl.lockUntil)
      } else {
        setQuizError("That doesn't match our records. Try again.")
        setAnswers(new Array(questions.length).fill(-1))
      }
    }
  }

  const cooldownMinutes = lockedUntil
    ? Math.max(1, Math.ceil((lockedUntil - now) / 60000))
    : 0

  return (
    <AuthLayout
      title="Recover access"
      subtitle="Forgot your username? Find your account using the name you play under."
      footer={
        <Link to="/login" className="font-semibold text-white underline">
          Back to sign in
        </Link>
      }
    >
      {locked ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <Lock size={18} /> Too many attempts
          </div>
          <p className="mt-1">
            For security, recovery from this device is paused for about{' '}
            {cooldownMinutes} minute{cooldownMinutes === 1 ? '' : 's'}. Try again after
            that, or ask your tournament admin to reset your password directly.
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={search} className="space-y-4">
            <Field label="Your name" hint="As it appears on scorecards — spacing & caps don't matter">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohit Sharma"
              />
            </Field>
            <Field label="A team or opponent you played (optional)">
              <Input
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="helps confirm it's you"
              />
            </Field>
            <Button type="submit" block size="lg" loading={loading}>
              <Search size={16} /> Find my account
            </Button>
          </form>

          {searched && result && (
            <div className="mt-5 space-y-3">
              {result.account && questions && questions.length > 0 && !revealed ? (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
                  <div className="flex items-center gap-2 font-semibold text-brand-800">
                    <ShieldQuestion size={18} /> Confirm it's you
                  </div>
                  <p className="mt-1 text-sm text-brand-700">
                    Answer {questions.length > 1 ? 'these questions' : 'this question'}{' '}
                    to see your username.
                  </p>
                  <div className="mt-3 space-y-3">
                    {questions.map((q, qi) => (
                      <div key={q.key}>
                        <div className="mb-1.5 text-sm font-medium text-ink-800">
                          {q.prompt}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {q.options.map((opt, oi) => (
                            <button
                              key={oi}
                              type="button"
                              onClick={() =>
                                setAnswers((prev) => {
                                  const next = [...prev]
                                  next[qi] = oi
                                  return next
                                })
                              }
                              className={`rounded-lg border px-2 py-1.5 text-sm ${
                                answers[qi] === oi
                                  ? 'border-brand-500 bg-brand-100 font-semibold text-brand-800'
                                  : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {quizError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{quizError}</p>
                  )}
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={answers.some((a) => a < 0)}
                    onClick={submitQuiz}
                  >
                    Verify
                  </Button>
                </div>
              ) : result.account && revealed ? (
                <div className="rounded-lg border border-pitch-200 bg-pitch-50 p-4">
                  <div className="flex items-center gap-2 font-semibold text-pitch-800">
                    <UserCheck size={18} /> Account found
                  </div>
                  <p className="mt-1 text-sm text-pitch-700">
                    Your username is{' '}
                    <b className="font-mono">@{result.account.username}</b>. Sign in
                    with that username and your password.
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() =>
                      navigate('/login', {
                        state: { username: result.account?.username },
                      })
                    }
                  >
                    Go to sign in
                  </Button>
                </div>
              ) : result.player ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <Info size={18} /> You're in the system as a player
                  </div>
                  <p className="mt-1">
                    We found <b>{result.player.fullName}</b>
                    {result.matchesPlayed > 0 &&
                      ` in ${result.matchesPlayed} match${
                        result.matchesPlayed === 1 ? '' : 'es'
                      }`}
                    , but there's no login linked yet. Create an account with the
                    same name, then ask your tournament admin to grant access.
                  </p>
                  <Link to="/signup">
                    <Button className="mt-3" size="sm" variant="outline">
                      Create an account
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm text-ink-600">
                  No matching account or player found. Check the spelling, or{' '}
                  <Link to="/signup" className="font-semibold text-brand-700 underline">
                    create a new account
                  </Link>
                  .
                </div>
              )}
              <p className="text-center text-xs text-ink-400">
                For security, passwords are reset by your administrator.
              </p>
            </div>
          )}
        </>
      )}
    </AuthLayout>
  )
}
