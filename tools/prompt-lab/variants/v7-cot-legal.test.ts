// @vitest-environment node
import { legalMoves, newGame } from '../../../src/engine/game'
import { v7CotLegal } from './v7-cot-legal'

describe('v7-cot-legal', () => {
  it('lists the legal moves and keeps the reasoning instruction', () => {
    const state = newGame()
    const req = v7CotLegal.buildRequest({ state, legal: legalMoves(state) })
    if (req.kind !== 'chat') throw new Error('expected chat request')
    const system = req.messages.find((m) => m.role === 'system')!.content
    const user = req.messages.find((m) => m.role === 'user')!.content
    expect(system).toContain('last line')
    expect(user).toContain('Legal moves:')
    expect(user).toContain('Nf3')
    expect(user).toContain(state.fen)
  })

  it('reasons with a generous token budget at temperature 0', () => {
    expect(v7CotLegal.sampling).toEqual({ temperature: 0, maxTokens: 512 })
  })
})
