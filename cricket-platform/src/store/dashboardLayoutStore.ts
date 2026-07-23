import { create } from 'zustand'

/* Local-only dashboard widget layout (order + visibility). Mirrors favStore/savedFiltersStore's
 * localStorage-only pattern — this is a personal display preference, not data worth syncing
 * cross-device via Firestore like appearance prefs are. */

export type DashboardWidget = 'live' | 'recent' | 'activity' | 'upcoming' | 'topRuns' | 'topWickets'
export type DashboardColumn = 'left' | 'right'

const LEFT_DEFAULT: DashboardWidget[] = ['live', 'recent', 'activity']
const RIGHT_DEFAULT: DashboardWidget[] = ['upcoming', 'topRuns', 'topWickets']

interface Layout {
  left: DashboardWidget[]
  right: DashboardWidget[]
  hidden: DashboardWidget[]
}

const DEFAULT_LAYOUT: Layout = { left: LEFT_DEFAULT, right: RIGHT_DEFAULT, hidden: [] }

const STORAGE_KEY = 'crickethub.dashboardLayout'

function load(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        left: parsed.left ?? LEFT_DEFAULT,
        right: parsed.right ?? RIGHT_DEFAULT,
        hidden: parsed.hidden ?? [],
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT
}

function save(layout: Layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* ignore */
  }
}

interface DashboardLayoutState {
  layout: Layout
  moveWidget: (col: DashboardColumn, key: DashboardWidget, dir: -1 | 1) => void
  toggleHidden: (key: DashboardWidget) => void
  reset: () => void
}

export const useDashboardLayoutStore = create<DashboardLayoutState>((set, get) => ({
  layout: load(),
  moveWidget: (col, key, dir) => {
    const layout = { ...get().layout }
    const list = [...layout[col]]
    const idx = list.indexOf(key)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return
    ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]
    layout[col] = list
    save(layout)
    set({ layout })
  },
  toggleHidden: (key) => {
    const layout = { ...get().layout }
    layout.hidden = layout.hidden.includes(key)
      ? layout.hidden.filter((k) => k !== key)
      : [...layout.hidden, key]
    save(layout)
    set({ layout })
  },
  reset: () => {
    save(DEFAULT_LAYOUT)
    set({ layout: DEFAULT_LAYOUT })
  },
}))
