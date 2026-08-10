// @vitest-environment node
import { newGame, move } from '../../../src/engine/game'
import { v5Fewshot } from './v5-fewshot'

describe('v5-fewshot', () => {
  it('example answers are legal in their example positions', () => {
    const req = v5Fewshot.buildRequest({ state: newGame(), legal: [] })
    if (req.kind !== 'chat') throw new Error('expected chat')
    const pairs: [string, string][] = []
    for (let i = 0; i < req.messages.length - 1; i++) {
      const m = req.messages[i]
      const next = req.messages[i + 1]
      if (m.role === 'user' && next.role === 'assistant') {
        pairs.push([m.content, next.content])
      }
    }
    expect(pairs.length).toBeGreaterThanOrEqual(2)
    for (const [user, san] of pairs) {
      const fen = /Position \(FEN\): (.+)/.exec(user)![1].trim()
      expect(move(newGame(fen), san)).not.toBeNull()
    }
  })

  it('builds a chat request with system prompt, examples, and real position', () => {
    let state = newGame()
    state = move(state, 'e4')!
    const req = v5Fewshot.buildRequest({ state, legal: [] })
    if (req.kind !== 'chat') throw new Error('expected chat')
    // Should have: system, user1, assistant1, user2, assistant2, user_real
    expect(req.messages.length).toBeGreaterThanOrEqual(6)
    expect(req.messages[0].role).toBe('system')
    expect(req.messages[req.messages.length - 1].role).toBe('user')
  })

  it('includes move history for the real position', () => {
    let state = newGame()
    state = move(state, 'e4')!
    state = move(state, 'e5')!
    const req = v5Fewshot.buildRequest({ state, legal: [] })
    if (req.kind !== 'chat') throw new Error('expected chat')
    const lastMsg = req.messages[req.messages.length - 1]
    if (lastMsg.role === 'user') {
      expect(lastMsg.content).toContain('Moves so far: e4 e5')
    }
  })

  it('has low maxTokens for concise answers', () => {
    expect(v5Fewshot.sampling.maxTokens).toBeLessThanOrEqual(128)
  })
})
