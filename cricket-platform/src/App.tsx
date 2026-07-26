import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { isFirebaseConfigured } from '@/lib/firebase'
import { useAuthStore, isMasterAdmin } from '@/store/authStore'
import { usePrefsStore, applyPrefs } from '@/store/prefsStore'
import { ProtectedRoute } from '@/components/guards/guards'
import { AppShell } from '@/components/layout/AppShell'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { FirebaseNotice } from '@/features/misc/FirebaseNotice'
import { MaintenanceScreen } from '@/features/misc/MaintenanceScreen'
import { getSettings } from '@/services/settings.service'
import { BackgroundLayer } from '@/components/background/BackgroundLayer'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { PageLoader } from '@/components/ui/primitives'
import type { MaintenanceConfig } from '@/types'

/* Route pages are lazy-loaded so the initial bundle stays small; each page
 * ships in its own chunk fetched on navigation. Named exports are adapted to
 * the default-export shape React.lazy expects. */
const NotFoundPage = lazy(() =>
  import('@/features/misc/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
const PrivacyPolicyPage = lazy(() =>
  import('@/features/misc/PrivacyPolicyPage').then((m) => ({
    default: m.PrivacyPolicyPage,
  })),
)
const TermsOfServicePage = lazy(() =>
  import('@/features/misc/TermsOfServicePage').then((m) => ({
    default: m.TermsOfServicePage,
  })),
)
const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const SignupPage = lazy(() =>
  import('@/features/auth/SignupPage').then((m) => ({ default: m.SignupPage })),
)
const SetupPage = lazy(() =>
  import('@/features/auth/SetupPage').then((m) => ({ default: m.SetupPage })),
)
const RecoverPage = lazy(() =>
  import('@/features/auth/RecoverPage').then((m) => ({ default: m.RecoverPage })),
)
const ActivatePage = lazy(() =>
  import('@/features/auth/ActivatePage').then((m) => ({ default: m.ActivatePage })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
)
const PlayersPage = lazy(() =>
  import('@/features/players/PlayersPage').then((m) => ({ default: m.PlayersPage })),
)
const TeamsPage = lazy(() =>
  import('@/features/teams/TeamsPage').then((m) => ({ default: m.TeamsPage })),
)
const TournamentsPage = lazy(() =>
  import('@/features/tournaments/TournamentsPage').then((m) => ({
    default: m.TournamentsPage,
  })),
)
const MatchesPage = lazy(() =>
  import('@/features/matches/MatchesPage').then((m) => ({ default: m.MatchesPage })),
)
const MatchSetupPage = lazy(() =>
  import('@/features/matches/MatchSetupPage').then((m) => ({
    default: m.MatchSetupPage,
  })),
)
const ScoringPage = lazy(() =>
  import('@/features/scoring/ScoringPage').then((m) => ({ default: m.ScoringPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const UserSettingsPage = lazy(() =>
  import('@/features/settings/UserSettingsPage').then((m) => ({
    default: m.UserSettingsPage,
  })),
)
const UsersPage = lazy(() =>
  import('@/features/settings/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const RequestsPage = lazy(() =>
  import('@/features/requests/RequestsPage').then((m) => ({ default: m.RequestsPage })),
)
const PlatformToolsPage = lazy(() =>
  import('@/features/admin/PlatformToolsPage').then((m) => ({
    default: m.PlatformToolsPage,
  })),
)
const PlatformAnalyticsPage = lazy(() =>
  import('@/features/admin/PlatformAnalyticsPage').then((m) => ({
    default: m.PlatformAnalyticsPage,
  })),
)
const ClubsSeasonsPage = lazy(() =>
  import('@/features/admin/ClubsSeasonsPage').then((m) => ({
    default: m.ClubsSeasonsPage,
  })),
)
const PlayerMergePage = lazy(() =>
  import('@/features/admin/PlayerMergePage').then((m) => ({
    default: m.PlayerMergePage,
  })),
)
const TrashPage = lazy(() =>
  import('@/features/admin/TrashPage').then((m) => ({ default: m.TrashPage })),
)
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const FeatureFlagsPage = lazy(() =>
  import('@/features/admin/FeatureFlagsPage').then((m) => ({
    default: m.FeatureFlagsPage,
  })),
)
const InvitationsPage = lazy(() =>
  import('@/features/admin/InvitationsPage').then((m) => ({
    default: m.InvitationsPage,
  })),
)
const InvitePage = lazy(() =>
  import('@/features/misc/InvitePage').then((m) => ({ default: m.InvitePage })),
)
const MediaLibraryPage = lazy(() =>
  import('@/features/admin/MediaLibraryPage').then((m) => ({
    default: m.MediaLibraryPage,
  })),
)
const AccountPage = lazy(() =>
  import('@/features/account/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const StatsPage = lazy(() =>
  import('@/features/stats/StatsPage').then((m) => ({ default: m.StatsPage })),
)
const ComparePage = lazy(() =>
  import('@/features/public/ComparePage').then((m) => ({ default: m.ComparePage })),
)
const CompareTeamsPage = lazy(() =>
  import('@/features/public/CompareTeamsPage').then((m) => ({
    default: m.CompareTeamsPage,
  })),
)
const CompareClubsPage = lazy(() =>
  import('@/features/public/CompareClubsPage').then((m) => ({
    default: m.CompareClubsPage,
  })),
)
const CompareSeasonsPage = lazy(() =>
  import('@/features/public/CompareSeasonsPage').then((m) => ({
    default: m.CompareSeasonsPage,
  })),
)
const CompareTournamentsPage = lazy(() =>
  import('@/features/public/CompareTournamentsPage').then((m) => ({
    default: m.CompareTournamentsPage,
  })),
)
const PublicHomePage = lazy(() =>
  import('@/features/public/PublicHomePage').then((m) => ({
    default: m.PublicHomePage,
  })),
)
const PublicBrowsePage = lazy(() =>
  import('@/features/public/PublicBrowsePage').then((m) => ({
    default: m.PublicBrowsePage,
  })),
)
const SearchPage = lazy(() =>
  import('@/features/public/SearchPage').then((m) => ({ default: m.SearchPage })),
)
const PlayerPage = lazy(() =>
  import('@/features/public/PlayerPage').then((m) => ({ default: m.PlayerPage })),
)
const TeamPage = lazy(() =>
  import('@/features/public/TeamPage').then((m) => ({ default: m.TeamPage })),
)
const TournamentPage = lazy(() =>
  import('@/features/public/TournamentPage').then((m) => ({
    default: m.TournamentPage,
  })),
)
const ClubPage = lazy(() =>
  import('@/features/public/ClubPage').then((m) => ({ default: m.ClubPage })),
)
const SeasonPage = lazy(() =>
  import('@/features/public/SeasonPage').then((m) => ({ default: m.SeasonPage })),
)
const MatchPage = lazy(() =>
  import('@/features/public/MatchPage').then((m) => ({ default: m.MatchPage })),
)
const UserProfilePage = lazy(() =>
  import('@/features/public/UserProfilePage').then((m) => ({
    default: m.UserProfilePage,
  })),
)

export default function App() {
  const init = useAuthStore((s) => s.init)
  const profile = useAuthStore((s) => s.profile)
  const prefs = usePrefsStore((s) => s.prefs)
  const [maintenance, setMaintenance] = useState<MaintenanceConfig | null>(null)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    applyPrefs(prefs)
  }, [prefs])

  useEffect(() => {
    if (!isFirebaseConfigured) return
    getSettings()
      .then((s) => setMaintenance(s.maintenance))
      .catch(() => {})
  }, [])

  if (!isFirebaseConfigured) return <FirebaseNotice />

  if (maintenance?.enabled && !isMasterAdmin(profile)) {
    return <MaintenanceScreen config={maintenance} />
  }

  return (
    <>
      <BackgroundLayer />
      <OfflineBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
        {/* Auth (full screen) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/recover" element={<RecoverPage />} />
        <Route
          path="/activate"
          element={
            <ProtectedRoute>
              <ActivatePage />
            </ProtectedRoute>
          }
        />

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
          <Route path="/clubs" element={<ClubsSeasonsPage />} />
          <Route
            path="/admin/trash"
            element={
              <ProtectedRoute
                roles={['MASTER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'TOURNAMENT_MANAGER']}
              >
                <TrashPage />
              </ProtectedRoute>
            }
          />
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
            path="/admin/analytics"
            element={
              <ProtectedRoute roles={['MASTER_ADMIN']}>
                <PlatformAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/merge-players"
            element={
              <ProtectedRoute roles={['MASTER_ADMIN']}>
                <PlayerMergePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/feature-flags"
            element={
              <ProtectedRoute roles={['MASTER_ADMIN']}>
                <FeatureFlagsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/invitations"
            element={
              <ProtectedRoute roles={['MASTER_ADMIN']}>
                <InvitationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/media"
            element={
              <ProtectedRoute roles={['MASTER_ADMIN']}>
                <MediaLibraryPage />
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
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/compare/teams" element={<CompareTeamsPage />} />
          <Route path="/compare/clubs" element={<CompareClubsPage />} />
          <Route path="/compare/seasons" element={<CompareSeasonsPage />} />
          <Route path="/compare/tournaments" element={<CompareTournamentsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/player/:id" element={<PlayerPage />} />
          <Route path="/team/:id" element={<TeamPage />} />
          <Route path="/tournament/:id" element={<TournamentPage />} />
          <Route path="/club/:id" element={<ClubPage />} />
          <Route path="/season/:id" element={<SeasonPage />} />
          <Route path="/match/:id" element={<MatchPage />} />
          <Route path="/u/:username" element={<UserProfilePage />} />
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
