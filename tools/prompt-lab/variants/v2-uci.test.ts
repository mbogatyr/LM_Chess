// @vitest-environment node
import { newGame, legalMoves } from '../../../src/engine/game'
import { parseUciCandidates, v2Uci } from './v2-uci'

describe('v2-uci', () => {
  it('demands UCI in system message and includes FEN in user message', () => {
    const state = newGame()
    const req = v2Uci.buildRequest({ state, legal: legalMoves(state) })
    if (req.kind !== 'chat') throw new Error('expected chat request')
    const system = req.messages.find((m) => m.role === 'system')!.content
    const user = req.messages.find((m) => m.role === 'user')!.content
    expect(system).toContain('UCI')
    expect(user).toContain(state.fen)
  })

  it('extracts UCI tokens, last-mentioned first, lowercased', () => {
    expect(parseUciCandidates('I considered g1f3 but play E2E4')).toEqual([
      'e2e4',
      'g1f3',
    ])
  })

  it('keeps promotion suffixes', () => {
    expect(parseUciCandidates('e7e8q')).toEqual(['e7e8q'])
  })
})
