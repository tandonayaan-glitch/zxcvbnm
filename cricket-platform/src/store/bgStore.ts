import { create } from 'zustand'

export type BgMode = 'default' | 'solid' | 'gradient'
export type BgTone = 'default' | 'live' | 'upcoming' | 'completed'

export interface BgConfig {
  mode: BgMode
  solid: string
  stops: string[]
  angle: number
}

const STORAGE_KEY = 'crickethub.bg'

export const DEFAULT_BG: BgConfig = {
  mode: 'default',
  solid: '#f1f5f9',
  stops: ['#eff6ff', '#f8fafc', '#f0fdf4'],
  angle: 135,
}

export const BG_PRESETS: { name: string; config: BgConfig }[] = [
  { name: 'Pitch', config: { mode: 'gradient', solid: '#f0fdf4', stops: ['#ecfccb', '#f0fdf4', '#dbeafe'], angle: 135 } },
  { name: 'Sunset', config: { mode: 'gradient', solid: '#fff7ed', stops: ['#fef3c7', '#fde2e4', '#ede9fe'], angle: 120 } },
  { name: 'Ocean', config: { mode: 'gradient', solid: '#eff6ff', stops: ['#dbeafe', '#e0f2fe', '#cffafe'], angle: 150 } },
  { name: 'Midnight', config: { mode: 'gradient', solid: '#0f172a', stops: ['#0f172a', '#1e293b', '#312e81'], angle: 135 } },
  { name: 'Slate', config: { mode: 'solid', solid: '#f1f5f9', stops: ['#f1f5f9'], angle: 135 } },
]

function load(): BgConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_BG, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_BG
}

function save(cfg: BgConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    /* ignore */
  }
}

interface BgState {
  config: BgConfig
  tone: BgTone
  setConfig: (patch: Partial<BgConfig>) => void
  setStop: (index: number, color: string) => void
  addStop: () => void
  removeStop: (index: number) => void
  applyPreset: (cfg: BgConfig) => void
  reset: () => void
  setTone: (tone: BgTone) => void
}

export const useBgStore = create<BgState>((set, get) => ({
  config: load(),
  tone: 'default',
  setConfig: (patch) => {
    const config = { ...get().config, ...patch }
    save(config)
    set({ config })
  },
  setStop: (index, color) => {
    const stops = [...get().config.stops]
    stops[index] = color
    get().setConfig({ stops })
  },
  addStop: () => {
    const stops = [...get().config.stops]
    if (stops.length >= 5) return
    stops.push(stops[stops.length - 1] ?? '#ffffff')
    get().setConfig({ stops, mode: 'gradient' })
  },
  removeStop: (index) => {
    const stops = get().config.stops.filter((_, i) => i !== index)
    get().setConfig({ stops: stops.length ? stops : ['#ffffff'] })
  },
  applyPreset: (cfg) => {
    save(cfg)
    set({ config: cfg })
  },
  reset: () => {
    save(DEFAULT_BG)
    set({ config: DEFAULT_BG })
  },
  setTone: (tone) => set({ tone }),
}))

/** Build the CSS background string for the current config. */
export function bgToCss(cfg: BgConfig): string {
  if (cfg.mode === 'solid') return cfg.solid
  if (cfg.mode === 'gradient') {
    const stops = cfg.stops.length >= 2 ? cfg.stops : [...cfg.stops, cfg.stops[0]]
    return `linear-gradient(${cfg.angle}deg, ${stops.join(', ')})`
  }
  // default
  return `linear-gradient(${DEFAULT_BG.angle}deg, ${DEFAULT_BG.stops.join(', ')})`
}

/** Perceived (relative) luminance of a #rrggbb / #rgb hex colour, 0 (black) - 1 (white). */
function hexLuminance(hex: string): number | null {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Average luminance of a background config's colour(s) — used to decide how
 * much to darken it in dark mode. A config that's already dark (e.g. the
 * "Midnight" preset) needs little to no extra darkening; a light pastel one
 * needs a lot. Unparseable/custom values fall back to "assume light" (1) so
 * they still get darkened rather than silently skipped.
 */
export function configLuminance(cfg: BgConfig): number {
  const colors = cfg.mode === 'solid' ? [cfg.solid] : cfg.stops.length ? cfg.stops : [cfg.solid]
  const values = colors.map((c) => hexLuminance(c) ?? 1)
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Accent colour for the soft glow blobs, shifted by match-state tone. */
export function toneAccent(tone: BgTone): { a: string; b: string } {
  switch (tone) {
    case 'live':
      return { a: 'rgba(239,68,68,0.18)', b: 'rgba(245,158,11,0.16)' }
    case 'upcoming':
      return { a: 'rgba(59,130,246,0.16)', b: 'rgba(34,197,94,0.12)' }
    case 'completed':
      return { a: 'rgba(100,116,139,0.14)', b: 'rgba(100,116,139,0.10)' }
    default:
      return { a: 'rgba(59,130,246,0.14)', b: 'rgba(34,197,94,0.14)' }
  }
}
