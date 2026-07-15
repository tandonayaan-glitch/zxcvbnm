import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COL, SETTINGS_DOC } from '@/lib/collections'
import { defaultScorecardConfig } from '@/lib/defaults'
import type { AppSettings } from '@/types'

function defaults(): AppSettings {
  return {
    appName: 'CricketHub',
    defaultScorecardConfig: defaultScorecardConfig(),
    defaultPublicMatches: true,
    defaultOvers: 20,
    trashRetentionDays: 30,
    updatedAt: Date.now(),
  }
}

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(doc(db, COL.settings, SETTINGS_DOC))
  if (snap.exists()) return { ...defaults(), ...(snap.data() as AppSettings) }
  return defaults()
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings()
  await setDoc(doc(db, COL.settings, SETTINGS_DOC), {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  })
}
