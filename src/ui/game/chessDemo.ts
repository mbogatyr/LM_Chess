import type { PieceType, Square } from '../../engine/types'

export type { Square } from '../../engine/types'

export type HintLevel = 0 | 1 | 2 | 3

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

function parseFEN(fen: string): Square[][] {
  return fen.split('/').map((row) => {
    const squares: Square[] = []
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) squares.push(null)
      } else {
        squares.push({
          color: ch === ch.toUpperCase() ? 'w' : 'b',
          // Safe: START_FEN is a hardcoded valid FEN literal, so every
          // letter is guaranteed to be one of the six piece-type chars.
          type: ch.toLowerCase() as PieceType,
        })
      }
    }
    return squares
  })
}

// board[rank0 = rank 8][file0 = a]
export const START_POSITION: Square[][] = parseFEN(START_FEN)

export const sqName = (r: number, c: number): string => FILES[c] + (8 - r)

export const nameToRC = (name: string): [number, number] => [
  8 - Number(name[1]),
  FILES.indexOf(name[0]),
]
