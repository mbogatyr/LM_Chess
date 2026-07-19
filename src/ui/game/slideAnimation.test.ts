import { expect, test } from 'vitest'
import { moveDelta, invertTransform } from './slideAnimation'

test('moveDelta counts columns and rank-8-first rows (to - from)', () => {
  expect(moveDelta('e2', 'e4')).toEqual({ dCol: 0, dRow: -2 })
  expect(moveDelta('a1', 'h1')).toEqual({ dCol: 7, dRow: 0 })
  expect(moveDelta('b1', 'c3')).toEqual({ dCol: 1, dRow: -2 })
  expect(moveDelta('e1', 'g1')).toEqual({ dCol: 2, dRow: 0 }) // castling king
})

test('invertTransform offsets the mover back onto its from square', () => {
  // e2→e4: dRow -2, so the invert pushes it +2 cells down (back to e2).
  expect(invertTransform('e2', 'e4', 80)).toBe('translate(0px, 160px)')
  // a1→h1: dCol +7, invert pushes it 7 cells left.
  expect(invertTransform('a1', 'h1', 80)).toBe('translate(-560px, 0px)')
})
