import { render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Board } from './Board'
import { newGame } from '../../engine/game'

const base = {
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
  selected: null,
  legalTargets: [],
  lastMove: null,
  checkSquare: null,
  onSquareClick: () => {},
}

test('renders 64 squares, 32 pieces and coord labels, no hint classes', () => {
  const { container } = render(<Board {...base} board={newGame().board} />)
  expect(container.querySelectorAll('.sq')).toHaveLength(64)
  expect(container.querySelectorAll('.piece')).toHaveLength(32)
  expect(container.querySelectorAll('.coord.rank')).toHaveLength(8)
  expect(container.querySelectorAll('.coord.file')).toHaveLength(8)
  expect(container.querySelector('.sq.hint1')).toBeNull()
  expect(container.querySelector('.arrows')).toBeNull()
})

test('marks the selected square and its legal targets (dot/ring)', () => {
  const { container } = render(
    <Board
      {...base}
      board={newGame().board}
      selected="e2"
      legalTargets={[
        { to: 'e3', capture: false },
        { to: 'd3', capture: true },
      ]}
    />,
  )
  expect(container.querySelector('.sq.sel')!.getAttribute('data-sq')).toBe('e2')
  const e3 = container.querySelector('[data-sq="e3"]')!
  const d3 = container.querySelector('[data-sq="d3"]')!
  expect(e3.classList.contains('legal')).toBe(true)
  expect(e3.querySelector('.marker.dot')).not.toBeNull()
  expect(d3.querySelector('.marker.ring')).not.toBeNull()
})

test('highlights last move squares and the checked king', () => {
  const { container } = render(
    <Board
      {...base}
      board={newGame().board}
      lastMove={{ from: 'e2', to: 'e4' }}
      checkSquare="e1"
    />,
  )
  expect(
    [...container.querySelectorAll('.sq.last')]
      .map((s) => s.getAttribute('data-sq'))
      .sort(),
  ).toEqual(['e2', 'e4'])
  expect(container.querySelector('.sq.check')!.getAttribute('data-sq')).toBe(
    'e1',
  )
})

test('clicking a square calls onSquareClick with its name', async () => {
  const onSquareClick = vi.fn()
  const { container } = render(
    <Board {...base} board={newGame().board} onSquareClick={onSquareClick} />,
  )
  ;(container.querySelector('[data-sq="e2"]') as HTMLElement).click()
  expect(onSquareClick).toHaveBeenCalledWith('e2')
})
