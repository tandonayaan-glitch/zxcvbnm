import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, pruneUndefined } from '@/lib/collections'
import { logAudit } from './audit.service'
import type { FeatureFlag, UserProfile } from '@/types'

const flagsCol = () => collection(db, COL.featureFlags)

export async function listFlags(): Promise<FeatureFlag[]> {
  const snap = await getDocs(flagsCol())
  return snap.docs.map((d) => d.data() as FeatureFlag).sort((a, b) => a.key.localeCompare(b.key))
}

export interface FlagInput {
  key: string
  name: string
  description?: string
  enabled: boolean
  rolloutPercent: number
  betaOnly: boolean
}

/** Create or fully replace a flag (doc id == key). */
export async function upsertFlag(input: FlagInput, actor: UserProfile | null): Promise<void> {
  const flag: FeatureFlag = {
    id: input.key,
    ...input,
    updatedAt: Date.now(),
    updatedBy: actor?.id ?? null,
  }
  await setDoc(doc(flagsCol(), input.key), pruneUndefined(flag))
  await logAudit(actor, 'featureFlag.save', `${input.key} → enabled=${input.enabled}, rollout=${input.rolloutPercent}%, beta=${input.betaOnly}`)
}

/** Emergency disable — flips `enabled` off without touching rollout/beta settings. */
export async function disableFlag(flag: FeatureFlag, actor: UserProfile | null): Promise<void> {
  await upsertFlag({ ...flag, enabled: false }, actor)
}

export async function deleteFlag(key: string, actor: UserProfile | null): Promise<void> {
  await deleteDoc(doc(flagsCol(), key))
  await logAudit(actor, 'featureFlag.delete', key)
}
