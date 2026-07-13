import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Screen =
  'onb-connect' | 'onb-models' | 'onb-elo' | 'game' | 'history'

const STORAGE_KEY = 'nocturne-chess'

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeElo(elo: number): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStore(), elo }))
}

type AppStateValue = {
  screen: Screen
  setScreen: (s: Screen) => void
  elo: number
  setElo: (n: number) => void
}
const AppStateContext = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('onb-connect')
  const [elo, setEloState] = useState<number>(() => {
    const stored = readStore().elo
    return typeof stored === 'number' ? stored : 1000
  })
  const setElo = useCallback((n: number) => {
    setEloState(n)
    writeElo(n)
  }, [])
  const value = useMemo(
    () => ({ screen, setScreen, elo, setElo }),
    [screen, elo, setElo],
  )
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider')
  }
  return ctx
}
