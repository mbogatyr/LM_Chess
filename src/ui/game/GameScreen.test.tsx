import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { GameScreen } from './GameScreen'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>
const props = {
  opponentName: 'gemma',
  elo: 1200,
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
}
// fireEvent (not a raw `.click()`) so React 18's state update for the
// resulting move is flushed to the DOM before the next assertion/click runs.
const click = (c: HTMLElement, sq: string) =>
  fireEvent.click(c.querySelector(`[data-sq="${sq}"]`) as HTMLElement)

test('shows players, frozen clocks and the white-to-move status', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  expect(screen.getByText('gemma')).toBeInTheDocument()
  expect(screen.getByText('Вы')).toBeInTheDocument()
  expect(container.querySelectorAll('.clock')).toHaveLength(2)
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Ход белых',
  )
})

test('playing e4 e5 updates board, move list, status and active strip', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  click(container, 'e2')
  click(container, 'e4')
  expect(container.querySelector('[data-sq="e4"] .piece')).not.toBeNull()
  expect(container.querySelector('[data-sq="e2"] .piece')).toBeNull()
  expect(screen.getByText('e4')).toBeInTheDocument()
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Ход чёрных',
  )
  expect(container.querySelector('.status.theirs')).not.toBeNull()
  click(container, 'e7')
  click(container, 'e5')
  expect(screen.getByText('e5')).toBeInTheDocument()
})

test('Fool’s Mate ends with the checkmate status', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  click(container, 'f2')
  click(container, 'f3')
  click(container, 'e7')
  click(container, 'e5')
  click(container, 'g2')
  click(container, 'g4')
  click(container, 'd8')
  click(container, 'h4')
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Мат — победа чёрных',
  )
})

test('the hint panel is inert', () => {
  render(wrap(<GameScreen {...props} />))
  const lvl1 = screen.getByRole('button', { name: /Фигура/ })
  expect(lvl1).toBeDisabled()
})
