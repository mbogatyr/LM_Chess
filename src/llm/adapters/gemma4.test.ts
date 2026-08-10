import { expect, test } from 'vitest'
import { newGame, legalMoves, move } from '../../engine/game'
import { gemma4Adapter } from './gemma4'
import type { MoveContext } from './types'

function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  const state = newGame()
  return { state, elo: 1200, legal: legalMoves(state), ...overrides }
}

test('matches gemma-4 model ids', () => {
  expect(gemma4Adapter.matches('google/gemma-4-12b')).toBe(true)
  expect(gemma4Adapter.matches('google/gemma-4-12b-qat')).toBe(true)
})

test('does not match unrelated model ids', () => {
  expect(gemma4Adapter.matches('qwen/qwen3.5-9b')).toBe(false)
})

test('buildRequest emits a chat request with the ELO persona', () => {
  const req = gemma4Adapter.buildRequest(ctx({ elo: 1450 }))
  expect(req.kind).toBe('chat')
  if (req.kind !== 'chat') return
  expect(req.messages[0].role).toBe('system')
  expect(req.messages[0].content).toContain('1450')
  expect(req.messages[0].content).toContain('White')
})

test('buildRequest instructs picking from the legal-move list, SAN only', () => {
  const req = gemma4Adapter.buildRequest(ctx())
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[0].content).toMatch(/legal-move list|list of.*legal/i)
  expect(req.messages[0].content).toMatch(/ONLY/)
  expect(req.messages[0].content).toMatch(/no explanation/i)
})

test('buildRequest includes the FEN and the legal-move SAN list', () => {
  const state = newGame()
  const req = gemma4Adapter.buildRequest(
    ctx({ state, legal: legalMoves(state) }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  )
  expect(req.messages[1].content).toContain('Legal moves:')
  expect(req.messages[1].content).toContain('Nf3')
  expect(req.messages[1].content).toContain('e4')
})

test('buildRequest includes the move history once a game is underway', () => {
  const s1 = move(newGame(), 'e4')
  if (!s1) throw new Error('illegal in fixture')
  const req = gemma4Adapter.buildRequest(
    ctx({ state: s1, legal: legalMoves(s1) }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Moves so far: e4')
})

test('buildRequest omits the history line at the start', () => {
  const req = gemma4Adapter.buildRequest(ctx())
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).not.toContain('Moves so far')
})

test('buildRequest appends the correction sentence when retrying', () => {
  const req = gemma4Adapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Qzz9')
  expect(req.messages[1].content).toContain('illegal')
})

test('parseMoves handles a bare move reply', () => {
  const moves = gemma4Adapter.parseMoves('Qc8+', ctx())
  expect(moves).toContain('Qc8+')
})

test('parseMoves handles a bare knight move reply', () => {
  const moves = gemma4Adapter.parseMoves('Nc6', ctx())
  expect(moves).toContain('Nc6')
})

test('parseMoves extracts the move from a chatty reply', () => {
  const moves = gemma4Adapter.parseMoves('The best move is Nf3', ctx())
  expect(moves).toContain('Nf3')
})

test('sampling requests reasoning off, deterministic, short replies', () => {
  expect(gemma4Adapter.sampling).toEqual({
    temperature: 0,
    maxTokens: 64,
    reasoningEffort: 'none',
  })
})
