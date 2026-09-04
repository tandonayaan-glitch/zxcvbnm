/* Pure filter/sort helpers for the Discovery engine — no I/O. */
import type { Player, Team, Club, Tournament } from '@/types'

export interface DiscoveryFilters {
  query?: string
  location?: string
  skillLevel?: Player['skillLevel'] | 'any'
  role?: Player['role'] | 'any'
}

const norm = (s: string | undefined | null) => (s ?? '').toLowerCase().trim()

export function filterPlayers(players: Player[], f: DiscoveryFilters): Player[] {
  const q = norm(f.query)
  return players.filter((p) => {
    if (!p.active || p.deletedAt) return false
    if (q && !norm(p.displayName).includes(q) && !norm(p.fullName).includes(q)) return false
    if (f.location && f.location !== 'any' && !norm(p.location).includes(norm(f.location))) return false
    if (f.skillLevel && f.skillLevel !== 'any' && p.skillLevel !== f.skillLevel) return false
    if (f.role && f.role !== 'any' && p.role !== f.role) return false
    return true
  })
}

export function filterTeams(teams: Team[], query: string): Team[] {
  const q = norm(query)
  return teams.filter((t) => !t.deletedAt && (!q || norm(t.name).includes(q) || norm(t.shortName).includes(q)))
}

export function filterClubs(clubs: Club[], query: string): Club[] {
  const q = norm(query)
  return clubs.filter((c) => !c.deletedAt && (!q || norm(c.name).includes(q)))
}

export function filterTournaments(tournaments: Tournament[], query: string): Tournament[] {
  const q = norm(query)
  return tournaments.filter((t) => !t.deletedAt && (!q || norm(t.name).includes(q)))
}
