import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { move } from '../../engine/game'
import { LMStudioError } from '../../llm/types'
import { loadGames } from '../history/gameHistory'
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

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

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

test('re-clicking the selected piece deselects it', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBe('e2')
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBeNull()
  expect(result.current.legalTargets).toEqual([])
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

test('newGame while the model is thinking discards the late result', async () => {
  let resolveMove: () => void = () => {}
  const deferred: typeof selectMove = ({ state }) =>
    new Promise((resolve) => {
      resolveMove = () =>
        resolve({ nextState: move(state, 'e5')!, san: 'e5', source: 'model' })
    })
  const o = opts({ selectMoveFn: deferred })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4')) // Black to move -> deferred turn starts
  expect(result.current.thinking).toBe(true)
  act(() => result.current.newGame()) // aborts + bumps generation
  await act(async () => {
    resolveMove() // the aborted turn resolves late
    await Promise.resolve()
  })
  expect(result.current.state.history).toEqual([]) // stale Black move NOT applied to fresh board
  expect(result.current.thinking).toBe(false)
})

test('auto-retries on connection error with backoff, then recovers', async () => {
  const reply = scriptedOpponent(['e5'])
  let calls = 0
  const flaky: typeof selectMove = (p) => {
    calls++
    if (calls <= 2) return Promise.reject(new LMStudioError('network', 'down'))
    return reply(p)
  }
  const o = opts({ selectMoveFn: flaky, retryDelays: [1, 1] })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() =>
    expect(result.current.state.history).toEqual(['e4', 'e5']),
  )
  expect(result.current.connectionError).toBeNull()
  expect(calls).toBe(3) // 1 initial + 2 auto-retries (retryDelays.length === 2)
})

test('both clocks are composed and start at 10:00', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  expect(result.current.whiteClock).toBe('10:00')
  expect(result.current.blackClock).toBe('10:00')
})
// (Tick-down mechanics are covered non-flakily in useChessClock.test.ts with
// fake timers; asserting the mm:ss string changes here would race the ~1s
// second-boundary against waitFor's default timeout.)

test('resign ends the game as a loss and records it once', async () => {
  const o = opts({ opponentName: 'Test Bot', elo: 1234 })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.resign())
  expect(result.current.outcome).toEqual({
    over: true,
    result: 'loss',
    reason: 'resignation',
  })
  await waitFor(() => expect(loadGames()).toHaveLength(1))
  const [rec] = loadGames()
  expect(rec.result).toBe('loss')
  expect(rec.reason).toBe('resignation')
  expect(rec.opponent).toBe('Test Bot')
  expect(rec.elo).toBe(1234)
})

test('White flagging on time is a recorded loss', async () => {
  // tiny clock so White flags almost immediately
  const o = opts({ initialClockMs: 200 })
  const { result } = renderHook(() => useGame(o))
  await waitFor(() => expect(result.current.outcome.reason).toBe('timeout'))
  expect(result.current.outcome.result).toBe('loss')
  await waitFor(() => expect(loadGames()).toHaveLength(1))
  expect(loadGames()[0].reason).toBe('timeout')
})

test('the model flagging on time is a win for the human, recorded once', async () => {
  // idle opponent keeps Black "thinking"; a tiny clock flags it quickly
  const o = opts({ selectMoveFn: idleOpponent, initialClockMs: 300 })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  // Black's clock ticks down while thinking and flags → the human wins
  await waitFor(() => expect(result.current.outcome.over).toBe(true), {
    timeout: 2000,
  })
  expect(result.current.outcome.result).toBe('win')
  expect(result.current.outcome.reason).toBe('timeout')
  expect(result.current.thinking).toBe(false)
  expect(result.current.blackClock).toBe('0:00')
  await waitFor(() => expect(loadGames()).toHaveLength(1))
  expect(loadGames()[0].result).toBe('win')
  expect(loadGames()[0].reason).toBe('timeout')
})

test('the model clock pauses while a connection error is shown', async () => {
  const failing: typeof selectMove = () =>
    Promise.reject(new LMStudioError('network', 'down'))
  const o = opts({
    selectMoveFn: failing,
    retryDelays: [],
    initialClockMs: 300,
  })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() => expect(result.current.connectionError).toBe('down'))
  // wait past the 300ms budget: a paused clock means no flag, game not over
  await act(async () => {
    await new Promise((r) => setTimeout(r, 450))
  })
  expect(result.current.outcome.over).toBe(false)
})

test('the model clock pauses during the auto-retry backoff', async () => {
  const reply = scriptedOpponent(['e5'])
  let first = true
  const flaky: typeof selectMove = (p) => {
    if (first) {
      first = false
      return Promise.reject(new LMStudioError('network', 'down'))
    }
    return reply(p)
  }
  // 400ms backoff > 300ms budget: if the clock ticked during backoff Black
  // would flag. It pauses, so the retry lands and Black plays e5.
  const o = opts({
    selectMoveFn: flaky,
    retryDelays: [400],
    initialClockMs: 300,
  })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(
    () => expect(result.current.state.history).toEqual(['e4', 'e5']),
    { timeout: 2000 },
  )
  expect(result.current.outcome.over).toBe(false)
})

test('starting a new game after finishing does not double-record', async () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.resign())
  await waitFor(() => expect(loadGames()).toHaveLength(1))
  act(() => result.current.newGame())
  expect(result.current.outcome.over).toBe(false)
  expect(result.current.whiteClock).toBe('10:00')
  // abandoning the fresh game (New Game again) records nothing new
  act(() => result.current.newGame())
  expect(loadGames()).toHaveLength(1)
})

test('the human cannot move after resigning', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.resign())
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBeNull()
})
