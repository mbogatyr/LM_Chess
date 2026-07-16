import { describe, expect, test } from 'vitest'
import { legalMoves, move, newGame } from './game'

describe('newGame', () => {
  test('starts a fresh game in the standard position', () => {
    const state = newGame()
    expect(state.turn).toBe('w')
    expect(state.history).toEqual([])
    expect(state.lastMove).toBeNull()
    expect(state.status.isGameOver).toBe(false)
    expect(state.status.isCheck).toBe(false)
    expect(state.status.result).toBe('ongoing')
    expect(state.status.drawReason).toBeNull()
  })

  test('board is rank-8-first, file-a-first with the start position', () => {
    const { board } = newGame()
    // row 0 = rank 8 = black back rank
    expect(board[0][0]).toEqual({ color: 'b', type: 'r' })
    expect(board[0][4]).toEqual({ color: 'b', type: 'k' })
    // row 1 = rank 7 = black pawns
    expect(board[1][0]).toEqual({ color: 'b', type: 'p' })
    // rows 2..5 empty
    expect(board[3][3]).toBeNull()
    // row 6 = rank 2 = white pawns; row 7 = rank 1 = white back rank
    expect(board[6][0]).toEqual({ color: 'w', type: 'p' })
    expect(board[7][4]).toEqual({ color: 'w', type: 'k' })
  })

  test('accepts a custom starting FEN', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
    const state = newGame(fen)
    expect(state.initialFen).toBe(fen)
    expect(state.fen).toBe(fen)
    expect(state.turn).toBe('w')
  })
})

describe('legalMoves', () => {
  test('lists all 20 legal moves in the start position', () => {
    expect(legalMoves(newGame())).toHaveLength(20)
  })

  test('lists moves from a single square', () => {
    const dests = legalMoves(newGame(), 'e2')
      .map((m) => m.to)
      .sort()
    expect(dests).toEqual(['e3', 'e4'])
  })

  test('returns an empty array for a square with no legal moves', () => {
    expect(legalMoves(newGame(), 'e4')).toEqual([])
  })

  test('returns an empty array when the game is over', () => {
    // A finished game (stalemate: black king a8, white king c7, queen b6,
    // black to move has no legal move). Game over ⇒ no legal moves.
    const fen = 'k7/2K5/1Q6/8/8/8/8/8 b - - 0 1'
    expect(legalMoves(newGame(fen))).toEqual([])
  })

  test('a pawn on the 7th rank yields all four promotion moves', () => {
    const fen = '8/4P3/8/8/8/8/8/4k1K1 w - - 0 1'
    const promotions = legalMoves(newGame(fen), 'e7')
      .map((m) => m.promotion)
      .sort()
    expect(promotions).toEqual(['b', 'n', 'q', 'r'])
  })
})

describe('move', () => {
  test('applies a coordinate move and records SAN + history', () => {
    const next = move(newGame(), { from: 'e2', to: 'e4' })
    expect(next).not.toBeNull()
    expect(next!.turn).toBe('b')
    expect(next!.history).toEqual(['e4'])
    expect(next!.lastMove).toEqual({ from: 'e2', to: 'e4', san: 'e4' })
  })

  test('applies a SAN move equivalently to the coordinate form', () => {
    const byCoord = move(newGame(), { from: 'e2', to: 'e4' })
    const bySan = move(newGame(), 'e4')
    expect(bySan).not.toBeNull()
    expect(bySan!.fen).toBe(byCoord!.fen)
    expect(bySan!.history).toEqual(['e4'])
  })

  test('returns null for an illegal coordinate move', () => {
    expect(move(newGame(), { from: 'e2', to: 'e5' })).toBeNull()
  })

  test('returns null for an unparseable SAN string', () => {
    expect(move(newGame(), 'Zz9')).toBeNull()
  })

  test('does not mutate the input state', () => {
    const state = newGame()
    const fenBefore = state.fen
    const historyLenBefore = state.history.length
    const next = move(state, 'e4')
    expect(state.fen).toBe(fenBefore)
    expect(state.history).toHaveLength(historyLenBefore)
    expect(next).not.toBe(state)
  })

  test('handles promotion in both coordinate and SAN form', () => {
    const fen = '8/4P3/8/8/8/8/8/4k1K1 w - - 0 1'
    const byCoord = move(newGame(fen), { from: 'e7', to: 'e8', promotion: 'q' })
    expect(byCoord).not.toBeNull()
    expect(byCoord!.board[0][4]).toEqual({ color: 'w', type: 'q' })

    const bySan = move(newGame(fen), 'e8=Q')
    expect(bySan).not.toBeNull()
    expect(bySan!.board[0][4]).toEqual({ color: 'w', type: 'q' })
  })
})

describe('game-over detection', () => {
  test('checkmate reports the mating side as the result', () => {
    // Fool's Mate: 1. f3 e5 2. g4 Qh4#
    let s = newGame()
    s = move(s, 'f3')!
    s = move(s, 'e5')!
    s = move(s, 'g4')!
    s = move(s, 'Qh4#')!
    expect(s.status.isCheckmate).toBe(true)
    expect(s.status.isGameOver).toBe(true)
    expect(s.status.result).toBe('black')
    expect(s.status.drawReason).toBeNull()
  })

  test('stalemate is a draw with reason stalemate', () => {
    // Classic stalemate: black king a8, white king c7, white queen b6, black to move.
    const s = newGame('k7/2K5/1Q6/8/8/8/8/8 b - - 0 1')
    expect(s.status.isStalemate).toBe(true)
    expect(s.status.isDraw).toBe(true)
    expect(s.status.result).toBe('draw')
    expect(s.status.drawReason).toBe('stalemate')
  })

  test('king vs king is an insufficient-material draw', () => {
    const s = newGame('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(s.status.isDraw).toBe(true)
    expect(s.status.drawReason).toBe('insufficient-material')
  })

  test('fifty-move rule is a draw with reason fifty-move', () => {
    // Halfmove clock at 99; a non-pawn, non-capture move trips it to 100.
    const s = move(newGame('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'), 'Ra2')!
    expect(s.status.isDraw).toBe(true)
    expect(s.status.drawReason).toBe('fifty-move')
  })

  test('threefold repetition is detected across replayed history', () => {
    // Shuffle knights back to the start position twice.
    let s = newGame()
    for (const san of [
      'Nf3',
      'Nf6',
      'Ng1',
      'Ng8',
      'Nf3',
      'Nf6',
      'Ng1',
      'Ng8',
    ]) {
      s = move(s, san)!
    }
    expect(s.status.isDraw).toBe(true)
    expect(s.status.drawReason).toBe('threefold')
  })

  test('check with legal escapes is not checkmate or game over', () => {
    // Black king e8 in check from the white rook on e2, down the open
    // e-file; black can step aside to d8/f8/d7/f7.
    const s = newGame('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1')
    expect(s.status.isCheck).toBe(true)
    expect(s.status.isCheckmate).toBe(false)
    expect(s.status.isGameOver).toBe(false)
  })
})
