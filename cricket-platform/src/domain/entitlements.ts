import type { PlanTier, PremiumFeatureDef, Subscription } from '@/types'

/**
 * Feature registry for premium gating (ROADMAP_V5 Slice C3, populated per the confirmed Free vs
 * Paid registry). Every key below was mapped to its real implementation by auditing the codebase
 * directly (file/component/domain-module named in each entry's comment) — nothing here was
 * guessed. Several paid list entries are intentionally consolidated onto one key where they
 * describe the same underlying implementation from different angles (noted per entry); a few have
 * no existing implementation at all and are registered with `applied: false` — the entitlement
 * exists so `hasEntitlement()` can be checked once the feature is built, but nothing in the UI
 * gates on them yet, per instruction not to build fake placeholder functionality.
 *
 * `hasEntitlement()` returns `true` for any key not in this list, so registering a key before every
 * one of its call sites is wired is safe — it simply isn't enforced yet.
 */
export const PREMIUM_FEATURES: PremiumFeatureDef[] = [
  // ---- Applied: gated in the UI as of this slice ----
  { key: 'auto_powerplay', name: 'Automatic powerplay calculation', tier: 'premium',
    description: 'Auto-fill powerplay overs in the match setup wizard (domain/matchRules.ts). Manual entry stays free — this only gates the "Auto" convenience.' },
  { key: 'tournament_statistics', name: 'Tournament statistics', tier: 'premium',
    description: "A tournament's own Leaders (top run-scorers/wicket-takers) and Records tabs on its public page." },
  { key: 'season_splits', name: 'Season splits', tier: 'premium',
    description: "A player's stats split by season (domain/playerSplits.ts) on their public page." },
  { key: 'recent_form_charts', name: 'Recent-form charts', tier: 'premium',
    description: 'Recent-results form chart — both the team version (components/charts/TeamForm.tsx) and the player version (PlayerForm.tsx).' },
  { key: 'player_radar', name: 'Player radar', tier: 'premium',
    description: 'components/charts/PlayerRadar.tsx on a player’s public page.' },
  { key: 'team_records', name: 'Team records', tier: 'premium',
    description: 'A team’s "Team records" section (domain/teamRecords.ts) on its public page.' },
  { key: 'records_by_venue', name: 'Records by venue', tier: 'premium',
    description: "A team's venue-scoped records (domain/teamVenues.ts) on its public page." },
  { key: 'qualification_tracking', name: 'Qualification tracking', tier: 'premium',
    description: 'The Qualification tab (domain/qualification.ts) on a tournament page. Distinct from the Groups tab (domain/groups.ts), which stays free — that’s the group-stage standings table, not the qualified/eliminated tracker.' },
  { key: 'tournament_timeline', name: 'Tournament timeline', tier: 'premium',
    description: 'The Timeline tab (domain/tournamentTimeline.ts) on a tournament page.' },
  { key: 'pitch_map', name: 'Pitch Map', tier: 'premium',
    description: 'components/charts/PitchMap.tsx only, on both the match page and a player’s career analysis tab. Wagon Wheel (the adjacent chart in both places) is not on the paid list and stays free.' },
  { key: 'partnership_analytics', name: 'Partnership analytics', tier: 'premium',
    description: 'The full per-innings partnership breakdown in components/charts/MatchInsights.tsx (ROADMAP_V5 Slice A2).' },
  { key: 'performance_charts', name: 'Performance charts', tier: 'premium',
    description: "A match's run/wicket progression chart, components/charts/MatchGraphs.tsx." },
  { key: 'tournament_comparison', name: 'Tournament comparison', tier: 'premium',
    description: 'Also covers the separately-listed "Comparison views": CompareTournamentsPage, CompareSeasonsPage, and CompareClubsPage. Not ComparePage.tsx (player-vs-player), which is explicitly free.' },
  { key: 'sponsor_showcase', name: 'Sponsor showcase', tier: 'premium',
    description: "Also covers the separately-listed \"Sponsor banners\": a tournament's Tournament.sponsors display on its public page. Gated on the tournament owner's plan, not the viewer's — a free visitor should still see a paying owner's sponsors." },
  { key: 'club_activity_feeds', name: 'Club activity feeds', tier: 'premium',
    description: "The <ActivityFeed> instance on ClubPage.tsx specifically. The same shared component on Player/Team/Tournament/Season/Dashboard pages is not on the paid list and stays free. Gated on the club owner's plan." },
  { key: 'embeddable_widgets', name: 'Embeddable match widgets', tier: 'premium',
    description: 'The <EmbedButton> on a match page that lets a viewer get an embeddable widget for it.' },
  { key: 'match_photo_galleries', name: 'Match photo galleries', tier: 'premium',
    description: "A match's <MatchGallery>. Gated on the match owner's plan." },
  { key: 'tournament_media', name: 'Tournament media', tier: 'premium',
    description: 'Also covers the separately-listed "Tournament galleries" and "Tournament photos" (same <EntityGallery> instance on a tournament page) and "Photo management" (the same component’s own upload/delete controls — there is no separate photo-management surface). Gated on the tournament owner’s plan.' },
  { key: 'follow_seasons', name: 'Follow seasons', tier: 'premium',
    description: 'The <FollowButton kind="seasons"> instance on a season’s public page specifically. The same button following players/teams/tournaments/clubs is not on the paid list and stays free.' },
  { key: 'tournament_branding', name: 'Tournament branding', tier: 'premium',
    description: "A tournament's banner image (Tournament.bannerURL) display on its public page. Gated on the tournament owner's plan; the form field to set it is left unrestricted (see this key's write-up in ROADMAP_V5_PLATFORM.md for why)." },
  { key: 'tournament_announcements', name: 'Tournament announcements', tier: 'premium',
    description: "A tournament's <AnnouncementsPanel>. Gated on the tournament owner's plan." },
  { key: 'fixtures_calendar', name: 'Fixtures calendar', tier: 'premium',
    description: 'The <AddToCalendarButton> on a match page (domain/calendarExport.ts). Distinct from the Fixtures & Results tab itself, which is core/free.' },
  { key: 'data_export', name: 'Data export', tier: 'premium',
    description: 'CSV/JSON export buttons on match, player, and tournament pages (domain/matchExport.ts, playerExport.ts, tournamentExport.ts). Not domain/platformExport.ts, which is the master-admin-only platform backup tool in Platform Tools — a different, already-privileged surface, not a paid viewer feature.' },

  // ---- Defined only: no existing implementation to gate, per instruction not to build fake
  // placeholder functionality. Each has a real, findable reason nothing was found. ----
  { key: 'unlimited_tournaments', name: 'Unlimited tournaments', tier: 'premium',
    description: 'No tournament-count limit exists anywhere in the codebase today for any tier — nothing to gate until a free-tier limit is actually implemented.' },
  { key: 'unlimited_seasons', name: 'Seasons', tier: 'premium',
    description: 'Interpreted as the unlimited-count counterpart to "Unlimited tournaments" (paired items in the source list). No season-count limit exists today.' },
  { key: 'shareable_statistics', name: 'Shareable statistics', tier: 'premium',
    description: 'The existing <ShareButton> (share/copy-link) is generic core infrastructure used on every entity page, not a distinct "shareable statistics" feature, and must not be gated. No distinct stat-sharing feature (e.g. a shareable stat-card image) exists to gate instead.' },
  { key: 'media_storage_allowance', name: 'Media storage above the free allowance', tier: 'premium',
    description: 'No storage quota/allowance is enforced anywhere today — uploads are unlimited for every tier. Nothing to gate until a quota exists.' },
  { key: 'tournament_documents', name: 'Tournament documents', tier: 'premium',
    description: 'No document-attachment feature exists for tournaments (or for teams — see "Team documents" in the free list, also unbuilt, but explicitly permission-controlled rather than premium whenever it is built).' },
  { key: 'custom_urls', name: 'Custom URLs', tier: 'premium',
    description: 'No vanity/custom URL slug feature exists — every entity is addressed by its Firestore doc id today.' },
  { key: 'seo_enhancements', name: 'SEO enhancements', tier: 'premium',
    description: 'useDocumentMeta() (page title/meta description) is automatic infrastructure applied identically to every page for every tier, not a discretionary feature — gating it would remove free users’ existing SEO, not add a paid one. No distinct, user-configurable SEO feature (e.g. custom per-page meta tags) exists to gate instead.' },
  { key: 'advanced_reports', name: 'Advanced reports', tier: 'premium',
    description: 'No distinct "reports" feature exists separate from the CSV/JSON exports already covered by data_export and the stats pages themselves. Kept as its own key rather than merged into data_export in case a real, separate reports feature is built later.' },
  { key: 'api_access', name: 'API access', tier: 'premium',
    description: 'This app has no public API of its own — only direct Firestore reads/writes through the client SDK, gated by firestore.rules, not by an API layer that could be entitlement-checked.' },
  { key: 'custom_domains', name: 'Custom domains', tier: 'premium',
    description: 'No custom-domain support exists or could exist purely client-side — real DNS/hosting infrastructure this project has no backend to provide.' },
]

export function getPremiumFeature(key: string): PremiumFeatureDef | undefined {
  return PREMIUM_FEATURES.find((f) => f.key === key)
}

/** The plan a subscription actually grants right now. A canceled/past-due/missing subscription
 *  always resolves to 'free', regardless of what `tier` says — `tier` records what was purchased,
 *  `status` records whether that purchase is currently in force. */
export function effectiveTier(sub: Subscription | null | undefined): PlanTier {
  if (!sub) return 'free'
  if (sub.status !== 'active') return 'free'
  return sub.tier
}

/**
 * Whether `sub` grants access to the feature registered under `featureKey`. An unregistered key
 * (the common case today, since `PREMIUM_FEATURES` starts empty) always returns `true` — there's
 * nothing to gate against yet, so a `<PremiumGate>` placed around a not-yet-registered feature is a
 * no-op rather than an accidental lockout.
 */
export function hasEntitlement(
  sub: Subscription | null | undefined,
  featureKey: string,
): boolean {
  if (!getPremiumFeature(featureKey)) return true
  return effectiveTier(sub) === 'premium'
}
