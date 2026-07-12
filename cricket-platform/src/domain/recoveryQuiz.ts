/* ==================================================================
 * Recovery verification questions — before /recover reveals a
 * username, the requester must answer question(s) only the real
 * player would know, generated from real data (role, team). Pure;
 * the caller supplies decoy pools (other real roles/teams) so this
 * has no I/O of its own.
 * ================================================================== */
import { PLAYER_ROLE_LABELS } from '@/lib/format'
import type { Player, PlayerRole, Team } from '@/types'

export interface RecoveryQuestion {
  key: 'role' | 'team'
  prompt: string
  options: string[]
  correctIndex: number
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function roleQuestion(player: Player): RecoveryQuestion {
  const allRoles = Object.keys(PLAYER_ROLE_LABELS) as PlayerRole[]
  const decoys = allRoles.filter((r) => r !== player.role)
  const options = shuffle([player.role, ...shuffle(decoys).slice(0, 3)])
  return {
    key: 'role',
    prompt: "What's your playing role on CricketHub?",
    options: options.map((r) => PLAYER_ROLE_LABELS[r]),
    correctIndex: options.indexOf(player.role),
  }
}

function teamQuestion(player: Player, teams: Team[]): RecoveryQuestion | null {
  const myTeamId = player.teamIds[0]
  if (!myTeamId) return null
  const myTeam = teams.find((t) => t.id === myTeamId)
  if (!myTeam) return null
  const decoys = teams.filter((t) => !player.teamIds.includes(t.id))
  if (decoys.length < 2) return null
  const options = shuffle([myTeam, ...shuffle(decoys).slice(0, 3)])
  return {
    key: 'team',
    prompt: 'Which team do you play for?',
    options: options.map((t) => t.name),
    correctIndex: options.findIndex((t) => t.id === myTeam.id),
  }
}

/**
 * Builds 1–2 verification questions for a player: a team question when
 * they're on a team and there are enough other real teams to use as
 * decoys, plus a role question (always available — every player has one).
 * Both must be answered correctly.
 */
export function buildRecoveryQuestions(
  player: Player,
  teams: Team[],
): RecoveryQuestion[] {
  const questions: RecoveryQuestion[] = []
  const team = teamQuestion(player, teams)
  if (team) questions.push(team)
  questions.push(roleQuestion(player))
  return questions
}
