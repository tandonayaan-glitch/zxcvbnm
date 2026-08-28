import { create } from 'zustand'
import type { Role, UserProfile } from '@/types'
import {
  observeAuth,
  login as loginSvc,
  logout as logoutSvc,
  registerUser,
} from '@/services/auth.service'
import { isFirebaseConfigured } from '@/lib/firebase'
import { usePrefsStore } from '@/store/prefsStore'

type Status = 'initializing' | 'ready'

interface AuthState {
  status: Status
  profile: UserProfile | null
  initialized: boolean
  init: () => void
  login: (username: string, password: string) => Promise<UserProfile>
  signup: (input: {
    username: string
    password: string
    displayName: string
    role?: Role
  }) => Promise<UserProfile>
  logout: () => Promise<void>
  setProfile: (p: UserProfile | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initializing',
  profile: null,
  initialized: false,

  init: () => {
    if (get().initialized) return
    set({ initialized: true })
    if (!isFirebaseConfigured) {
      set({ status: 'ready', profile: null })
      return
    }
    observeAuth((profile) => {
      set({ profile, status: 'ready' })
      // Pull/seed this user's cross-device preferences (or stop syncing on sign-out).
      void usePrefsStore.getState().syncUser(profile?.id ?? null)
    })
  },

  login: async (username, password) => {
    const profile = await loginSvc(username, password)
    set({ profile, status: 'ready' })
    return profile
  },

  signup: async (input) => {
    const profile = await registerUser(input)
    set({ profile, status: 'ready' })
    return profile
  },

  logout: async () => {
    await logoutSvc()
    set({ profile: null })
  },

  setProfile: (p) => set({ profile: p }),
}))

/* -------------------- Role / permission helpers -------------------- */

export function hasRole(profile: UserProfile | null, ...roles: Role[]): boolean {
  if (!profile) return false
  // The master admin has full access — it satisfies every role requirement.
  if (profile.role === 'MASTER_ADMIN') return true
  return roles.includes(profile.role)
}

/** The single top-level account. Full permissions, manages users. */
export const isMasterAdmin = (p: UserProfile | null) =>
  hasRole(p, 'MASTER_ADMIN')

/** Master admin or a normal admin. */
export const isAdmin = (p: UserProfile | null) =>
  hasRole(p, 'MASTER_ADMIN', 'ADMIN')

export const canManage = (p: UserProfile | null) =>
  hasRole(p, 'MASTER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'TOURNAMENT_MANAGER')

export const canScore = (p: UserProfile | null) =>
  hasRole(p, 'MASTER_ADMIN', 'ADMIN', 'SCORER', 'TOURNAMENT_MANAGER')

export const canManagePlayers = (p: UserProfile | null) =>
  hasRole(p, 'MASTER_ADMIN', 'ADMIN', 'TEAM_MANAGER')

/**
 * Whether this profile can create a player/team under their own ownership — mirrors
 * `firestore.rules`' `canBuildRoster()` exactly. Narrower than granting SCORER full
 * `canManagePlayers`/`canManage` (clubs/seasons and editing/deleting someone else's
 * row stay off-limits) but wide enough that a fresh self-signup (always SCORER) can
 * actually build the roster a new match needs, not just watch.
 */
export const canBuildRoster = (p: UserProfile | null) =>
  hasRole(p, 'MASTER_ADMIN', 'ADMIN', 'TEAM_MANAGER', 'TOURNAMENT_MANAGER', 'SCORER')

export const canManageTournaments = (p: UserProfile | null) =>
  hasRole(p, 'MASTER_ADMIN', 'ADMIN', 'TOURNAMENT_MANAGER')

/**
 * Whether this profile can *create* a new tournament — narrower than
 * `canManageTournaments`. Mirrors `firestore.rules`' `canCreateTournament()`
 * exactly: the master admin bypasses everything, otherwise ADMIN/TOURNAMENT_MANAGER.
 * This is a UX convenience only; the rule above is the real gate.
 */
export const canCreateTournament = (p: UserProfile | null) =>
  isMasterAdmin(p) || hasRole(p, 'ADMIN', 'TOURNAMENT_MANAGER')

/**
 * Owner-scoping for "fully isolated" admins: the master admin sees everything;
 * a normal admin only sees rows they own. Returns the uid to filter by, or
 * `null` to mean "no filter" (see all).
 */
export function ownerScope(p: UserProfile | null): string | null {
  if (!p) return null
  if (p.role === 'MASTER_ADMIN') return null
  return p.id
}

/** Can this profile manage (edit/delete) an owned row? */
export function ownsOrMaster(
  p: UserProfile | null,
  ownerId?: string | null,
): boolean {
  if (!p) return false
  if (p.role === 'MASTER_ADMIN') return true
  return !!ownerId && ownerId === p.id
}
