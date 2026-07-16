import { describe, expect, test } from 'vitest'
import { newGame } from './game'

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
