import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
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
