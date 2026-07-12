/* ==================================================================
 * Duplicate player detection — pure fuzzy-name matching over the
 * players already in the system, so an admin doesn't have to already
 * suspect two specific names before opening the merge tool. This is
 * the "duplicate detection" half of the roadmap's "import + duplicate
 * detection" item; the "import" half needs a source format nothing in
 * this project defines, so it's intentionally left out here.
 * ================================================================== */
import type { Player } from '@/types'

/** Forgiving normalisation, matching the convention used by /recover. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j], dp[j - 1])
      prevDiag = temp
    }
  }
  return dp[n]
}

/** 0 (nothing alike) to 1 (identical after normalising). */
function similarity(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  return 1 - levenshtein(na, nb) / maxLen
}

export interface DuplicateCandidate {
  playerAId: string
  playerBId: string
  /** 0-1, the higher of the full-name and display-name similarity. */
  similarity: number
  /** Both players currently share at least one team — a stronger signal. */
  sameTeam: boolean
}

const SIMILARITY_THRESHOLD = 0.75

/**
 * Every pair of active players whose names are similar enough to plausibly
 * be the same person entered twice, sorted most-similar first. O(n^2) over
 * the player list, which is fine at the scale this app runs at (never a
 * background job, only run on-demand from the merge tool).
 */
export function findDuplicateCandidates(players: Player[]): DuplicateCandidate[] {
  const active = players.filter((p) => p.active)
  const out: DuplicateCandidate[] = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      const nameSim = Math.max(
        similarity(a.fullName, b.fullName),
        similarity(a.displayName, b.displayName),
      )
      if (nameSim < SIMILARITY_THRESHOLD) continue
      const sameTeam = a.teamIds.some((t) => b.teamIds.includes(t))
      out.push({ playerAId: a.id, playerBId: b.id, similarity: nameSim, sameTeam })
    }
  }
  return out.sort((x, y) => y.similarity - x.similarity)
}
