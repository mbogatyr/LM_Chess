import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MoveList } from './MoveList'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>

test('empty history shows the placeholder', () => {
  render(wrap(<MoveList history={[]} onNewGame={() => {}} />))
  expect(screen.getByText('Сделайте первый ход')).toBeInTheDocument()
})

test('renders numbered SAN pairs with .cur on the last ply', () => {
  const { container } = render(
    wrap(<MoveList history={['e4', 'e5', 'Nf3']} onNewGame={() => {}} />),
  )
  expect(screen.getByText('e4')).toBeInTheDocument()
  expect(screen.getByText('e5')).toBeInTheDocument()
  const cur = container.querySelectorAll('.mv.cur')
  expect(cur).toHaveLength(1)
  expect(cur[0].textContent).toBe('Nf3')
})

test('New Game is enabled and calls onNewGame; draw/resign disabled', async () => {
  const onNewGame = vi.fn()
  render(wrap(<MoveList history={['e4']} onNewGame={onNewGame} />))
  await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
  expect(onNewGame).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Ничья' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Сдаться' })).toBeDisabled()
})

test('Resign uses a two-step confirm and fires onResign on the second click', async () => {
  const onResign = vi.fn()
  render(
    wrap(<MoveList history={[]} onNewGame={() => {}} onResign={onResign} />),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
  expect(onResign).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Точно?' }))
  expect(onResign).toHaveBeenCalledTimes(1)
})

test('Resign is disabled when the game is over', () => {
  render(
    wrap(
      <MoveList
        history={[]}
        onNewGame={() => {}}
        onResign={() => {}}
        gameOver
      />,
    ),
  )
  expect(screen.getByRole('button', { name: 'Сдаться' })).toBeDisabled()
})
