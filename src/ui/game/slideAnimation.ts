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
