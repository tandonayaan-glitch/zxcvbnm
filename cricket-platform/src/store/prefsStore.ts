import { create } from 'zustand'

export type TextScale = 'small' | 'normal' | 'large' | 'xlarge'
export type Density = 'comfortable' | 'compact'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface Prefs {
  textScale: TextScale
  reducedMotion: boolean
  density: Density
  highContrast: boolean
  theme: ThemeMode
}

const STORAGE_KEY = 'crickethub.prefs'

const DEFAULT_PREFS: Prefs = {
  textScale: 'normal',
  reducedMotion: false,
  density: 'comfortable',
  highContrast: false,
  theme: 'system',
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
}

// Live-follow the OS theme while the user has picked "system" — re-applying
// prefs on every OS change so the media query is the only place this lives.
darkMediaQuery?.addEventListener('change', () => {
  const { prefs } = usePrefsStore.getState()
  if (prefs.theme === 'system') applyPrefs(prefs)
})

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
function schedulePush(uid: string, prefs: Prefs) {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    // Lazy import to avoid a store→service→firebase cycle at module load.
    import('@/services/userPrefs.service')
      .then((m) => m.saveRemotePrefs(uid, prefs))
      .catch(() => {
        /* offline / permission — local prefs still apply */
      })
  }, 600)
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
        const prefs = { ...DEFAULT_PREFS, ...remote }
        save(prefs)
        applyPrefs(prefs)
        setState({ prefs })
      } else {
        // First sign-in on this account — seed remote from what's on this device.
        await saveRemotePrefs(uid, get().prefs)
      }
    } catch {
      /* offline / not configured — keep local prefs */
    }
  },
}))
