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

type HintText = {
  l1: [string, string]
  l2: [string, string]
  l3: [string, string]
}

// Ported verbatim from docs/design-reference/gambit-local/app/board.js (HINT).
export const HINT: {
  piece: string
  from: string
  to: string
  targets: string[]
  ru: HintText
  en: HintText
} = {
  piece: 'e2',
  from: 'e2',
  to: 'e4',
  targets: ['e4', 'd4'],
  ru: {
    l1: [
      'Ходите центральной пешкой',
      'Начните с пешки e2 — сразу боритесь за центр.',
    ],
    l2: [
      'Захват центра',
      'Идея: e4 занимает центр и открывает дороги ферзю и слону f1. Дальше — вывод коней и рокировка.',
    ],
    l3: [
      'e2 → e4',
      'Двиньте пешку на e4. Самый популярный первый ход — пространство и быстрое развитие.',
    ],
  },
  en: {
    l1: [
      'Move a centre pawn',
      'Start with the e2 pawn — fight for the centre right away.',
    ],
    l2: [
      'Grab the centre',
      'Idea: e4 takes the centre and opens lines for the queen and the f1 bishop. Then develop the knights and castle.',
    ],
    l3: [
      'e2 → e4',
      'Push the pawn to e4. The most popular first move — space and quick development.',
    ],
  },
}

// The hinted pawn's demo targets (from MOVES.e2 in board.js) → level-3 dots.
export const HINT_LEGAL = ['e3', 'e4']
