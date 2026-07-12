import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { I18nProvider, useI18n } from './i18n'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
)

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('defaults to Russian and translates a key', () => {
  const { result } = renderHook(() => useI18n(), { wrapper })
  expect(result.current.lang).toBe('ru')
  expect(result.current.t('connect_h')).toBe('Подключитесь к LM Studio')
})

test('setLang switches language and persists it', () => {
  const { result } = renderHook(() => useI18n(), { wrapper })
  act(() => result.current.setLang('en'))
  expect(result.current.t('connect_h')).toBe('Connect to LM Studio')
  expect(JSON.parse(localStorage.getItem('nocturne-chess')!).lang).toBe('en')
})

test('reads persisted language on init and preserves other stored keys', () => {
  localStorage.setItem(
    'nocturne-chess',
    JSON.stringify({ lang: 'en', elo: 1200 }),
  )
  const { result } = renderHook(() => useI18n(), { wrapper })
  expect(result.current.lang).toBe('en')
  act(() => result.current.setLang('ru'))
  const stored = JSON.parse(localStorage.getItem('nocturne-chess')!)
  expect(stored.lang).toBe('ru')
  expect(stored.elo).toBe(1200)
})
