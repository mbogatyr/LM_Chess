import { useCallback, useEffect, useRef, useState } from 'react'
import type { Color } from '../../engine/types'

const TICK_MS = 250
const DEFAULT_INITIAL_MS = 600_000 // 10:00

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export type UseChessClock = {
  whiteMs: number
  blackMs: number
  flagged: 'w' | 'b' | null
  reset: () => void
}

export function useChessClock(opts: {
  turn: Color
  running: boolean
  initialMs?: number
}): UseChessClock {
  const initialMs = opts.initialMs ?? DEFAULT_INITIAL_MS
  const { turn, running } = opts
  const [whiteMs, setWhiteMs] = useState(initialMs)
  const [blackMs, setBlackMs] = useState(initialMs)
  // Wall-clock timestamp of the last accounted tick; null while stopped.
  const lastRef = useRef<number | null>(null)

  const reset = useCallback(() => {
    setWhiteMs(initialMs)
    setBlackMs(initialMs)
    lastRef.current = null
  }, [initialMs])

  useEffect(() => {
    if (!running) {
      lastRef.current = null
      return
    }
    lastRef.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const delta = now - (lastRef.current ?? now)
      lastRef.current = now
      if (turn === 'w') setWhiteMs((ms) => Math.max(0, ms - delta))
      else setBlackMs((ms) => Math.max(0, ms - delta))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [running, turn])

  const flagged: 'w' | 'b' | null =
    whiteMs <= 0 ? 'w' : blackMs <= 0 ? 'b' : null
  return { whiteMs, blackMs, flagged, reset }
}
