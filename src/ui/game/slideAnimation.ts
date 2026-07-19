import type { SquareName } from '../../engine/types'
import { nameToRC } from './chessDemo'

// Delta from `from` to `to` in board columns/rows. Board rows are rank-8-first,
// so a White pawn e2→e4 moves "up" two rows → dRow = -2.
export function moveDelta(
  from: SquareName,
  to: SquareName,
): { dCol: number; dRow: number } {
  const [fromR, fromC] = nameToRC(from)
  const [toR, toC] = nameToRC(to)
  return { dCol: toC - fromC, dRow: toR - fromR }
}

// The CSS transform that visually places the mover back on its `from` square,
// given the pixel size of one board cell.
export function invertTransform(
  from: SquareName,
  to: SquareName,
  cell: number,
): string {
  const { dCol, dRow } = moveDelta(from, to)
  return `translate(${-dCol * cell}px, ${-dRow * cell}px)`
}

// FLIP the piece now on `move.to` so it visually starts on `move.from` and
// slides home via the existing `.piece` CSS transition. Imperative and
// verified live; guarded to a safe no-op in the untestable cases.
export function animateSlide(
  boardEl: HTMLElement,
  move: { from: SquareName; to: SquareName },
): void {
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) return

  const cell = boardEl.clientWidth / 8
  if (!cell) return

  const mover = boardEl.querySelector<HTMLElement>(
    `[data-sq="${move.to}"] .piece`,
  )
  if (!mover) return

  // Invert: jump the mover back onto its `from` square, with no transition.
  mover.style.transition = 'none'
  mover.style.transform = invertTransform(move.from, move.to, cell)
  // Commit the inverted position so it becomes the transition's start value.
  void mover.offsetWidth
  // Play: restore the CSS transition + home position; the browser slides it.
  mover.style.transition = ''
  mover.style.transform = ''
}
