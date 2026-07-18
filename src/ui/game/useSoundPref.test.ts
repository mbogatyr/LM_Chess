import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { useSoundPref } from './useSoundPref'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('sound is on by default', () => {
  const { result } = renderHook(() => useSoundPref())
  expect(result.current.muted).toBe(false)
})

test('toggle mutes and persists the choice', () => {
  const { result } = renderHook(() => useSoundPref())
  act(() => result.current.toggle())
  expect(result.current.muted).toBe(true)
  expect(localStorage.getItem('lmchess.sound')).toBe('off')
})

test('a persisted mute is read back as muted', () => {
  localStorage.setItem('lmchess.sound', 'off')
  const { result } = renderHook(() => useSoundPref())
  expect(result.current.muted).toBe(true)
})

test('toggling twice unmutes and clears the persisted flag', () => {
  const { result } = renderHook(() => useSoundPref())
  act(() => result.current.toggle())
  act(() => result.current.toggle())
  expect(result.current.muted).toBe(false)
  expect(localStorage.getItem('lmchess.sound')).not.toBe('off')
})
