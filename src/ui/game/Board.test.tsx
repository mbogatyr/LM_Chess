import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Board } from './Board'

test('renders 64 squares with palette classes and coord labels', () => {
  const { container } = render(
    <Board hintLevel={0} boardStyle="mono" pieceStyle="neon" />,
  )
  expect(container.querySelectorAll('.sq')).toHaveLength(64)
  expect(container.querySelector('.board.board--mono')).not.toBeNull()
  expect(container.querySelector('.board-wrap.pieces--neon')).not.toBeNull()
  // 8 rank labels + 8 file labels
  expect(container.querySelectorAll('.coord.rank')).toHaveLength(8)
  expect(container.querySelectorAll('.coord.file')).toHaveLength(8)
  // all 32 pieces present at the start
  expect(container.querySelectorAll('.piece')).toHaveLength(32)
})

test('no hint classes or arrow at level 0', () => {
  const { container } = render(
    <Board hintLevel={0} boardStyle="mono" pieceStyle="neon" />,
  )
  expect(container.querySelector('.sq.hint1')).toBeNull()
  expect(container.querySelector('.sq.hint-target')).toBeNull()
  expect(container.querySelector('.arrows')).toBeNull()
})

test('level 1 highlights the hinted piece square only', () => {
  const { container } = render(
    <Board hintLevel={1} boardStyle="mono" pieceStyle="neon" />,
  )
  const hinted = container.querySelectorAll('.sq.hint1')
  expect(hinted).toHaveLength(1)
  expect(hinted[0].getAttribute('data-sq')).toBe('e2')
})

test('level 2 adds target-square highlights', () => {
  const { container } = render(
    <Board hintLevel={2} boardStyle="mono" pieceStyle="neon" />,
  )
  const targets = [...container.querySelectorAll('.sq.hint-target')].map((s) =>
    s.getAttribute('data-sq'),
  )
  expect(targets.sort()).toEqual(['d4', 'e4'])
})

test('level 3 selects the piece, shows legal dots and the arrow', () => {
  const { container } = render(
    <Board hintLevel={3} boardStyle="mono" pieceStyle="neon" />,
  )
  expect(container.querySelector('.sq.sel')!.getAttribute('data-sq')).toBe('e2')
  expect(container.querySelectorAll('.sq.legal .marker.dot')).toHaveLength(2)
  expect(container.querySelector('.arrows')).not.toBeNull()
})
