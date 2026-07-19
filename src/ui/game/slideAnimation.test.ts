import { expect, test } from 'vitest'
import { moveDelta, invertTransform, animateSlide } from './slideAnimation'

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

function boardWith(toSquare: string, width: number): HTMLElement {
  const board = document.createElement('div')
  board.innerHTML = `<div data-sq="${toSquare}"><span class="piece"></span></div>`
  Object.defineProperty(board, 'clientWidth', {
    value: width,
    configurable: true,
  })
  return board
}

test('animateSlide no-ops safely when the board has no size', () => {
  const board = boardWith('e4', 0)
  const piece = board.querySelector('.piece') as HTMLElement
  expect(() => animateSlide(board, { from: 'e2', to: 'e4' })).not.toThrow()
  expect(piece.style.transform).toBe('') // untouched
})

test('animateSlide no-ops when the mover is missing', () => {
  const board = boardWith('e4', 640)
  expect(() => animateSlide(board, { from: 'd2', to: 'd4' })).not.toThrow()
})

test('animateSlide touches the mover then clears it (FLIP leaves no inline transform)', () => {
  const board = boardWith('e4', 640)
  const piece = board.querySelector('.piece') as HTMLElement
  const seen: string[] = []
  // Record every transform the FLIP assigns during the call.
  let current = ''
  Object.defineProperty(piece.style, 'transform', {
    get: () => current,
    set: (v: string) => {
      current = v
      seen.push(v)
    },
    configurable: true,
  })
  animateSlide(board, { from: 'e2', to: 'e4' })
  // Inverted first (cell = 640/8 = 80, dRow -2 → +160px), then cleared.
  expect(seen).toContain('translate(0px, 160px)')
  expect(seen[seen.length - 1]).toBe('')
})
