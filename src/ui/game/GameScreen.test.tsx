import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { GameScreen } from './GameScreen'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

const props = {
  opponentName: 'gemma',
  elo: 1200,
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
}

test('shows both players, frozen clocks and the your-move status', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  expect(screen.getByText('gemma')).toBeInTheDocument()
  expect(screen.getByText('Соперник · ELO 1200')).toBeInTheDocument()
  expect(screen.getByText('Вы')).toBeInTheDocument()
  expect(container.querySelectorAll('.clock')).toHaveLength(2)
  container
    .querySelectorAll('.clock')
    .forEach((c) => expect(c.textContent).toBe('10:00'))
  expect(container.querySelector('.status .txt b')!.textContent).toBe('Ваш ход')
})

test('shows the empty move list', () => {
  render(wrap(<GameScreen {...props} />))
  expect(screen.getByText('Сделайте первый ход')).toBeInTheDocument()
})

test('clicking a hint level highlights the board; clicking it again clears', async () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  expect(container.querySelector('.sq.hint1')).toBeNull()
  const lvl1 = screen.getByRole('button', { name: /Фигура/ })
  await userEvent.click(lvl1)
  expect(container.querySelector('.sq.hint1')!.getAttribute('data-sq')).toBe(
    'e2',
  )
  expect(lvl1).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(lvl1)
  expect(container.querySelector('.sq.hint1')).toBeNull()
})

test('the refresh button cycles into level 1', async () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  await userEvent.click(
    screen.getByRole('button', { name: 'Следующая подсказка' }),
  )
  expect(container.querySelector('.sq.hint1')).not.toBeNull()
})
