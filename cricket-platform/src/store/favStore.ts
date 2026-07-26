import { create } from 'zustand'

export type FavKind = 'players' | 'teams' | 'tournaments' | 'clubs' | 'seasons'

interface Favs {
  players: string[]
  teams: string[]
  tournaments: string[]
  clubs: string[]
  seasons: string[]
}

const STORAGE_KEY = 'crickethub.favs'
const EMPTY: Favs = { players: [], teams: [], tournaments: [], clubs: [], seasons: [] }

function load(): Favs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...EMPTY, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...EMPTY }
}

function save(f: Favs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f))
  } catch {
    /* ignore */
  }
}

interface FavState {
  favs: Favs
  toggle: (kind: FavKind, id: string) => void
  isFav: (kind: FavKind, id: string) => boolean
}

export const useFavStore = create<FavState>((set, get) => ({
  favs: load(),
  toggle: (kind, id) => {
    const cur = get().favs
    const list = cur[kind]
    const next = list.includes(id)
      ? list.filter((x) => x !== id)
      : [...list, id]
    const favs = { ...cur, [kind]: next }
    save(favs)
    set({ favs })
  },
  isFav: (kind, id) => get().favs[kind].includes(id),
}))
