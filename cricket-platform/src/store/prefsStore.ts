import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { NotificationCategory } from '@/types'

export type TextScale = 'small' | 'normal' | 'large' | 'xlarge'
export type Density = 'comfortable' | 'compact'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface Prefs {
  textScale: TextScale
  reducedMotion: boolean
  density: Density
  highContrast: boolean
  theme: ThemeMode
  colorBlind: boolean
  /** Notification categories the user has muted — still recorded, just hidden from the bell/panel. */
  notifyMuted: NotificationCategory[]
  /** Opted into beta/experimental features — gates `betaOnly` feature flags. */
  betaFeatures: boolean
  /** The user ticked "Don't show again" in the welcome tutorial — it no longer auto-opens for
   *  them on any device (still replayable from the header Help button). Per-user because it
   *  syncs through `userPrefs/{uid}` like every other pref here. */
  tutorialDismissed: boolean
}

const STORAGE_KEY = 'crickethub.prefs'

const DEFAULT_PREFS: Prefs = {
  textScale: 'normal',
  reducedMotion: false,
  density: 'comfortable',
  highContrast: false,
  theme: 'system',
  colorBlind: false,
  notifyMuted: [],
  betaFeatures: false,
  tutorialDismissed: false,
}

const SCALE_PX: Record<TextScale, string> = {
  small: '15px',
  normal: '16px',
  large: '18px',
  xlarge: '20px',
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS
}

function save(p: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

const darkMediaQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return darkMediaQuery?.matches ?? false
}

/** Apply preferences to the document root (fonts, motion, contrast, density, theme). */
export function applyPrefs(p: Prefs) {
  const root = document.documentElement
  root.style.fontSize = SCALE_PX[p.textScale]
  root.classList.toggle('reduce-motion', p.reducedMotion)
  root.classList.toggle('high-contrast', p.highContrast)
  root.classList.toggle('density-compact', p.density === 'compact')
  root.classList.toggle('dark', resolveDark(p.theme))
  root.classList.toggle('colorblind', p.colorBlind)
}

// Live-follow the OS theme while the user has picked "system" — re-applying
// prefs on every OS change so the media query is the only place this lives.
darkMediaQuery?.addEventListener('change', () => {
  const { prefs } = usePrefsStore.getState()
  if (prefs.theme === 'system') applyPrefs(prefs)
})

/** The theme actually in effect right now (resolves "system" via the OS
 * preference), for components that render differently for light vs dark
 * rather than just relying on the `dark:` CSS variant. */
export function useResolvedDark(): boolean {
  const theme = usePrefsStore((s) => s.prefs.theme)
  const [systemDark, setSystemDark] = useState(() => darkMediaQuery?.matches ?? false)
  useEffect(() => {
    if (!darkMediaQuery) return
    const onChange = () => setSystemDark(darkMediaQuery.matches)
    darkMediaQuery.addEventListener('change', onChange)
    return () => darkMediaQuery.removeEventListener('change', onChange)
  }, [])
  return theme === 'system' ? systemDark : theme === 'dark'
}

interface PrefsState {
  prefs: Prefs
  /** uid whose prefs we mirror to Firestore, or null when signed out. */
  syncUid: string | null
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  reset: () => void
  /**
   * Called on auth changes. When a user signs in we pull their saved prefs
   * (remote wins so settings follow them across devices); if they have none
   * yet, we seed the remote doc from the local prefs. `null` stops syncing.
   */
  syncUser: (uid: string | null) => Promise<void>
}

// Debounced remote write so rapid toggles don't hammer Firestore.
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pendingPush: { uid: string; prefs: Prefs } | null = null

function doPush(uid: string, prefs: Prefs) {
  // Lazy import to avoid a store→service→firebase cycle at module load.
  import('@/services/userPrefs.service')
    .then((m) => m.saveRemotePrefs(uid, prefs))
    .catch(() => {
      /* offline / permission — local prefs still apply */
    })
}

function schedulePush(uid: string, prefs: Prefs) {
  pendingPush = { uid, prefs }
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    const p = pendingPush
    pendingPush = null
    if (p) doPush(p.uid, p.prefs)
  }, 600)
}

/** Fire any debounced remote write immediately. Without this, ticking "Don't show this again"
 *  and then closing the tab within 600ms would drop the write, so the choice never reaches
 *  `userPrefs/{uid}` and the tutorial re-auto-opens on the next device / after a cache clear. */
function flushPush() {
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  const p = pendingPush
  pendingPush = null
  if (p) doPush(p.uid, p.prefs)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPush()
  })
}

export const usePrefsStore = create<PrefsState>((setState, get) => ({
  prefs: load(),
  syncUid: null,
  set: (key, value) => {
    const prefs = { ...get().prefs, [key]: value }
    save(prefs)
    applyPrefs(prefs)
    setState({ prefs })
    const uid = get().syncUid
    if (uid) schedulePush(uid, prefs)
  },
  reset: () => {
    save(DEFAULT_PREFS)
    applyPrefs(DEFAULT_PREFS)
    setState({ prefs: DEFAULT_PREFS })
    const uid = get().syncUid
    if (uid) schedulePush(uid, DEFAULT_PREFS)
  },
  syncUser: async (uid) => {
    setState({ syncUid: uid })
    if (!uid) return
    try {
      const { getRemotePrefs, saveRemotePrefs } = await import(
        '@/services/userPrefs.service'
      )
      const remote = await getRemotePrefs(uid)
      if (remote) {
        const local = get().prefs
        const prefs = { ...DEFAULT_PREFS, ...remote }
        // `tutorialDismissed` is a one-way latch: once the user has dismissed the welcome
        // tutorial on any device it must stay dismissed everywhere. A remote doc written
        // before this field existed has it `undefined`, which would otherwise reset a
        // local `true` back to `false` and make the tutorial re-appear. OR the two and
        // heal the remote doc.
        prefs.tutorialDismissed = Boolean(remote.tutorialDismissed) || local.tutorialDismissed
        save(prefs)
        applyPrefs(prefs)
        setState({ prefs })
        if (prefs.tutorialDismissed && !remote.tutorialDismissed) {
          saveRemotePrefs(uid, prefs).catch(() => {})
        }
      } else {
        // First sign-in on this account — seed remote from what's on this device.
        await saveRemotePrefs(uid, get().prefs)
      }
    } catch {
      /* offline / not configured — keep local prefs */
    }
  },
}))
