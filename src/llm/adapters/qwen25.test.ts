import { expect, test } from 'vitest'
import { newGame, legalMoves, move } from '../../engine/game'
import { qwen25Adapter } from './qwen25'
import { qwen35Adapter } from './qwen35'
import { resolveAdapter } from './index'
import type { MoveContext } from './types'

function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  const state = newGame()
  return { state, elo: 1200, legal: legalMoves(state), ...overrides }
}

test('matches qwen2.5 model ids', () => {
  expect(qwen25Adapter.matches('qwen2.5-7b-instruct-1m')).toBe(true)
  expect(qwen25Adapter.matches('qwen/qwen2.5-14b-instruct')).toBe(true)
})

test('does not match unrelated model ids', () => {
  expect(qwen25Adapter.matches('google/gemma-4-12b')).toBe(false)
})

// The two qwen adapters are the pair most at risk of stealing each
// other's models — their campaigns landed on opposite prompt formats
// (legal list vs PGN completion), so a mis-route silently halves play
// strength rather than erroring.
test('the two qwen adapters do not claim each other s models', () => {
  expect(qwen25Adapter.matches('qwen/qwen3.5-9b')).toBe(false)
  expect(qwen35Adapter.matches('qwen2.5-7b-instruct-1m')).toBe(false)
})

test('resolveAdapter routes each qwen id to its own adapter', () => {
  expect(resolveAdapter('qwen2.5-7b-instruct-1m')).toBe(qwen25Adapter)
  expect(resolveAdapter('qwen/qwen3.5-9b')).toBe(qwen35Adapter)
})

test('buildRequest emits a chat request with the ELO persona', () => {
  const req = qwen25Adapter.buildRequest(ctx({ elo: 1450 }))
  expect(req.kind).toBe('chat')
  if (req.kind !== 'chat') return
  expect(req.messages[0].role).toBe('system')
  expect(req.messages[0].content).toContain('1450')
  expect(req.messages[0].content).toContain('White')
})

test('buildRequest instructs picking from the legal-move list, SAN only', () => {
  const req = qwen25Adapter.buildRequest(ctx())
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[0].content).toMatch(/legal-move list|list of.*legal/i)
  expect(req.messages[0].content).toMatch(/ONLY/)
  expect(req.messages[0].content).toMatch(/no explanation/i)
})

test('buildRequest includes the FEN and the legal-move SAN list', () => {
  const state = newGame()
  const req = qwen25Adapter.buildRequest(
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
  const req = qwen25Adapter.buildRequest(
    ctx({ state: s1, legal: legalMoves(s1) }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Moves so far: e4')
})

test('buildRequest omits the history line at the start', () => {
  const req = qwen25Adapter.buildRequest(ctx())
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).not.toContain('Moves so far')
})

test('buildRequest appends the correction sentence when retrying', () => {
  const req = qwen25Adapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Qzz9')
  expect(req.messages[1].content).toContain('illegal')
})

test('parseMoves handles a bare move reply', () => {
  expect(qwen25Adapter.parseMoves('Qc8+', ctx())).toContain('Qc8+')
})

test('parseMoves extracts the move from a chatty reply', () => {
  expect(qwen25Adapter.parseMoves('The best move is Nf3', ctx())).toContain(
    'Nf3',
  )
})

// qwen2.5-7b-instruct is NOT a reasoning model (verified live during the
// 2026-08-14 campaign: content arrives non-empty, reasoning_content is
// ''). Sending reasoning_effort here would be cargo-culted from the
// gemma-4 / qwen3.5 adapters.
test('sampling is deterministic and short, with no reasoning flag', () => {
  expect(qwen25Adapter.sampling).toEqual({ temperature: 0, maxTokens: 64 })
})
