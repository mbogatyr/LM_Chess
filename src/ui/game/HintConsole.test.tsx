import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HintConsole } from './HintConsole'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

test('level 0 shows the empty prompt and no button is pressed', () => {
  render(
    wrap(<HintConsole level={0} onSelect={() => {}} onRefresh={() => {}} />),
  )
  expect(
    screen.getByText('Застряли? Выберите уровень подсказки.'),
  ).toBeInTheDocument()
  screen
    .getAllByRole('button', { pressed: false })
    .forEach((b) => expect(b).toHaveAttribute('aria-pressed', 'false'))
})

test('level 2 marks the second button pressed and shows its readout', () => {
  render(
    wrap(<HintConsole level={2} onSelect={() => {}} onRefresh={() => {}} />),
  )
  expect(screen.getByText('Захват центра')).toBeInTheDocument()
  expect(screen.getByText('Подсказки · 2/3')).toBeInTheDocument()
})

test('clicking a level button reports the level', async () => {
  const onSelect = vi.fn()
  render(
    wrap(<HintConsole level={0} onSelect={onSelect} onRefresh={() => {}} />),
  )
  await userEvent.click(screen.getByRole('button', { name: /Фигура/ }))
  expect(onSelect).toHaveBeenCalledWith(1)
})

test('the refresh button calls onRefresh', async () => {
  const onRefresh = vi.fn()
  render(
    wrap(<HintConsole level={0} onSelect={() => {}} onRefresh={onRefresh} />),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Следующая подсказка' }),
  )
  expect(onRefresh).toHaveBeenCalledTimes(1)
})
