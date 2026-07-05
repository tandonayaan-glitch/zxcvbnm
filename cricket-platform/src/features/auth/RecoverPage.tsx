import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, UserCheck, Info } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui/primitives'
import { listUsers } from '@/services/users.service'
import { listPlayers } from '@/services/players.service'
import { listAllMatches } from '@/services/matches.service'
import type { Player, UserProfile } from '@/types'

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
  matchesPlayed: number
}

export function RecoverPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [hint, setHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<Found | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = norm(name)
    if (!q) return
    setLoading(true)
    setSearched(false)
    try {
      const [users, players, matches] = await Promise.all([
        listUsers(),
        listPlayers(),
        listAllMatches(),
      ])

      // Match against accounts (username + display name).
      const account = users.find(
        (u) => norm(u.username) === q || norm(u.displayName) === q,
      )

      // Match against players (full / display / short name).
      const player = players.find(
        (p) =>
          norm(p.fullName) === q ||
          norm(p.displayName) === q ||
          (p.shortName ? norm(p.shortName) === q : false),
      )

      // Confidence: how many matches this player featured in.
      let matchesPlayed = 0
      if (player) {
        matchesPlayed = matches.filter((m) =>
          [...m.squadA, ...m.squadB].includes(player.id),
        ).length
      }

      setResult({ account, player, matchesPlayed })
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

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
          {result.account ? (
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
    </AuthLayout>
  )
}
