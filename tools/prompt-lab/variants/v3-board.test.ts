// @vitest-environment node
import { newGame, legalMoves } from '../../../src/engine/game'
import { v3Board } from './v3-board'

describe('v3-board', () => {
  it('contains ASCII board diagram and FEN in user message', () => {
    const state = newGame()
    const req = v3Board.buildRequest({ state, legal: legalMoves(state) })
    if (req.kind !== 'chat') throw new Error('expected chat request')
    const user = req.messages.find((m) => m.role === 'user')!.content
    expect(user).toContain('| r  n  b  q  k  b  n  r |')
    expect(user).toContain(state.fen)
  })
})
