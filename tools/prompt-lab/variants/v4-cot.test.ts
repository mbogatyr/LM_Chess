// @vitest-environment node
import { parseFinalLineSan, v4Cot } from './v4-cot'
import { newGame, move } from '../../../src/engine/game'

describe('v4-cot', () => {
  describe('parseFinalLineSan', () => {
    it('prefers the last line over moves mentioned while thinking', () => {
      expect(
        parseFinalLineSan('Candidates: Nf3, d4. Nf3 develops...\nd4')[0],
      ).toBe('d4')
    })

    it('falls back to whole-reply parsing when the last line has no move', () => {
      const result = parseFinalLineSan('Nf3 is best.\n....')
      expect(result.length).toBeGreaterThan(0)
      // Should find Nf3 since last line "...." has no valid moves
      expect(result.some((m) => m === 'Nf3' || m.includes('Nf3'))).toBe(true)
    })

    it('returns array of strings', () => {
      const result = parseFinalLineSan('Nf3')
      expect(Array.isArray(result)).toBe(true)
      expect(typeof result[0]).toBe('string')
    })
  })

  describe('v4Cot variant', () => {
    it('builds a chat request with system prompt and FEN position', () => {
      const state = newGame()
      const req = v4Cot.buildRequest({ state, legal: [] })
      if (req.kind !== 'chat') throw new Error('expected chat')
      expect(req.messages.length).toBe(2)
      expect(req.messages[0].role).toBe('system')
      expect(req.messages[1].role).toBe('user')
      expect(req.messages[1].content).toContain('Position (FEN):')
      expect(req.messages[1].content).toContain("It is White's turn")
    })

    it('includes move history when not at start position', () => {
      let state = newGame()
      state = move(state, 'e4')!
      state = move(state, 'e5')!
      const req = v4Cot.buildRequest({ state, legal: [] })
      if (req.kind !== 'chat') throw new Error('expected chat')
      expect(req.messages[1].content).toContain('Moves so far: e4 e5')
    })

    it('has temperature 0 for determinism', () => {
      expect(v4Cot.sampling.temperature).toBe(0)
    })

    it('has reasonable maxTokens for thinking', () => {
      expect(v4Cot.sampling.maxTokens).toBeGreaterThanOrEqual(256)
    })

    it('uses parseFinalLineSan for parsing', () => {
      expect(v4Cot.parse).toBe(parseFinalLineSan)
    })
  })
})
