import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { legalMoves, move, newGame as engineNewGame } from '../../engine/game'
import type { GameState, PromotionPiece, SquareName } from '../../engine/types'
import { selectMove as realSelectMove } from '../../llm/selectMove'
import { LMStudioError } from '../../llm/types'
import { nameToRC } from './chessDemo'

export type LegalTarget = { to: SquareName; capture: boolean }
export type PendingPromotion = { from: SquareName; to: SquareName } | null

export type UseGameOptions = {
  baseUrl: string
  model: string
  elo: number
  // test seams (defaults are the real dependency / production backoff)
  selectMoveFn?: typeof realSelectMove
  retryDelays?: number[]
}

export type UseGame = {
  state: GameState
  selected: SquareName | null
  legalTargets: LegalTarget[]
  pendingPromotion: PendingPromotion
  thinking: boolean
  connectionError: string | null
  lastMoveFallback: boolean
  onSquareClick: (sq: SquareName) => void
  choosePromotion: (p: PromotionPiece) => void
  cancelPromotion: () => void
  retryModelTurn: () => void
  newGame: () => void
}

const DEFAULT_RETRY_DELAYS = [400, 800]

export function useGame(opts: UseGameOptions): UseGame {
  const { baseUrl, model, elo } = opts
  const selectMoveFn = opts.selectMoveFn ?? realSelectMove
  const retryDelays = opts.retryDelays ?? DEFAULT_RETRY_DELAYS

  const [state, setState] = useState<GameState>(() => engineNewGame())
  const [selected, setSelected] = useState<SquareName | null>(null)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion>(null)
  const [thinking, setThinking] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [lastMoveFallback, setLastMoveFallback] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  // Bumped on newGame / unmount so stale async results are ignored.
  const generation = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const humansTurn = state.turn === 'w'

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selected) return []
    return legalMoves(state, selected).map((m) => ({
      to: m.to,
      capture: m.san.includes('x'),
    }))
  }, [state, selected])

  const onSquareClick = useCallback(
    (sq: SquareName) => {
      if (pendingPromotion) return
      if (thinking || connectionError) return
      if (!humansTurn) return
      if (state.status.isGameOver) return
      if (selected) {
        const toSq = legalMoves(state, selected).filter((m) => m.to === sq)
        if (toSq.length > 0) {
          if (toSq.some((m) => m.promotion)) {
            setPendingPromotion({ from: selected, to: sq })
            return
          }
          const next = move(state, { from: selected, to: sq })
          if (next) {
            setLastMoveFallback(false)
            setState(next)
            setSelected(null)
          }
          return
        }
      }
      const [r, c] = nameToRC(sq)
      const piece = state.board[r][c]
      setSelected(piece && piece.color === state.turn ? sq : null)
    },
    [state, selected, pendingPromotion, thinking, connectionError, humansTurn],
  )

  const choosePromotion = useCallback(
    (p: PromotionPiece) => {
      if (!pendingPromotion) return
      const next = move(state, {
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: p,
      })
      if (next) {
        setLastMoveFallback(false)
        setState(next)
      }
      setPendingPromotion(null)
      setSelected(null)
    },
    [state, pendingPromotion],
  )

  const cancelPromotion = useCallback(() => setPendingPromotion(null), [])

  const retryModelTurn = useCallback(() => {
    setConnectionError(null)
    setRetryNonce((n) => n + 1)
  }, [])

  const newGame = useCallback(() => {
    generation.current += 1
    abortRef.current?.abort()
    setState(engineNewGame())
    setSelected(null)
    setPendingPromotion(null)
    setThinking(false)
    setConnectionError(null)
    setLastMoveFallback(false)
  }, [])

  // Drive the model's (Black's) turn whenever it is Black to move.
  useEffect(() => {
    if (state.turn !== 'b') return
    if (state.status.isGameOver) return
    if (connectionError) return

    const myGen = generation.current
    const controller = new AbortController()
    abortRef.current = controller
    let cancelled = false
    const stale = () => cancelled || myGen !== generation.current
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms))

    const run = async () => {
      setThinking(true)
      // one initial attempt + retryDelays.length auto-retries on LMStudioError
      for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
        try {
          const result = await selectMoveFn({
            baseUrl,
            model,
            state,
            elo,
            signal: controller.signal,
          })
          if (stale()) return
          setLastMoveFallback(result.source === 'fallback')
          setState(result.nextState)
          setThinking(false)
          return
        } catch (err) {
          if (stale()) return
          // Only connection failures (LMStudioError) get the retry/banner
          // treatment. Anything else is a programmer error, not a network
          // issue — clear `thinking` and rethrow to surface it loudly rather
          // than masking a bug as a connection problem. (selectMove only ever
          // rejects with LMStudioError, so this path is effectively unreached.)
          if (!(err instanceof LMStudioError)) {
            setThinking(false)
            throw err
          }
          if (attempt < retryDelays.length) {
            await sleep(retryDelays[attempt])
            if (stale()) return
            continue
          }
          setConnectionError(err.message)
          setThinking(false)
          return
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    state,
    connectionError,
    retryNonce,
    baseUrl,
    model,
    elo,
    selectMoveFn,
    retryDelays,
  ])

  // Ignore any in-flight result after unmount.
  useEffect(
    () => () => {
      generation.current += 1
    },
    [],
  )

  return {
    state,
    selected,
    legalTargets,
    pendingPromotion,
    thinking,
    connectionError,
    lastMoveFallback,
    onSquareClick,
    choosePromotion,
    cancelPromotion,
    retryModelTurn,
    newGame,
  }
}
