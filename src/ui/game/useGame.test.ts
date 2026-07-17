import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import { move } from '../../engine/game'
import { LMStudioError } from '../../llm/types'
import { useGame, type UseGameOptions } from './useGame'
import type { selectMove } from '../../llm/selectMove'

// An opponent that never resolves — keeps the model "thinking" so tests that
// only exercise White-side selection stay on White's turn deterministically.
const idleOpponent: typeof selectMove = () => new Promise(() => {})

// A scripted opponent that plays the given Black SAN moves in order.
function scriptedOpponent(blackMoves: string[]): typeof selectMove {
  let i = 0
  return async ({ state }) => {
    const san = blackMoves[i++]
    const next = move(state, san)
    if (!next) throw new Error(`scripted illegal move: ${san}`)
    return { nextState: next, san: next.lastMove?.san ?? '', source: 'model' }
  }
}

// IMPORTANT: build the options object ONCE per test and pass the SAME
// reference into renderHook's callback. renderHook re-invokes that callback on
// every render, so an inline `opts()` would hand useGame a fresh `retryDelays`
// array / `selectMoveFn` each render, changing the effect's dependency
// identities and re-triggering the model turn. A stable object avoids that.
const opts = (over: Partial<UseGameOptions> = {}): UseGameOptions => ({
  baseUrl: 'http://x',
  model: 'm',
  elo: 1200,
  selectMoveFn: idleOpponent,
  retryDelays: [],
  ...over,
})

test('selecting a white pawn lists its legal targets', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBe('e2')
  expect(result.current.legalTargets.map((t) => t.to).sort()).toEqual([
    'e3',
    'e4',
  ])
})

test('clicking a black piece does not select it (white to move)', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e7'))
  expect(result.current.selected).toBeNull()
})

test('after White moves, the model plays Black and the turn returns to White', async () => {
  const o = opts({ selectMoveFn: scriptedOpponent(['e5']) })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() =>
    expect(result.current.state.history).toEqual(['e4', 'e5']),
  )
  expect(result.current.state.turn).toBe('w')
  expect(result.current.thinking).toBe(false)
})

test('the human cannot move while the model is thinking', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4')) // black turn -> idle opponent
  // attempting to select/move is ignored on Black's turn
  act(() => result.current.onSquareClick('d2'))
  expect(result.current.selected).toBeNull()
  expect(result.current.state.history).toEqual(['e4'])
})

test('a connection failure surfaces connectionError, then retry recovers', async () => {
  const reply = scriptedOpponent(['e5'])
  let first = true
  const failing: typeof selectMove = (p) => {
    if (first) {
      first = false
      return Promise.reject(new LMStudioError('network', 'down'))
    }
    return reply(p)
  }
  const o = opts({ selectMoveFn: failing })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() => expect(result.current.connectionError).toBe('down'))
  expect(result.current.thinking).toBe(false)
  act(() => result.current.retryModelTurn())
  await waitFor(() =>
    expect(result.current.state.history).toEqual(['e4', 'e5']),
  )
  expect(result.current.connectionError).toBeNull()
})

test('a fallback move sets lastMoveFallback, cleared on the next human move', async () => {
  const fallbackOpponent: typeof selectMove = async ({ state }) => {
    const next = move(state, 'e5')!
    return { nextState: next, san: 'e5', source: 'fallback' }
  }
  const o = opts({ selectMoveFn: fallbackOpponent })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() => expect(result.current.lastMoveFallback).toBe(true))
  act(() => result.current.onSquareClick('d2'))
  act(() => result.current.onSquareClick('d4'))
  expect(result.current.lastMoveFallback).toBe(false)
})

test('newGame resets state, selection and thinking', async () => {
  const o = opts({ selectMoveFn: scriptedOpponent(['e5']) })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() =>
    expect(result.current.state.history).toEqual(['e4', 'e5']),
  )
  act(() => result.current.newGame())
  expect(result.current.state.history).toEqual([])
  expect(result.current.selected).toBeNull()
  expect(result.current.thinking).toBe(false)
})

test('choosePromotion is a no-op when nothing is pending', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  expect(result.current.pendingPromotion).toBeNull()
  act(() => result.current.choosePromotion('q'))
  expect(result.current.state.history).toEqual([])
})
