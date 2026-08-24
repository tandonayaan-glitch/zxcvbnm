import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldQuestion, BadgeCheck, Clock } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageLoader,
  Textarea,
} from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAuthStore, canManageTournaments } from '@/store/authStore'
import { useFavStore } from '@/store/favStore'
import { useAsync } from '@/hooks/useAsync'
import { listPlayers } from '@/services/players.service'
import { listTeams } from '@/services/teams.service'
import { listTournaments } from '@/services/tournaments.service'
import { listClubs } from '@/services/clubs.service'
import { listSeasons } from '@/services/seasons.service'
import { createAdminRequest, getMyRequest } from '@/services/requests.service'
import { homeForRole } from '@/features/auth/AuthLayout'
import { Heart } from 'lucide-react'
import type { AdminRequest } from '@/types'

export function AccountPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const favs = useFavStore((s) => s.favs)
  const allPlayers = useAsync(listPlayers, [])
  const allTeams = useAsync(listTeams, [])
  const allTournaments = useAsync(listTournaments, [])
  const allClubs = useAsync(listClubs, [])
  const allSeasons = useAsync(listSeasons, [])

  const [request, setRequest] = useState<AdminRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [tournamentName, setTournamentName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!profile) return
    getMyRequest(profile.id)
      .then(setRequest)
      .finally(() => setLoading(false))
  }, [profile])

  if (!profile) {
    navigate('/login', { replace: true })
    return null
  }

  async function submit() {
    if (!profile) return
    if (!tournamentName.trim()) {
      toast.error('Please enter the tournament you want to run.')
      return
    }
    setSubmitting(true)
    try {
      await createAdminRequest(profile, { tournamentName, message })
      const r = await getMyRequest(profile.id)
      setRequest(r)
      toast.success('Request submitted — the master admin will review it.')
    } catch {
      toast.error('Could not submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const isViewer = profile.role === 'VIEWER'
  // Anyone who doesn't already have tournament-management rights can apply — not just
  // VIEWER. Self-signup grants SCORER by default (see SignupPage.tsx), so gating this on
  // VIEWER alone would hide the option from every normal new account.
  const canApplyForTournamentManager = !canManageTournaments(profile)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card className="mb-4">
        <CardBody className="flex items-center gap-4">
          <Avatar name={profile.displayName} size={56} />
          <div>
            <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">
              {profile.displayName}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
              <span>@{profile.username}</span>
              <Badge tone={profile.role === 'VIEWER' ? 'gray' : 'blue'}>
                {profile.role.replace('_', ' ').toLowerCase()}
              </Badge>
            </div>
          </div>
          {!isViewer && (
            <Link to={homeForRole(profile.role)} className="ml-auto">
              <Button variant="outline">Go to dashboard</Button>
            </Link>
          )}
        </CardBody>
      </Card>

      {(favs.players.length > 0 ||
        favs.teams.length > 0 ||
        favs.tournaments.length > 0 ||
        favs.clubs.length > 0 ||
        favs.seasons.length > 0) && (
        <Card className="mb-4 border-red-200">
          <CardHeader
            className="bg-red-50"
            title={
              <span className="flex items-center gap-2 text-red-700">
                <Heart size={18} /> Following
              </span>
            }
          />
          <CardBody className="flex flex-wrap gap-2">
            {favs.players.map((pid) => {
              const p = (allPlayers.data ?? []).find((x) => x.id === pid)
              if (!p) return null
              return (
                <Link
                  key={pid}
                  to={`/player/${pid}`}
                  className="rounded-full border border-ink-200 dark:border-ink-800 px-3 py-1 text-sm text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  {p.displayName}
                </Link>
              )
            })}
            {favs.teams.map((tid) => {
              const t = (allTeams.data ?? []).find((x) => x.id === tid)
              if (!t) return null
              return (
                <Link
                  key={tid}
                  to={`/team/${tid}`}
                  className="rounded-full border border-ink-200 dark:border-ink-800 px-3 py-1 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                  style={{ borderColor: t.primaryColor }}
                >
                  {t.shortName}
                </Link>
              )
            })}
            {favs.tournaments.map((tid) => {
              const t = (allTournaments.data ?? []).find((x) => x.id === tid)
              if (!t) return null
              return (
                <Link
                  key={tid}
                  to={`/tournament/${tid}`}
                  className="rounded-full border border-ink-200 dark:border-ink-800 px-3 py-1 text-sm text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  {t.name}
                </Link>
              )
            })}
            {favs.clubs.map((cid) => {
              const c = (allClubs.data ?? []).find((x) => x.id === cid)
              if (!c) return null
              return (
                <Link
                  key={cid}
                  to={`/club/${cid}`}
                  className="rounded-full border border-ink-200 dark:border-ink-800 px-3 py-1 text-sm text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  {c.name}
                </Link>
              )
            })}
            {favs.seasons.map((sid) => {
              const s = (allSeasons.data ?? []).find((x) => x.id === sid)
              if (!s) return null
              return (
                <Link
                  key={sid}
                  to={`/season/${sid}`}
                  className="rounded-full border border-ink-200 dark:border-ink-800 px-3 py-1 text-sm text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  {s.name}
                </Link>
              )
            })}
          </CardBody>
        </Card>
      )}

      {canApplyForTournamentManager && (
        <Card className="border-brand-200">
          <CardHeader
            className="bg-brand-50"
            title={
              <span className="flex items-center gap-2 text-brand-800">
                <ShieldQuestion size={18} /> Request admin access
              </span>
            }
            subtitle="Tournament Managers can create and run their own tournaments."
          />
          <CardBody>
            {loading ? (
              <PageLoader />
            ) : request && request.status === 'pending' ? (
              <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-amber-800">
                <Clock size={20} />
                <div>
                  <div className="font-semibold">Request pending</div>
                  <div className="text-sm">
                    You asked to run “{request.tournamentName}”. The master admin
                    will review it soon.
                  </div>
                </div>
              </div>
            ) : request && request.status === 'approved' ? (
              <div className="flex items-center gap-3 rounded-lg bg-pitch-50 px-4 py-3 text-pitch-800">
                <BadgeCheck size={20} />
                <div className="text-sm font-semibold">
                  Approved! Sign out and back in to use your new admin access.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {request && request.status === 'rejected' && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    Your previous request was declined. You can submit a new one.
                  </div>
                )}
                <Field label="Tournament you want to run" required>
                  <Input
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    placeholder="e.g. Sunday Premier League"
                  />
                </Field>
                <Field label="Message (optional)">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell the master admin a bit about your tournament…"
                  />
                </Field>
                <Button onClick={submit} loading={submitting}>
                  Submit request
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
