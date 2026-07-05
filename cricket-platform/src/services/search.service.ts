import { listPlayers } from './players.service'
import { listTeams } from './teams.service'
import { listTournaments } from './tournaments.service'
import { listAllMatches } from './matches.service'
import type { Player, Team, Tournament, Match } from '@/types'

export interface SearchResults {
  players: Player[]
  teams: Team[]
  tournaments: Tournament[]
  matches: Match[]
}

const norm = (s: string) => s.toLowerCase().trim()

/** Practical client-side global search across the main entities. */
export async function globalSearch(term: string): Promise<SearchResults> {
  const q = norm(term)
  if (!q) return { players: [], teams: [], tournaments: [], matches: [] }

  const [players, teams, tournaments, matches] = await Promise.all([
    listPlayers(),
    listTeams(),
    listTournaments(),
    listAllMatches(),
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
  }
}
