// @vitest-environment node
import { newGame, legalMoves } from '../../../src/engine/game'
import { v1LegalList } from './v1-legal-list'

describe('v1-legal-list', () => {
  it('lists the legal moves in the user message', () => {
    const state = newGame()
    const req = v1LegalList.buildRequest({ state, legal: legalMoves(state) })
    if (req.kind !== 'chat') throw new Error('expected chat request')
    const user = req.messages.find((m) => m.role === 'user')!.content
    expect(user).toContain('Legal moves:')
    expect(user).toContain('Nf3')
    expect(user).toContain(state.fen)
  })
})
