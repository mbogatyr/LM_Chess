import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { legalMoves, move, newGame as engineNewGame } from '../../engine/game'
import type { GameState, PromotionPiece, SquareName } from '../../engine/types'
import { selectMove as realSelectMove } from '../../llm/selectMove'
import { LMStudioError } from '../../llm/types'
import {
  appendGame,
  type EndReason,
  type MatchResult,
} from '../history/gameHistory'
import { nameToRC } from './chessDemo'
import { formatClock, useChessClock } from './useChessClock'

export type LegalTarget = { to: SquareName; capture: boolean }
export type PendingPromotion = { from: SquareName; to: SquareName } | null

export type UseGameOptions = {
  baseUrl: string
  model: string
  elo: number
  // test seams (defaults are the real dependency / production backoff)
  selectMoveFn?: typeof realSelectMove
  retryDelays?: number[]
  initialClockMs?: number
  opponentName?: string
}

export type UseGame = {
  state: GameState
  selected: SquareName | null
  legalTargets: LegalTarget[]
  pendingPromotion: PendingPromotion
  thinking: boolean
  connectionError: string | null
  lastMoveFallback: boolean
  whiteClock: string
  blackClock: string
  outcome: {
    over: boolean
    result: MatchResult | null
    reason: EndReason | null
  }
  onSquareClick: (sq: SquareName) => void
  choosePromotion: (p: PromotionPiece) => void
  cancelPromotion: () => void
  retryModelTurn: () => void
  resign: () => void
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
  const [resigned, setResigned] = useState(false)
  // True only during the auto-retry backoff sleep — pauses the model's clock
  // so an infrastructure hiccup doesn't burn its time.
  const [retrying, setRetrying] = useState(false)
  const recordedRef = useRef(false)

  // Bumped on newGame / unmount so stale async results are ignored.
  const generation = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const humansTurn = state.turn === 'w'

  // Both clocks are live and symmetric. White ticks on its live turn; Black
  // (the model) ticks while it is genuinely thinking — but pauses on
  // infrastructure (the connection-error banner and the retry backoff) so a
  // server hiccup doesn't burn its time. The model can flag → the human wins.
  const engineOver = state.status.isGameOver
  const whiteRunning =
    state.turn === 'w' &&
    !engineOver &&
    !resigned &&
    !pendingPromotion &&
    !connectionError
  const blackRunning =
    state.turn === 'b' &&
    thinking &&
    !retrying &&
    !engineOver &&
    !resigned &&
    !connectionError
  const clock = useChessClock({
    turn: state.turn,
    running: whiteRunning || blackRunning,
    initialMs: opts.initialClockMs,
  })
  const flagged = clock.flagged

  const outcome = useMemo((): UseGame['outcome'] => {
    const s = state.status
    if (s.isCheckmate) {
      return {
        over: true,
        result: s.result === 'white' ? 'win' : 'loss',
        reason: 'checkmate',
      }
    }
    if (s.isDraw) {
      return {
        over: true,
        result: 'draw',
        reason: s.drawReason ?? 'insufficient-material',
      }
    }
    if (resigned) return { over: true, result: 'loss', reason: 'resignation' }
    if (flagged === 'w')
      return { over: true, result: 'loss', reason: 'timeout' }
    if (flagged === 'b') return { over: true, result: 'win', reason: 'timeout' }
    return { over: false, result: null, reason: null }
  }, [state.status, resigned, flagged])

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
      if (outcome.over) return
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
      // Re-clicking the selected piece deselects it (turns off highlighting).
      const own = piece && piece.color === state.turn
      setSelected(own && sq !== selected ? sq : null)
    },
    [
      state,
      selected,
      pendingPromotion,
      thinking,
      connectionError,
      humansTurn,
      outcome.over,
    ],
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

  const resign = useCallback(() => {
    if (state.status.isGameOver) return
    generation.current += 1
    abortRef.current?.abort()
    setThinking(false)
    setResigned(true)
  }, [state.status.isGameOver])

  const newGame = useCallback(() => {
    generation.current += 1
    abortRef.current?.abort()
    setState(engineNewGame())
    setSelected(null)
    setPendingPromotion(null)
    setThinking(false)
    setConnectionError(null)
    setLastMoveFallback(false)
    setResigned(false)
    setRetrying(false)
    recordedRef.current = false
    clock.reset()
  }, [clock])

  // Stop the model's turn the instant its clock flags: abort the in-flight
  // request and drop `thinking` so the game settles as a timeout win.
  useEffect(() => {
    if (flagged !== 'b') return
    generation.current += 1
    abortRef.current?.abort()
    setThinking(false)
    setRetrying(false)
  }, [flagged])

  // Drive the model's (Black's) turn whenever it is Black to move.
  useEffect(() => {
    if (state.turn !== 'b') return
    if (state.status.isGameOver) return
    if (resigned || flagged) return
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
            setRetrying(true)
            await sleep(retryDelays[attempt])
            setRetrying(false)
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
    resigned,
    flagged,
  ])

  // Record each finished game exactly once (guarded so re-renders don't
  // double-write). Reset on newGame via recordedRef.
  useEffect(() => {
    if (!outcome.over || recordedRef.current) return
    recordedRef.current = true
    appendGame({
      id: crypto.randomUUID(),
      endedAt: Date.now(),
      opponent: opts.opponentName?.trim() || model.trim() || 'Local model',
      elo,
      plies: state.history.length,
      result: outcome.result as MatchResult,
      reason: outcome.reason as EndReason,
    })
  }, [outcome, opts.opponentName, model, elo, state.history.length])

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
    whiteClock: formatClock(clock.whiteMs),
    blackClock: formatClock(clock.blackMs),
    outcome,
    onSquareClick,
    choosePromotion,
    cancelPromotion,
    retryModelTurn,
    resign,
    newGame,
  }
}
