import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Piece } from './Piece'

test('renders a white pawn span with the cp-p svg', () => {
  const { container } = render(<Piece color="w" type="p" />)
  const span = container.querySelector('span.piece.w')
  expect(span).not.toBeNull()
  const svg = container.querySelector('svg.cp.cp-p')
  expect(svg).not.toBeNull()
  expect(svg!.getAttribute('viewBox')).toBe('0 0 237.73 292.27')
  // the inline path artwork is present
  expect(svg!.querySelector('path')).not.toBeNull()
})

test('applies the black class for black pieces', () => {
  const { container } = render(<Piece color="b" type="k" />)
  expect(container.querySelector('span.piece.b svg.cp.cp-k')).not.toBeNull()
})
