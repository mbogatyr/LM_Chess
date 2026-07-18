import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { newGame, move } from '../../engine/game'
import { HintUnavailableError } from '../../llm/hint'
import { LMStudioError } from '../../llm/types'
import { useHint } from './useHint'
import type { getHint, Hint } from '../../llm/hint'

const HINT: Hint = {
  san: 'e4',
  from: 'e2',
  to: 'e4',
  pieceType: 'p',
  idea: 'Grab the centre.',
}
const resolving = (h: Hint): typeof getHint => vi.fn(async () => h)

const base = (over: Partial<Parameters<typeof useHint>[0]> = {}) => ({
  baseUrl: 'http://x',
  model: 'm',
  elo: 1200,
  state: newGame(),
  enabled: true,
  getHintFn: resolving(HINT),
  ...over,
})

test('the first reveal fetches a hint and sets the level', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  expect(result.current.level).toBe(1)
  expect(o.getHintFn).toHaveBeenCalledTimes(1)
})

test('switching level with a hint present does not refetch', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  act(() => result.current.reveal(3))
  expect(result.current.level).toBe(3)
  expect(result.current.hintMove).toEqual({ from: 'e2', to: 'e4' })
  expect(o.getHintFn).toHaveBeenCalledTimes(1)
})

test('hintMove is null below level 3', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(2))
  await waitFor(() => expect(result.current.level).toBe(2))
  expect(result.current.hintMove).toBeNull()
})

test('refresh fetches a new hint', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  act(() => result.current.refresh())
  await waitFor(() => expect(o.getHintFn).toHaveBeenCalledTimes(2))
})

test('a position change clears the hint', async () => {
  const o = base()
  const { result, rerender } = renderHook((p) => useHint(p), {
    initialProps: o,
  })
  act(() => result.current.reveal(3))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  rerender(base({ state: move(newGame(), 'e4')!, getHintFn: o.getHintFn }))
  expect(result.current.hint).toBeNull()
  expect(result.current.level).toBe(0)
})

test('disabling clears the hint', async () => {
  const o = base()
  const { result, rerender } = renderHook((p) => useHint(p), {
    initialProps: o,
  })
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  rerender(base({ enabled: false, getHintFn: o.getHintFn }))
  expect(result.current.hint).toBeNull()
})

test('HintUnavailableError and LMStudioError set errorKind', async () => {
  const unavailable = renderHook(() =>
    useHint(
      base({
        getHintFn: vi.fn(async () => {
          throw new HintUnavailableError()
        }),
      }),
    ),
  )
  act(() => unavailable.result.current.reveal(1))
  await waitFor(() =>
    expect(unavailable.result.current.errorKind).toBe('unavailable'),
  )

  const conn = renderHook(() =>
    useHint(
      base({
        getHintFn: vi.fn(async () => {
          throw new LMStudioError('network', 'down')
        }),
      }),
    ),
  )
  act(() => conn.result.current.reveal(1))
  await waitFor(() => expect(conn.result.current.errorKind).toBe('connection'))
})

test('a hint resolving after a position change is discarded', async () => {
  let resolveFn: (h: Hint) => void = () => {}
  const getHintFn = vi.fn(
    () =>
      new Promise<Hint>((r) => {
        resolveFn = r
      }),
  ) as unknown as typeof getHint
  const o = base({ getHintFn })
  const { result, rerender } = renderHook((p) => useHint(p), {
    initialProps: o,
  })
  act(() => result.current.reveal(1)) // fetch starts, promise stays pending
  // position changes while the fetch is still in flight
  rerender(base({ state: move(newGame(), 'e4')!, getHintFn }))
  await act(async () => {
    resolveFn(HINT) // the stale fetch resolves now
    await Promise.resolve()
  })
  expect(result.current.hint).toBeNull()
  expect(result.current.level).toBe(0)
})
