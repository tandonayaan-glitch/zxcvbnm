import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { isFirebaseConfigured } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { usePrefsStore, applyPrefs } from '@/store/prefsStore'
import { ProtectedRoute } from '@/components/guards/guards'
import { AppShell } from '@/components/layout/AppShell'
import { PublicLayout } from '@/components/layout/PublicLayout'

import { FirebaseNotice } from '@/features/misc/FirebaseNotice'
import { NotFoundPage } from '@/features/misc/NotFoundPage'

import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { SetupPage } from '@/features/auth/SetupPage'

import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PlayersPage } from '@/features/players/PlayersPage'
import { TeamsPage } from '@/features/teams/TeamsPage'
import { TournamentsPage } from '@/features/tournaments/TournamentsPage'
import { MatchesPage } from '@/features/matches/MatchesPage'
import { MatchSetupPage } from '@/features/matches/MatchSetupPage'
import { ScoringPage } from '@/features/scoring/ScoringPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { UserSettingsPage } from '@/features/settings/UserSettingsPage'
import { UsersPage } from '@/features/settings/UsersPage'
import { RequestsPage } from '@/features/requests/RequestsPage'
import { PlatformToolsPage } from '@/features/admin/PlatformToolsPage'
import { AccountPage } from '@/features/account/AccountPage'
import { StatsPage } from '@/features/stats/StatsPage'
import { RecoverPage } from '@/features/auth/RecoverPage'
import { BackgroundLayer } from '@/components/background/BackgroundLayer'

import { PublicHomePage } from '@/features/public/PublicHomePage'
import { PublicBrowsePage } from '@/features/public/PublicBrowsePage'
import { SearchPage } from '@/features/public/SearchPage'
import { PlayerPage } from '@/features/public/PlayerPage'
import { TeamPage } from '@/features/public/TeamPage'
import { TournamentPage } from '@/features/public/TournamentPage'
import { MatchPage } from '@/features/public/MatchPage'

export default function App() {
  const init = useAuthStore((s) => s.init)
  const prefs = usePrefsStore((s) => s.prefs)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    applyPrefs(prefs)
  }, [prefs])

  if (!isFirebaseConfigured) return <FirebaseNotice />

  return (
    <>
      <BackgroundLayer />
      <Routes>
      {/* Auth (full screen) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/recover" element={<RecoverPage />} />

      {/* Live scoring (full screen, scorer/admin only) */}
      <Route
        path="/scoring/:id"
        element={
          <ProtectedRoute roles={['MASTER_ADMIN', 'ADMIN', 'SCORER']}>
            <div className="min-h-screen px-4 py-6">
              <ScoringPage />
            </div>
          </ProtectedRoute>
        }
      />

      {/* App shell (signed-in management) */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route
          path="/matches/new"
          element={
            <ProtectedRoute roles={['MASTER_ADMIN', 'ADMIN', 'SCORER']}>
              <MatchSetupPage />
            </ProtectedRoute>
          }
        />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['MASTER_ADMIN']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute roles={['MASTER_ADMIN']}>
              <RequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tools"
          element={
            <ProtectedRoute roles={['MASTER_ADMIN']}>
              <PlatformToolsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <UserSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute roles={['MASTER_ADMIN']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicHomePage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route path="/browse" element={<PublicBrowsePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/player/:id" element={<PlayerPage />} />
        <Route path="/team/:id" element={<TeamPage />} />
        <Route path="/tournament/:id" element={<TournamentPage />} />
        <Route path="/match/:id" element={<MatchPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
