import { expect, test } from 'vitest'
import { newGame, legalMoves } from '../../engine/game'
import { genericFenAdapter, parseSanCandidates } from './genericFen'
import type { MoveContext } from './types'

function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  const state = newGame()
  return { state, elo: 1200, legal: legalMoves(state), ...overrides }
}

test('buildRequest emits a chat request with FEN and the ELO persona', () => {
  const req = genericFenAdapter.buildRequest(ctx())
  expect(req.kind).toBe('chat')
  if (req.kind !== 'chat') return
  expect(req.messages[0].role).toBe('system')
  expect(req.messages[0].content).toContain('1200')
  expect(req.messages[1].content).toContain(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  )
})

test('buildRequest appends the correction when retrying', () => {
  const req = genericFenAdapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Qzz9')
})

test('parseSanCandidates returns a bare move', () => {
  expect(parseSanCandidates('Nf3')).toContain('Nf3')
})

test('parseSanCandidates extracts a move from prose', () => {
  expect(parseSanCandidates("I'll play Nf3.")).toContain('Nf3')
})

test('parseSanCandidates handles a leading line of reasoning', () => {
  expect(parseSanCandidates('Let me think...\ne5')).toContain('e5')
})

test('parseMoves feeds candidates the engine can validate', () => {
  const c = ctx()
  // after 1. e4, Black to move — build a black-to-move context
  const moves = genericFenAdapter.parseMoves('e5', c)
  expect(moves).toContain('e5')
})
