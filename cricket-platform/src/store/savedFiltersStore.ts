import { create } from 'zustand'

export interface SavedFilter {
  name: string
  filters: Record<string, string>
}

type SavedFiltersMap = Record<string, SavedFilter[]>

const STORAGE_KEY = 'crickethub.savedFilters'

// Stable reference for "no saved filters yet" — a fresh `[]` literal on every call would give
// Zustand's selector a new array identity each render and loop forever re-rendering.
const EMPTY: SavedFilter[] = []

function load(): SavedFiltersMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {}
}

function save(m: SavedFiltersMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

interface SavedFiltersState {
  all: SavedFiltersMap
  list: (pageKey: string) => SavedFilter[]
  saveFilter: (pageKey: string, name: string, filters: Record<string, string>) => void
  removeFilter: (pageKey: string, name: string) => void
}

/**
 * Per-page named filter presets ("My Club", "Current Season"…), local to this browser —
 * mirrors `favStore`'s localStorage-only approach for lightweight personal convenience state
 * that doesn't need cross-device sync.
 */
export const useSavedFiltersStore = create<SavedFiltersState>((set, get) => ({
  all: load(),
  list: (pageKey) => get().all[pageKey] ?? EMPTY,
  saveFilter: (pageKey, name, filters) => {
    const all = { ...get().all }
    const existing = (all[pageKey] ?? []).filter((f) => f.name !== name)
    all[pageKey] = [...existing, { name, filters }]
    save(all)
    set({ all })
  },
  removeFilter: (pageKey, name) => {
    const all = { ...get().all }
    all[pageKey] = (all[pageKey] ?? []).filter((f) => f.name !== name)
    save(all)
    set({ all })
  },
}))
