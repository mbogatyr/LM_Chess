import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, SquareName } from '../../engine/types'
import {
  getHint as realGetHint,
  HintUnavailableError,
  type Hint,
} from '../../llm/hint'
import { LMStudioError } from '../../llm/types'
import type { HintLevel } from './chessDemo'

export type HintErrorKind = 'unavailable' | 'connection'

export type UseHint = {
  level: HintLevel
  hint: Hint | null
  loading: boolean
  errorKind: HintErrorKind | null
  hintMove: { from: SquareName; to: SquareName } | null
  reveal: (lv: HintLevel) => void
  refresh: () => void
}

export function useHint(opts: {
  baseUrl: string
  model: string
  elo: number
  state: GameState
  enabled: boolean
  getHintFn?: typeof realGetHint
}): UseHint {
  const getHintFn = opts.getHintFn ?? realGetHint
  const { baseUrl, model, elo, state, enabled } = opts

  const [level, setLevel] = useState<HintLevel>(0)
  const [hint, setHint] = useState<Hint | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorKind, setErrorKind] = useState<HintErrorKind | null>(null)

  // Bumped on clear/unmount so stale async results are ignored.
  const generation = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // A hint is position-specific: drop it whenever the position changes or
  // hints become unavailable (not the human's live turn).
  useEffect(() => {
    generation.current += 1
    abortRef.current?.abort()
    setLevel(0)
    setHint(null)
    setLoading(false)
    setErrorKind(null)
  }, [state.fen, enabled])

  useEffect(
    () => () => {
      generation.current += 1
      abortRef.current?.abort()
    },
    [],
  )

  const fetchHint = useCallback(
    (lv: HintLevel) => {
      const myGen = (generation.current += 1)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setErrorKind(null)
      getHintFn({ baseUrl, model, state, elo, signal: controller.signal })
        .then((h) => {
          if (myGen !== generation.current) return
          setHint(h)
          setLevel(lv)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (myGen !== generation.current) return
          setLoading(false)
          if (err instanceof LMStudioError) setErrorKind('connection')
          else if (err instanceof HintUnavailableError)
            setErrorKind('unavailable')
          else throw err
        })
    },
    [baseUrl, model, elo, state, getHintFn],
  )

  const reveal = useCallback(
    (lv: HintLevel) => {
      if (!enabled || lv === 0) return
      if (hint) {
        setLevel(lv)
        return
      }
      if (loading) return
      fetchHint(lv)
    },
    [enabled, hint, loading, fetchHint],
  )

  const refresh = useCallback(() => {
    if (!enabled) return
    setHint(null)
    fetchHint(level === 0 ? 1 : level)
  }, [enabled, level, fetchHint])

  const hintMove = level === 3 && hint ? { from: hint.from, to: hint.to } : null

  return { level, hint, loading, errorKind, hintMove, reveal, refresh }
}
