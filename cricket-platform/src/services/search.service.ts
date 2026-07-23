import { listPlayers } from './players.service'
import { listTeams } from './teams.service'
import { listTournaments } from './tournaments.service'
import { listAllMatches } from './matches.service'
import { listClubs } from './clubs.service'
import type { Player, Team, Tournament, Match, Club } from '@/types'

export interface SearchResults {
  players: Player[]
  teams: Team[]
  tournaments: Tournament[]
  matches: Match[]
  clubs: Club[]
}

const norm = (s: string) => s.toLowerCase().trim()

/** Practical client-side global search across the main entities. */
export async function globalSearch(term: string): Promise<SearchResults> {
  const q = norm(term)
  if (!q) return { players: [], teams: [], tournaments: [], matches: [], clubs: [] }

  const [players, teams, tournaments, matches, clubs] = await Promise.all([
    listPlayers(),
    listTeams(),
    listTournaments(),
    listAllMatches(),
    listClubs(),
  ])

  return {
    players: players.filter(
      (p) =>
        norm(p.fullName).includes(q) ||
        norm(p.displayName).includes(q) ||
        (p.shortName ? norm(p.shortName).includes(q) : false),
    ),
    teams: teams.filter(
      (t) => norm(t.name).includes(q) || norm(t.shortName).includes(q),
    ),
    tournaments: tournaments.filter(
      (t) =>
        norm(t.name).includes(q) ||
        (t.shortName ? norm(t.shortName).includes(q) : false),
    ),
    matches: matches.filter(
      (m) =>
        norm(m.title).includes(q) ||
        norm(m.teamA.name).includes(q) ||
        norm(m.teamB.name).includes(q),
    ),
    clubs: clubs.filter(
      (c) => norm(c.name).includes(q) || (c.shortName ? norm(c.shortName).includes(q) : false),
    ),
  }
}
