import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { formatClock, useChessClock } from './useChessClock'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('formatClock renders mm:ss and clamps negatives', () => {
  expect(formatClock(600_000)).toBe('10:00')
  expect(formatClock(65_000)).toBe('1:05')
  expect(formatClock(-5)).toBe('0:00')
})

test('the side to move ticks down while running', () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: true, initialMs: 10_000 }),
  )
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current.whiteMs).toBe(9_000)
  expect(result.current.blackMs).toBe(10_000)
})

test('the clock is frozen when not running', () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: false, initialMs: 10_000 }),
  )
  act(() => vi.advanceTimersByTime(2_000))
  expect(result.current.whiteMs).toBe(10_000)
})

test("White flags when White's time reaches zero", () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: true, initialMs: 500 }),
  )
  expect(result.current.flagged).toBeNull()
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current.whiteMs).toBe(0)
  expect(result.current.flagged).toBe('w')
})

test("Black flags when Black's time reaches zero", () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'b', running: true, initialMs: 500 }),
  )
  expect(result.current.flagged).toBeNull()
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current.blackMs).toBe(0)
  expect(result.current.flagged).toBe('b')
})

test('reset restores both clocks and clears the flag', () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: true, initialMs: 500 }),
  )
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current.flagged).toBe('w')
  act(() => result.current.reset())
  expect(result.current.whiteMs).toBe(500)
  expect(result.current.flagged).toBeNull()
})
