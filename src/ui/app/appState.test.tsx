import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AppStateProvider, useAppState } from './appState'
import { eloBand } from './demoData'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
)

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('starts on the connect screen with default elo', () => {
  const { result } = renderHook(() => useAppState(), { wrapper })
  expect(result.current.screen).toBe('onb-connect')
  expect(result.current.elo).toBe(1000)
})

test('setScreen and setElo update and elo persists', () => {
  const { result } = renderHook(() => useAppState(), { wrapper })
  act(() => result.current.setScreen('onb-models'))
  expect(result.current.screen).toBe('onb-models')
  act(() => result.current.setElo(1300))
  expect(result.current.elo).toBe(1300)
  expect(JSON.parse(localStorage.getItem('nocturne-chess')!).elo).toBe(1300)
})

test('eloBand picks the band by upper bound', () => {
  expect(eloBand(500).ru[0]).toBe('Новичок')
  expect(eloBand(1000).ru[0]).toBe('Уверенный')
  expect(eloBand(1500).en[0]).toBe('Candidate')
})
