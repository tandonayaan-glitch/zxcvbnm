import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { listTeams } from './teams.service'
import { listAllMatches } from './matches.service'
import { getPlayer } from './players.service'
import { logAudit } from './audit.service'
import { recomputeAllStats } from './stats.service'
import type { BatterCard, BowlerCard, FallOfWicket, InningsState, UserProfile } from '@/types'

const BATCH_LIMIT = 400

function swap<T extends string | null | undefined>(id: T, from: string, into: string): T {
  return id === from ? (into as T) : id
}

/**
 * Rewrites every reference to `mergeId` across teams, matches (squads, innings
 * cards, deliveries) to `keepId`, then deletes the merged-away player and its
 * cached stats doc. Stats are recomputed from source-of-truth match data
 * afterwards rather than patched in place, since `aggregatePlayerStats` is the
 * single place that knows how to derive them.
 */
export async function mergePlayers(
  actor: UserProfile | null,
  keepId: string,
  mergeId: string,
): Promise<void> {
  if (keepId === mergeId) throw new Error('Cannot merge a player into itself')

  const [keepPlayer, mergePlayer] = await Promise.all([getPlayer(keepId), getPlayer(mergeId)])
  if (!keepPlayer) throw new Error('Player to keep not found')
  if (!mergePlayer) throw new Error('Player to merge not found')

  const [teams, matches] = await Promise.all([listTeams(), listAllMatches()])

  let batch = writeBatch(db)
  let ops = 0
  async function flushIfFull() {
    if (ops >= BATCH_LIMIT) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }
  function queue(ref: Parameters<typeof batch.update>[0], data: object) {
    batch.update(ref, pruneUndefined(data))
    ops++
  }

  for (const team of teams) {
    if (!team.playerIds.includes(mergeId)) continue
    const playerIds = [...new Set(team.playerIds.map((id) => (id === mergeId ? keepId : id)))]
    queue(doc(db, COL.teams, team.id), {
      playerIds,
      captainId: swap(team.captainId, mergeId, keepId),
      viceCaptainId: swap(team.viceCaptainId, mergeId, keepId),
    })
    await flushIfFull()
  }

  for (const match of matches) {
    let touched = false

    const squadA = match.squadA.includes(mergeId)
      ? match.squadA.map((id) => (id === mergeId ? keepId : id))
      : match.squadA
    const squadB = match.squadB.includes(mergeId)
      ? match.squadB.map((id) => (id === mergeId ? keepId : id))
      : match.squadB
    if (squadA !== match.squadA || squadB !== match.squadB) touched = true

    const playerOfTheMatchId = swap(match.playerOfTheMatchId, mergeId, keepId)
    if (playerOfTheMatchId !== match.playerOfTheMatchId) touched = true

    const innings: InningsState[] = match.innings.map((inn) => {
      let innTouched = false

      const battingCard: BatterCard[] = inn.battingCard.map((c) => {
        if (c.playerId !== mergeId && c.bowlerId !== mergeId && c.fielderId !== mergeId) return c
        innTouched = true
        return {
          ...c,
          playerId: swap(c.playerId, mergeId, keepId),
          bowlerId: swap(c.bowlerId, mergeId, keepId),
          fielderId: swap(c.fielderId, mergeId, keepId),
        }
      })
      const bowlingCard: BowlerCard[] = inn.bowlingCard.map((c) => {
        if (c.playerId !== mergeId) return c
        innTouched = true
        return { ...c, playerId: keepId }
      })
      const fallOfWickets: FallOfWicket[] = inn.fallOfWickets.map((f) => {
        if (f.batterOutId !== mergeId) return f
        innTouched = true
        return { ...f, batterOutId: keepId }
      })
      const strikerId = swap(inn.strikerId, mergeId, keepId)
      const nonStrikerId = swap(inn.nonStrikerId, mergeId, keepId)
      const bowlerId = swap(inn.bowlerId, mergeId, keepId)
      const lastBowlerId = swap(inn.lastBowlerId, mergeId, keepId)
      if (
        strikerId !== inn.strikerId ||
        nonStrikerId !== inn.nonStrikerId ||
        bowlerId !== inn.bowlerId ||
        lastBowlerId !== inn.lastBowlerId
      ) {
        innTouched = true
      }

      if (!innTouched) return inn
      touched = true
      return { ...inn, battingCard, bowlingCard, fallOfWickets, strikerId, nonStrikerId, bowlerId, lastBowlerId }
    })

    if (touched) {
      queue(doc(db, COL.matches, match.id), { squadA, squadB, playerOfTheMatchId, innings })
      await flushIfFull()
    }

    const deliveriesSnap = await getDocs(collection(db, COL.matches, match.id, 'deliveries'))
    for (const d of deliveriesSnap.docs) {
      const data = d.data() as {
        strikerId?: string
        nonStrikerId?: string
        bowlerId?: string
        wicket?: { outBatterId?: string; fielderId?: string | null } | null
      }
      const wicketTouched =
        !!data.wicket && (data.wicket.outBatterId === mergeId || data.wicket.fielderId === mergeId)
      if (
        data.strikerId !== mergeId &&
        data.nonStrikerId !== mergeId &&
        data.bowlerId !== mergeId &&
        !wicketTouched
      ) {
        continue
      }
      const patch: Record<string, unknown> = {
        strikerId: swap(data.strikerId, mergeId, keepId),
        nonStrikerId: swap(data.nonStrikerId, mergeId, keepId),
        bowlerId: swap(data.bowlerId, mergeId, keepId),
      }
      if (data.wicket) {
        patch.wicket = {
          ...data.wicket,
          outBatterId: swap(data.wicket.outBatterId, mergeId, keepId),
          fielderId: swap(data.wicket.fielderId, mergeId, keepId),
        }
      }
      queue(d.ref, patch)
      await flushIfFull()
    }
  }

  const keepTeamIds = [...new Set([...(keepPlayer.teamIds ?? []), ...(mergePlayer.teamIds ?? [])])]
  queue(doc(db, COL.players, keepId), { teamIds: keepTeamIds, updatedAt: Date.now() })

  batch.delete(doc(db, COL.playerStats, mergeId))
  batch.delete(doc(db, COL.players, mergeId))
  ops += 2

  await batch.commit()

  await recomputeAllStats()

  await logAudit(
    actor,
    'player.merge',
    `Merged player "${mergePlayer.fullName}" (${mergeId}) into "${keepPlayer.fullName}" (${keepId})`,
  )
}
