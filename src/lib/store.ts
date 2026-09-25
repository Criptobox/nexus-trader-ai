'use client'

// ─────────────────────────────────────────────────────────────
// Store global de la app (zustand)
// · customCoins: monedas añadidas por el usuario (persistidas
//   en localStorage — sobreviven recargas e instalaciones)
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CustomCoin, KillSwitchStatus } from '@/lib/types'

export type ViewId = 'dashboard' | 'markets' | 'agent' | 'portfolio' | 'backtest' | 'risk' | 'knowledge' | 'settings'

interface AppState {
  view: ViewId
  setView: (v: ViewId) => void
  selectedSymbol: string
  setSelectedSymbol: (s: string) => void
  marketSource: 'binance' | 'demo' | 'coingecko' | null
  setMarketSource: (s: 'binance' | 'demo' | 'coingecko' | null) => void
  killSwitch: KillSwitchStatus | null
  setKillSwitch: (k: KillSwitchStatus) => void
  refreshKey: number
  bumpRefresh: () => void
  customCoins: CustomCoin[]
  addCustomCoin: (c: CustomCoin) => void
  removeCustomCoin: (id: string) => void
  isCustomAdded: (id: string) => boolean
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'dashboard',
      setView: (v) => set({ view: v }),
      selectedSymbol: 'BTC',
      setSelectedSymbol: (s) => set({ selectedSymbol: s }),
      marketSource: null,
      setMarketSource: (s) => set({ marketSource: s }),
      killSwitch: null,
      setKillSwitch: (k) => set({ killSwitch: k }),
      refreshKey: 0,
      bumpRefresh: () => set((st) => ({ refreshKey: st.refreshKey + 1 })),

      customCoins: [],
      addCustomCoin: (c) =>
        set((st) =>
          st.customCoins.some((x) => x.id === c.id)
            ? st
            : { customCoins: [...st.customCoins, c] },
        ),
      removeCustomCoin: (id) =>
        set((st) => ({ customCoins: st.customCoins.filter((x) => x.id !== id) })),
      isCustomAdded: (id) => get().customCoins.some((x) => x.id === id),
    }),
    {
      name: 'nexus-custom-coins',
      partialize: (s) => ({ customCoins: s.customCoins }),
    },
  ),
)
