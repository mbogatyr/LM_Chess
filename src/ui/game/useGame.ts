import { useCallback, useMemo, useState } from 'react'
import { legalMoves, move, newGame as engineNewGame } from '../../engine/game'
import type { GameState, PromotionPiece, SquareName } from '../../engine/types'
import { nameToRC } from './chessDemo'

export type LegalTarget = { to: SquareName; capture: boolean }
export type PendingPromotion = { from: SquareName; to: SquareName } | null

export type UseGame = {
  state: GameState
  selected: SquareName | null
  legalTargets: LegalTarget[]
  pendingPromotion: PendingPromotion
  onSquareClick: (sq: SquareName) => void
  choosePromotion: (p: PromotionPiece) => void
  cancelPromotion: () => void
  newGame: () => void
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState>(() => engineNewGame())
  const [selected, setSelected] = useState<SquareName | null>(null)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion>(null)

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
    [state, selected, pendingPromotion],
  )

  const choosePromotion = useCallback(
    (p: PromotionPiece) => {
      if (!pendingPromotion) return
      const next = move(state, {
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: p,
      })
      if (next) setState(next)
      setPendingPromotion(null)
      setSelected(null)
    },
    [state, pendingPromotion],
  )

  const cancelPromotion = useCallback(() => setPendingPromotion(null), [])

  const newGame = useCallback(() => {
    setState(engineNewGame())
    setSelected(null)
    setPendingPromotion(null)
  }, [])

  return {
    state,
    selected,
    legalTargets,
    pendingPromotion,
    onSquareClick,
    choosePromotion,
    cancelPromotion,
    newGame,
  }
}
