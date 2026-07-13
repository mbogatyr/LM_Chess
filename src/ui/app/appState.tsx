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

export type BoardStyle = 'mono' | 'contrast' | 'accent'
export type PieceStyle = 'neon' | 'flat' | 'outline'

const STORAGE_KEY = 'nocturne-chess'

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function persist(patch: Record<string, unknown>): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...readStore(), ...patch }),
  )
}

type AppStateValue = {
  screen: Screen
  setScreen: (s: Screen) => void
  elo: number
  setElo: (n: number) => void
  boardStyle: BoardStyle
  setBoardStyle: (s: BoardStyle) => void
  pieceStyle: PieceStyle
  setPieceStyle: (s: PieceStyle) => void
}
const AppStateContext = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('onb-connect')
  const [elo, setEloState] = useState<number>(() => {
    const stored = readStore().elo
    return typeof stored === 'number' ? stored : 1000
  })
  const [boardStyle, setBoardStyleState] = useState<BoardStyle>(() =>
    readStore().boardStyle === 'contrast' || readStore().boardStyle === 'accent'
      ? (readStore().boardStyle as BoardStyle)
      : 'mono',
  )
  const [pieceStyle, setPieceStyleState] = useState<PieceStyle>(() =>
    readStore().pieceStyle === 'flat' || readStore().pieceStyle === 'outline'
      ? (readStore().pieceStyle as PieceStyle)
      : 'neon',
  )
  const setElo = useCallback((n: number) => {
    setEloState(n)
    persist({ elo: n })
  }, [])
  const setBoardStyle = useCallback((s: BoardStyle) => {
    setBoardStyleState(s)
    persist({ boardStyle: s })
  }, [])
  const setPieceStyle = useCallback((s: PieceStyle) => {
    setPieceStyleState(s)
    persist({ pieceStyle: s })
  }, [])
  const value = useMemo(
    () => ({
      screen,
      setScreen,
      elo,
      setElo,
      boardStyle,
      setBoardStyle,
      pieceStyle,
      setPieceStyle,
    }),
    [screen, elo, setElo, boardStyle, setBoardStyle, pieceStyle, setPieceStyle],
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
