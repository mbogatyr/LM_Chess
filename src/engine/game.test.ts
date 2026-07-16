import { describe, expect, test } from 'vitest'
import { legalMoves, newGame } from './game'

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
})
