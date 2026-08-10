// @vitest-environment node
import { legalMoves, newGame } from '../../../src/engine/game'
import { v8KarpovLegal } from './v8-karpov-legal'

describe('v8-karpov-legal', () => {
  it('lists the legal moves under the Karpov persona', () => {
    const state = newGame()
    const req = v8KarpovLegal.buildRequest({ state, legal: legalMoves(state) })
    if (req.kind !== 'chat') throw new Error('expected chat request')
    const system = req.messages.find((m) => m.role === 'system')!.content
    const user = req.messages.find((m) => m.role === 'user')!.content
    expect(system).toContain('Karpov')
    expect(user).toContain('Legal moves:')
    expect(user).toContain(state.fen)
  })

  it('answers in one shot at temperature 0', () => {
    expect(v8KarpovLegal.sampling).toEqual({ temperature: 0, maxTokens: 64 })
  })
})
