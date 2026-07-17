import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { SquareName } from '../../engine/types'
import { useGame } from './useGame'

test('selecting a pawn lists its legal targets', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBe('e2')
  const dests = result.current.legalTargets.map((t) => t.to).sort()
  expect(dests).toEqual(['e3', 'e4'])
  expect(result.current.legalTargets.every((t) => t.capture === false)).toBe(
    true,
  )
})

test('clicking a legal target plays the move and flips the turn', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  expect(result.current.state.turn).toBe('b')
  expect(result.current.state.history).toEqual(['e4'])
  expect(result.current.selected).toBeNull()
})

test('clicking an enemy piece does not select it', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e7')) // black pawn, white to move
  expect(result.current.selected).toBeNull()
  expect(result.current.legalTargets).toEqual([])
})

test('a capture target is flagged capture:true', () => {
  const { result } = renderHook(() => useGame())
  // 1. e4 d5 -> white e4 pawn can capture d5
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  act(() => result.current.onSquareClick('d7'))
  act(() => result.current.onSquareClick('d5'))
  act(() => result.current.onSquareClick('e4'))
  const cap = result.current.legalTargets.find((t) => t.to === 'd5')
  expect(cap?.capture).toBe(true)
})

test('newGame resets state, selection and pending promotion', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  act(() => result.current.newGame())
  expect(result.current.state.history).toEqual([])
  expect(result.current.selected).toBeNull()
  expect(result.current.pendingPromotion).toBeNull()
})

test('choosePromotion is a no-op when nothing is pending', () => {
  const { result } = renderHook(() => useGame())
  expect(result.current.pendingPromotion).toBeNull()
  act(() => result.current.choosePromotion('q'))
  expect(result.current.state.history).toEqual([])
})

// A legal 16-ply sequence from the start position (found by scripted search
// over real engine moves, not a crafted FEN) that walks a white pawn to e7
// with a capturing promotion move to d8 available. useGame has no way to
// seed a position directly, so reaching a pendingPromotion state for this
// test means actually playing it out via onSquareClick, same as the UI does.
const movesToPromotionSetup: Array<[SquareName, SquareName]> = [
  ['f2', 'f3'],
  ['g7', 'g6'],
  ['a2', 'a3'],
  ['b8', 'a6'],
  ['a3', 'a4'],
  ['g6', 'g5'],
  ['h2', 'h4'],
  ['b7', 'b6'],
  ['h4', 'g5'],
  ['a6', 'c5'],
  ['g2', 'g3'],
  ['g8', 'f6'],
  ['g5', 'f6'],
  ['c5', 'e6'],
  ['f6', 'e7'],
  ['h7', 'h5'],
]

test('onSquareClick ignores board clicks while a promotion is pending', () => {
  const { result } = renderHook(() => useGame())

  for (const [from, to] of movesToPromotionSetup) {
    act(() => result.current.onSquareClick(from))
    act(() => result.current.onSquareClick(to))
  }

  // Select the e7 pawn, then click d8: exd8 is a promotion, so this should
  // open the picker (pendingPromotion) rather than play the move.
  act(() => result.current.onSquareClick('e7'))
  act(() => result.current.onSquareClick('d8'))

  expect(result.current.pendingPromotion).toEqual({ from: 'e7', to: 'd8' })
  const historyBeforeStrayClick = result.current.state.history
  const selectedBeforeStrayClick = result.current.selected

  // A stray click elsewhere (e.g. the a1 rook) must be a no-op while the
  // promotion picker is conceptually open: it must not change `selected`
  // out from under the still-pending `{from, to}`, and must not move.
  act(() => result.current.onSquareClick('a1'))

  expect(result.current.pendingPromotion).toEqual({ from: 'e7', to: 'd8' })
  expect(result.current.selected).toBe(selectedBeforeStrayClick)
  expect(result.current.state.history).toEqual(historyBeforeStrayClick)
})
