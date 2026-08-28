import type { PlanTier, PremiumFeatureDef, Subscription } from '@/types'

/**
 * Feature registry for premium gating (ROADMAP_V5 Slice C3, populated per the confirmed Free vs
 * Paid registry). Every key below was mapped to its real implementation by auditing the codebase
 * directly — nothing here was guessed. Several paid list entries are intentionally consolidated
 * onto one key where they describe the same underlying implementation from different angles; a
 * few have no existing implementation at all and are registered anyway so `hasEntitlement()` can
 * be checked once the feature is built, but nothing in the UI gates on them yet, per instruction
 * not to build fake placeholder functionality.
 *
 * `description` is CUSTOMER-FACING COPY — `<PremiumGate>`'s fallback card renders it verbatim to
 * real Free-plan visitors. It must never contain a file path, component name, or any other
 * implementation detail; that trace lives in each entry's trailing `//` comment instead; a comment
 * can never render, so it can't leak this way again. Keep new entries to this same shape.
 *
 * `hasEntitlement()` returns `true` for any key not in this list, so registering a key before every
 * one of its call sites is wired is safe — it simply isn't enforced yet.
 */
export const PREMIUM_FEATURES: PremiumFeatureDef[] = [
  // ---- Applied: gated in the UI as of this slice ----
  { key: 'auto_powerplay', name: 'Automatic powerplay calculation', tier: 'premium',
    description: 'Have the powerplay overs filled in for you when you set up a match.' },
    // impl: match setup wizard's "Auto" powerplay option (domain/matchRules.ts). Manual entry stays free.
  { key: 'tournament_statistics', name: 'Tournament statistics', tier: 'premium',
    description: "See a tournament's top run-scorers, top wicket-takers, and records." },
    // impl: a tournament's Leaders + Records tabs on its public page.
  { key: 'season_splits', name: 'Season splits', tier: 'premium',
    description: "See how a player's numbers break down season by season." },
    // impl: domain/playerSplits.ts, on the player's public page.
  { key: 'recent_form_charts', name: 'Recent-form charts', tier: 'premium',
    description: 'See the last few results for a team or player at a glance.' },
    // impl: components/charts/TeamForm.tsx and PlayerForm.tsx.
  { key: 'player_radar', name: 'Player radar', tier: 'premium',
    description: "A visual snapshot of a player's all-round game." },
    // impl: components/charts/PlayerRadar.tsx, on the player's public page.
  { key: 'team_records', name: 'Team records', tier: 'premium',
    description: "A team's best and most notable performances, in one place." },
    // impl: domain/teamRecords.ts "Team records" section, on the team's public page.
  { key: 'records_by_venue', name: 'Records by venue', tier: 'premium',
    description: 'See how a team performs at each ground it plays at.' },
    // impl: domain/teamVenues.ts, on the team's public page.
  { key: 'qualification_tracking', name: 'Qualification tracking', tier: 'premium',
    description: "Track who's through, who's out, and who's still in the running." },
    // impl: Qualification tab (domain/qualification.ts). Distinct from the free Groups tab
    // (domain/groups.ts), which is just the group-stage standings table.
  { key: 'tournament_timeline', name: 'Tournament timeline', tier: 'premium',
    description: 'Every match in the tournament, laid out in order.' },
    // impl: Timeline tab (domain/tournamentTimeline.ts) on a tournament page.
  { key: 'pitch_map', name: 'Pitch Map', tier: 'premium',
    description: 'See exactly where a bowler pitched every ball.' },
    // impl: components/charts/PitchMap.tsx, on both the match page and a player's career tab.
    // Wagon Wheel (the adjacent chart in both places) is not on the paid list and stays free.
  { key: 'partnership_analytics', name: 'Partnership analytics', tier: 'premium',
    description: 'A full breakdown of every batting partnership in the innings.' },
    // impl: components/charts/MatchInsights.tsx (ROADMAP_V5 Slice A2).
  { key: 'performance_charts', name: 'Performance charts', tier: 'premium',
    description: 'Watch how the runs and wickets swung over the course of the match.' },
    // impl: components/charts/MatchGraphs.tsx run/wicket progression chart.
  { key: 'tournament_comparison', name: 'Tournament comparison', tier: 'premium',
    description: 'Compare tournaments, seasons, or clubs side by side.' },
    // impl: CompareTournamentsPage, CompareSeasonsPage, CompareClubsPage. Not ComparePage.tsx
    // (player-vs-player), which is explicitly free.
  { key: 'sponsor_showcase', name: 'Sponsor showcase', tier: 'premium',
    description: "Showcase your tournament's sponsors on its public page." },
    // impl: Tournament.sponsors display. Gated on the tournament owner's plan, not the viewer's —
    // a free visitor should still see a paying owner's sponsors.
  { key: 'club_activity_feeds', name: 'Club activity feeds', tier: 'premium',
    description: "A live feed of everything happening at your club." },
    // impl: <ActivityFeed> on ClubPage.tsx specifically. The same shared component elsewhere
    // (Player/Team/Tournament/Season/Dashboard) is not on the paid list and stays free.
  { key: 'embeddable_widgets', name: 'Embeddable match widgets', tier: 'premium',
    description: 'Embed a live match widget on your own website.' },
    // impl: <EmbedButton> on a match page.
  { key: 'match_photo_galleries', name: 'Match photo galleries', tier: 'premium',
    description: 'Share photos from the match with everyone who follows it.' },
    // impl: <MatchGallery>. Gated on the match owner's plan.
  { key: 'tournament_media', name: 'Tournament media', tier: 'premium',
    description: 'Share photos from across the tournament.' },
    // impl: <EntityGallery> on a tournament page (also covers its own upload/delete controls —
    // there is no separate photo-management surface). Gated on the tournament owner's plan.
  { key: 'follow_seasons', name: 'Follow seasons', tier: 'premium',
    description: 'Follow a season to get updates as it unfolds.' },
    // impl: <FollowButton kind="seasons"> on a season's public page specifically. The same button
    // following players/teams/tournaments/clubs is not on the paid list and stays free.
  { key: 'tournament_branding', name: 'Tournament branding', tier: 'premium',
    description: "Add a custom banner image to your tournament's page." },
    // impl: Tournament.bannerURL display, gated on the owner's plan; the form field to set it is
    // left unrestricted (see this key's write-up in ROADMAP_V5_PLATFORM.md for why).
  { key: 'tournament_announcements', name: 'Tournament announcements', tier: 'premium',
    description: "Post announcements straight to your tournament's public page." },
    // impl: <AnnouncementsPanel>. Gated on the tournament owner's plan.
  { key: 'fixtures_calendar', name: 'Fixtures calendar', tier: 'premium',
    description: 'Add match fixtures straight to your calendar.' },
    // impl: <AddToCalendarButton> (domain/calendarExport.ts). Distinct from the Fixtures &
    // Results tab itself, which is core/free.
  { key: 'data_export', name: 'Data export', tier: 'premium',
    description: 'Export match, player, and tournament data as CSV or JSON.' },
    // impl: domain/matchExport.ts, playerExport.ts, tournamentExport.ts. Not
    // domain/platformExport.ts, the master-admin-only platform backup tool in Platform Tools —
    // a different, already-privileged surface, not a paid viewer feature.

  // ---- Defined only: no existing implementation to gate, per instruction not to build fake
  // placeholder functionality. Each has a real, findable reason nothing was found. ----
  { key: 'unlimited_tournaments', name: 'Unlimited tournaments', tier: 'premium',
    description: 'Run as many tournaments as you like.' },
    // impl: no tournament-count limit exists anywhere today for any tier — nothing to gate until
    // a free-tier limit is actually implemented.
  { key: 'unlimited_seasons', name: 'Unlimited seasons', tier: 'premium',
    description: 'Run as many seasons as you like.' },
    // impl: interpreted as the unlimited-count counterpart to "Unlimited tournaments" (paired
    // items in the source list). No season-count limit exists today.
  { key: 'shareable_statistics', name: 'Shareable statistics', tier: 'premium',
    description: 'Share your stats with a single link.' },
    // impl: the existing <ShareButton> (share/copy-link) is generic core infrastructure used on
    // every entity page, not a distinct feature, and must not be gated. No distinct stat-sharing
    // feature (e.g. a shareable stat-card image) exists to gate instead.
  { key: 'media_storage_allowance', name: 'Extra media storage', tier: 'premium',
    description: 'More room for your photos and match media.' },
    // impl: no storage quota/allowance is enforced anywhere today — uploads are unlimited for
    // every tier. Nothing to gate until a quota exists.
  { key: 'tournament_documents', name: 'Tournament documents', tier: 'premium',
    description: 'Attach a rulebook or fixture sheet to your tournament.' },
    // impl: no document-attachment feature exists for tournaments (or for teams — see "Team
    // documents" in the free list, also unbuilt, but explicitly permission-controlled rather
    // than premium whenever it is built).
  { key: 'custom_urls', name: 'Custom URLs', tier: 'premium',
    description: 'Give your tournament or club a custom web address.' },
    // impl: no vanity/custom URL slug feature exists — every entity is addressed by its
    // Firestore doc id today.
  { key: 'seo_enhancements', name: 'SEO enhancements', tier: 'premium',
    description: 'Better visibility for your pages in search results.' },
    // impl: useDocumentMeta() (page title/meta description) is automatic infrastructure applied
    // identically to every page for every tier, not a discretionary feature — gating it would
    // remove free users' existing SEO, not add a paid one. No distinct, user-configurable SEO
    // feature (e.g. custom per-page meta tags) exists to gate instead.
  { key: 'advanced_reports', name: 'Advanced reports', tier: 'premium',
    description: 'Deeper reports across your matches and tournaments.' },
    // impl: no distinct "reports" feature exists separate from the CSV/JSON exports already
    // covered by data_export and the stats pages themselves. Kept as its own key rather than
    // merged into data_export in case a real, separate reports feature is built later.
  { key: 'api_access', name: 'API access', tier: 'premium',
    description: 'Connect CricketHub to your own tools and scripts.' },
    // impl: this app has no public API of its own — only direct Firestore reads/writes through
    // the client SDK, gated by firestore.rules, not by an API layer that could be
    // entitlement-checked.
  { key: 'custom_domains', name: 'Custom domains', tier: 'premium',
    description: 'Use your own domain name for your CricketHub pages.' },
    // impl: no custom-domain support exists or could exist purely client-side — real DNS/hosting
    // infrastructure this project has no backend to provide.
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
