import { expect, test } from 'vitest'
import { newGame, legalMoves, move } from '../../engine/game'
import { chessLmAdapter } from './chessLm'
import type { MoveContext } from './types'

function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  const state = newGame()
  return { state, elo: 1200, legal: legalMoves(state), ...overrides }
}

test('matches the LM Studio chessLM model id', () => {
  expect(chessLmAdapter.matches('chesslm-0.01-llama-3.1-8b')).toBe(true)
})

test('matches case-insensitively (HF repo casing)', () => {
  expect(chessLmAdapter.matches('ippity/chessLM-0.01-llama-3.1-8b')).toBe(true)
})

test('does not match unrelated model ids', () => {
  expect(chessLmAdapter.matches('qwen/qwen3.5-9b')).toBe(false)
  expect(chessLmAdapter.matches('google/gemma-4-12b')).toBe(false)
  expect(chessLmAdapter.matches('llama-3.1-8b-instruct')).toBe(false)
})

test('builds the documented Alpaca completion prompt verbatim', () => {
  const s1 = move(newGame(), 'e4')
  if (!s1) throw new Error('illegal in fixture')
  const legal = legalMoves(s1)
  const req = chessLmAdapter.buildRequest(ctx({ state: s1, legal }))
  expect(req.kind).toBe('completion')
  if (req.kind !== 'completion') return
  expect(req.prompt).toBe(
    'Below is an instruction that describes a task, paired with an input ' +
      'that provides further context. Write a response that appropriately ' +
      'completes the request.\n\n' +
      '### Instruction:\n' +
      'Given the moves so far in a chess game, predict the subsequent ' +
      'moves until the end of the game.\n\n' +
      '### Input:\n' +
      'Moves so far: e4\n' +
      `Legal moves: ${legal.map((m) => m.san).join(' ')}\n\n` +
      '### Response:\n',
  )
})

test('renders an empty move history as an empty value', () => {
  const req = chessLmAdapter.buildRequest(ctx())
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt).toContain('Moves so far: \n')
})

test('retry stays a completion and appends the correction note to the input', () => {
  const req = chessLmAdapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  expect(req.kind).toBe('completion')
  if (req.kind !== 'completion') return
  expect(req.prompt).toContain(
    'Note: "Qzz9" was not a legal move. Choose one move from the legal ' +
      'moves list.',
  )
  expect(req.prompt.endsWith('### Response:\n')).toBe(true)
})

test('no correction note on the first attempt', () => {
  const req = chessLmAdapter.buildRequest(ctx())
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt).not.toContain('Note:')
})

test('truncates a rambling badReply in the correction note', () => {
  const badReply = 'x'.repeat(500)
  const req = chessLmAdapter.buildRequest(
    ctx({ correction: { badReply, reason: 'illegal' } }),
  )
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt).not.toContain(badReply)
  expect(req.prompt).toContain(`"${'x'.repeat(80)}…"`)
})

test('parseMoves takes SAN candidates in order of first mention', () => {
  expect(chessLmAdapter.parseMoves('e5 Nf3 Nc6', ctx())).toEqual([
    'e5',
    'Nf3',
    'Nc6',
  ])
})

test('parseMoves returns an empty list for garbage', () => {
  expect(chessLmAdapter.parseMoves('???', ctx())).toEqual([])
})

test('sampling is deterministic, short, and not a reasoning model', () => {
  expect(chessLmAdapter.sampling).toEqual({ temperature: 0, maxTokens: 32 })
})
