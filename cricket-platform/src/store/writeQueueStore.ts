import { create } from 'zustand'

export type QueuedWriteStatus = 'pending' | 'synced' | 'failed'

export interface QueuedWrite {
  id: string
  label: string
  status: QueuedWriteStatus
  createdAt: number
  settledAt?: number
}

interface WriteQueueState {
  writes: QueuedWrite[]
  track: (label: string) => string
  resolve: (id: string, status: 'synced' | 'failed') => void
}

let seq = 0
const SYNCED_RETENTION_MS = 8_000

/**
 * App-level write-queue visibility: this app's own record of the writes it
 * has issued and whether each has been acknowledged, keyed to each write's
 * own commit promise. This is deliberately NOT a view into the Firestore
 * client SDK's internal offline mutation queue — that queue is private and
 * has no public enumeration API. What this tracks is real (an entry appears
 * the moment a write is issued and clears only when that exact write's
 * promise settles), just scoped to writes this app instruments rather than
 * every Firestore operation everywhere.
 */
export const useWriteQueueStore = create<WriteQueueState>((set, get) => ({
  writes: [],
  track: (label) => {
    const id = `w${++seq}_${Date.now()}`
    set((s) => ({ writes: [...s.writes, { id, label, status: 'pending', createdAt: Date.now() }] }))
    return id
  },
  resolve: (id, status) => {
    set((s) => ({
      writes: s.writes.map((w) => (w.id === id ? { ...w, status, settledAt: Date.now() } : w)),
    }))
    if (status === 'synced') {
      setTimeout(() => {
        set((s) => ({ writes: s.writes.filter((w) => w.id !== id) }))
      }, SYNCED_RETENTION_MS)
    }
  },
}))

/** Wrap a write's commit promise so it shows up in the write-queue panel
 * from the moment it's issued until it's acknowledged (or fails). */
export function trackedWrite<T>(label: string, promise: Promise<T>): Promise<T> {
  const { track, resolve } = useWriteQueueStore.getState()
  const id = track(label)
  return promise.then(
    (v) => {
      resolve(id, 'synced')
      return v
    },
    (e) => {
      resolve(id, 'failed')
      throw e
    },
  )
}
