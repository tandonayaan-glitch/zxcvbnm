import { useAsync } from './useAsync'
import { listFlags } from '@/services/featureFlags.service'
import { isFlagEnabledFor } from '@/domain/featureFlags'
import { useAuthStore } from '@/store/authStore'
import { usePrefsStore } from '@/store/prefsStore'

/** Whether the named feature flag is on for the current user. A flag that doesn't exist (never
 *  created, or deleted) is treated as off — the safe default for gating unfinished work. */
export function useFeatureFlag(key: string): boolean {
  const flags = useAsync(listFlags, [])
  const uid = useAuthStore((s) => s.profile?.id ?? null)
  const betaOptIn = usePrefsStore((s) => s.prefs.betaFeatures)
  const flag = flags.data?.find((f) => f.key === key)
  if (!flag) return false
  return isFlagEnabledFor(flag, { uid, betaOptIn })
}
