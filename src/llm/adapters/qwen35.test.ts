import { expect, test } from 'vitest'
import { newGame, legalMoves, move } from '../../engine/game'
import { qwen35Adapter } from './qwen35'
import type { MoveContext } from './types'

function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  const state = newGame()
  return { state, elo: 1200, legal: legalMoves(state), ...overrides }
}

test('matches qwen3.5 model ids', () => {
  expect(qwen35Adapter.matches('qwen/qwen3.5-9b')).toBe(true)
})

test('does not match unrelated model ids', () => {
  expect(qwen35Adapter.matches('google/gemma-4-12b')).toBe(false)
})

test('first attempt (no correction) is a completion request with GM headers', () => {
  const req = qwen35Adapter.buildRequest(ctx())
  expect(req.kind).toBe('completion')
  if (req.kind !== 'completion') return
  expect(req.prompt).toContain('[Event "World Chess Championship"]')
  expect(req.prompt).toContain('[White "Kasparov, Garry"]')
  expect(req.prompt).toContain('[Black "Karpov, Anatoly"]')
  expect(req.prompt).toContain('[WhiteElo "2800"]')
  expect(req.prompt).toContain('[BlackElo "2780"]')
  expect(req.prompt).toContain('[Result "*"]')
})

test('first attempt prompt continues the movetext with a trailing move-number lead', () => {
  const s1 = move(newGame(), 'e4')
  if (!s1) throw new Error('illegal in fixture')
  const s2 = move(s1, 'e5')
  if (!s2) throw new Error('illegal in fixture')
  const req = qwen35Adapter.buildRequest(
    ctx({ state: s2, legal: legalMoves(s2) }),
  )
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt.endsWith('1. e4 e5 2.')).toBe(true)
})

test('first attempt prompt has no leading space when the movetext is empty', () => {
  const req = qwen35Adapter.buildRequest(ctx())
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt.endsWith('*"]\n\n1.')).toBe(true)
})

test('retry (correction present) is a chat request with the legal-move list', () => {
  const state = newGame()
  const req = qwen35Adapter.buildRequest(
    ctx({
      state,
      legal: legalMoves(state),
      correction: { badReply: 'Qzz9', reason: 'illegal' },
    }),
  )
  expect(req.kind).toBe('chat')
  if (req.kind !== 'chat') return
  expect(req.messages[1].content).toContain(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  )
  expect(req.messages[1].content).toContain('Legal moves:')
  expect(req.messages[1].content).toContain('Nf3')
  expect(req.messages[1].content).toContain('e4')
})

test('retry system prompt instructs picking from the legal-move list, SAN only', () => {
  const req = qwen35Adapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[0].role).toBe('system')
  expect(req.messages[0].content).toMatch(/legal-move list|list of.*legal/i)
  expect(req.messages[0].content).toMatch(/ONLY/)
  expect(req.messages[0].content).toMatch(/no explanation/i)
})

test('retry user message appends the correction sentence', () => {
  const req = qwen35Adapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Qzz9')
  expect(req.messages[1].content).toContain('illegal')
})

test('retry user message includes the move history once a game is underway', () => {
  const s1 = move(newGame(), 'e4')
  if (!s1) throw new Error('illegal in fixture')
  const req = qwen35Adapter.buildRequest(
    ctx({
      state: s1,
      legal: legalMoves(s1),
      correction: { badReply: 'Qzz9', reason: 'illegal' },
    }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Moves so far: e4')
})

test('parseMoves without correction takes the first-mentioned SAN token', () => {
  const moves = qwen35Adapter.parseMoves(' Nf3 Nc6 3. Bb5', ctx())
  expect(moves[0]).toBe('Nf3')
})

test('parseMoves with correction extracts the move from a chatty reply', () => {
  const moves = qwen35Adapter.parseMoves(
    'The best move is Nf3',
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  expect(moves).toContain('Nf3')
})

test('sampling requests reasoning off, deterministic, short replies', () => {
  expect(qwen35Adapter.sampling).toEqual({
    temperature: 0,
    maxTokens: 64,
    reasoningEffort: 'none',
  })
})
