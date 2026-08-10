// @vitest-environment node
import { newGame, move } from '../../../src/engine/game'
import { parseFirstSan, v6PgnCompletion } from './v6-pgn-completion'

describe('v6-pgn-completion', () => {
  describe('parseFirstSan', () => {
    it('parses the first continuation move, not later ones', () => {
      expect(parseFirstSan(' Nf3 Nc6 3. Bb5')[0]).toBe('Nf3')
    })

    it('extracts all valid SAN moves in order', () => {
      const result = parseFirstSan('e4 e5 Nf3')
      expect(result[0]).toBe('e4')
      expect(result[1]).toBe('e5')
      expect(result[2]).toBe('Nf3')
    })

    it('handles captures with notation', () => {
      expect(parseFirstSan('exd5 Nxf7')[0]).toBe('exd5')
    })

    it('handles castling notation', () => {
      expect(parseFirstSan('O-O O-O-O')).toContain('O-O')
    })

    it('handles promotion notation', () => {
      expect(parseFirstSan('e8=Q')).toContain('e8=Q')
    })

    it('filters duplicates, keeping first occurrence', () => {
      const result = parseFirstSan('e4 e5 e4 e5')
      expect(result.length).toBe(2)
      expect(result[0]).toBe('e4')
    })
  })

  describe('v6PgnCompletion variant', () => {
    it('builds a completion prompt ending at the side to move', () => {
      let state = newGame()
      state = move(state, 'e4')!
      state = move(state, 'e5')!
      const req = v6PgnCompletion.buildRequest({ state, legal: [] })
      if (req.kind !== 'completion') throw new Error('expected completion')
      expect(req.prompt).toContain('[White "Kasparov, Garry"]')
      expect(req.prompt.trimEnd().endsWith('1. e4 e5 2.')).toBe(true)
    })

    it('includes PGN headers', () => {
      const req = v6PgnCompletion.buildRequest({ state: newGame(), legal: [] })
      if (req.kind !== 'completion') throw new Error('expected completion')
      expect(req.prompt).toContain('[Event')
      expect(req.prompt).toContain('[White')
      expect(req.prompt).toContain('[Black')
    })

    it('includes movetext after headers', () => {
      let state = newGame()
      state = move(state, 'e4')!
      const req = v6PgnCompletion.buildRequest({ state, legal: [] })
      if (req.kind !== 'completion') throw new Error('expected completion')
      expect(req.prompt).toContain('1. e4')
    })

    it('ends at White to move with move number', () => {
      let state = newGame()
      state = move(state, 'e4')!
      state = move(state, 'e5')!
      state = move(state, 'Nf3')!
      state = move(state, 'Nc6')!
      const req = v6PgnCompletion.buildRequest({ state, legal: [] })
      if (req.kind !== 'completion') throw new Error('expected completion')
      expect(req.prompt.trimEnd()).toMatch(/3\./) // 3rd move number should show
    })

    it('does not append move number when Black to move', () => {
      let state = newGame()
      state = move(state, 'e4')!
      const req = v6PgnCompletion.buildRequest({ state, legal: [] })
      if (req.kind !== 'completion') throw new Error('expected completion')
      // Black to move, so no move number appended
      expect(req.prompt.trimEnd()).not.toMatch(/2\./)
    })

    it('has low maxTokens for one-move completion', () => {
      expect(v6PgnCompletion.sampling.maxTokens).toBeLessThanOrEqual(32)
    })
  })
})
