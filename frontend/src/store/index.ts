import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Trip, AnalyticsSummary, TripEvent } from '@/types'

interface AuthStore {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, access: string, refresh: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken)
          localStorage.setItem('refresh_token', refreshToken)
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'tollsense-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

interface TripStore {
  trips: Trip[]
  total: number
  page: number
  summary: AnalyticsSummary | null
  liveEvents: TripEvent[]
  setTrips: (trips: Trip[], total: number, page: number) => void
  setSummary: (summary: AnalyticsSummary) => void
  addLiveEvent: (event: TripEvent) => void
  clearLiveEvents: () => void
}

export const useTripStore = create<TripStore>((set) => ({
  trips: [],
  total: 0,
  page: 1,
  summary: null,
  liveEvents: [],
  setTrips: (trips, total, page) => set({ trips, total, page }),
  setSummary: (summary) => set({ summary }),
  addLiveEvent: (event) =>
    set((state) => ({
      liveEvents: [event, ...state.liveEvents].slice(0, 50),
    })),
  clearLiveEvents: () => set({ liveEvents: [] }),
}))
