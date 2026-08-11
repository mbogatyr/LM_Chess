// @vitest-environment node
import { newGame, legalMoves, move } from '../../../src/engine/game'
import { genericFenAdapter } from '../../../src/llm/adapters/genericFen'
import { BASELINE_ELO, v0Baseline } from './v0-baseline'

describe('v0-baseline', () => {
  it('builds the exact production genericFen request at the baseline elo', () => {
    let state = newGame()
    state = move(state, 'e4')!
    const legal = legalMoves(state)
    const expected = genericFenAdapter.buildRequest({
      state,
      elo: BASELINE_ELO,
      legal,
    })
    expect(v0Baseline.buildRequest({ state, legal })).toEqual(expected)
  })

  it('scores deterministically: temperature 0', () => {
    expect(v0Baseline.sampling.temperature).toBe(0)
  })
})
