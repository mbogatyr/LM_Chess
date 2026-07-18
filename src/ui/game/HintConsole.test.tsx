import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HintConsole } from './HintConsole'
import { I18nProvider } from '../app/i18n'
import type { Hint } from '../../llm/hint'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

const HINT: Hint = {
  san: 'Nf3',
  from: 'g1',
  to: 'f3',
  pieceType: 'n',
  idea: 'Develop and control the centre.',
}
const props = (over: Partial<Parameters<typeof HintConsole>[0]> = {}) => ({
  level: 0 as const,
  hint: null,
  loading: false,
  errorKind: null,
  onSelectLevel: () => {},
  onRefresh: () => {},
  ...over,
})

test('level 0 shows the empty prompt', () => {
  render(wrap(<HintConsole {...props()} />))
  expect(
    screen.getByText('Застряли? Выберите уровень подсказки.'),
  ).toBeInTheDocument()
})

test('loading shows the loading readout', () => {
  render(wrap(<HintConsole {...props({ loading: true })} />))
  expect(screen.getByText('Подбираю подсказку…')).toBeInTheDocument()
})

test('errorKind connection shows the connection message', () => {
  render(wrap(<HintConsole {...props({ errorKind: 'connection' })} />))
  expect(screen.getByText('Модель недоступна.')).toBeInTheDocument()
})

test('L1 names the piece to move', () => {
  render(wrap(<HintConsole {...props({ level: 1, hint: HINT })} />))
  expect(screen.getByText('Подумайте о ходе конём')).toBeInTheDocument()
})

test('L2 shows the model idea, L3 shows the exact move', () => {
  const { rerender } = render(
    wrap(<HintConsole {...props({ level: 2, hint: HINT })} />),
  )
  expect(
    screen.getByText('Develop and control the centre.'),
  ).toBeInTheDocument()
  rerender(wrap(<HintConsole {...props({ level: 3, hint: HINT })} />))
  expect(screen.getByText('g1 → f3')).toBeInTheDocument()
})

test('an empty idea falls back to a placeholder at L2', () => {
  render(
    wrap(<HintConsole {...props({ level: 2, hint: { ...HINT, idea: '' } })} />),
  )
  expect(screen.getByText('Модель не пояснила ход.')).toBeInTheDocument()
})

test('clicking a level button reports it; refresh fires', async () => {
  const onSelectLevel = vi.fn()
  const onRefresh = vi.fn()
  render(wrap(<HintConsole {...props({ onSelectLevel, onRefresh })} />))
  await userEvent.click(screen.getByRole('button', { name: /Фигура/ }))
  expect(onSelectLevel).toHaveBeenCalledWith(1)
  await userEvent.click(
    screen.getByRole('button', { name: 'Следующая подсказка' }),
  )
  expect(onRefresh).toHaveBeenCalledTimes(1)
})

test('disabled disables every button and shows the empty prompt', () => {
  render(wrap(<HintConsole {...props({ disabled: true })} />))
  screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled())
  expect(
    screen.getByText('Застряли? Выберите уровень подсказки.'),
  ).toBeInTheDocument()
})
