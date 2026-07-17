import { expect, test, vi } from 'vitest'
import { newGame, move } from '../engine/game'
import { selectMove } from './selectMove'
import { LMStudioError } from './types'
import type { ModelAdapter } from './adapters/types'

// A black-to-move position: 1. e4
const afterE4 = () => move(newGame(), 'e4')!

// Minimal fake adapter: emits a trivial chat request; parses the reply as one
// SAN candidate. The reply content is driven entirely by the fake transport.
const fakeAdapter: ModelAdapter = {
  name: 'fake',
  matches: () => true,
  buildRequest: () => ({ kind: 'chat', messages: [] }),
  parseMoves: (reply) => [reply.trim()],
}

const params = (state = afterE4()) => ({
  baseUrl: 'http://x',
  model: 'm',
  state,
  elo: 1200,
})

test('returns the model move when it is legal on the first try', async () => {
  const chat = vi.fn().mockResolvedValue('e5')
  const out = await selectMove(params(), { adapter: fakeAdapter, chat })
  expect(out.source).toBe('model')
  expect(out.san).toBe('e5')
  expect(out.nextState.history).toEqual(['e4', 'e5'])
  expect(chat).toHaveBeenCalledTimes(1)
})

test('retries with a correction after an illegal move, then succeeds', async () => {
  const chat = vi
    .fn()
    .mockResolvedValueOnce('Qzz9') // illegal
    .mockResolvedValueOnce('e5') // legal
  const correctionSpy = vi.fn()
  const adapter: ModelAdapter = {
    ...fakeAdapter,
    buildRequest: (ctx) => {
      correctionSpy(ctx.correction)
      return { kind: 'chat', messages: [] }
    },
  }
  const out = await selectMove(params(), { adapter, chat })
  expect(out.source).toBe('model')
  expect(out.san).toBe('e5')
  expect(chat).toHaveBeenCalledTimes(2)
  // second buildRequest received a correction referencing the bad reply
  expect(correctionSpy.mock.calls[1][0]).toMatchObject({ badReply: 'Qzz9' })
})

test('falls back to a random legal move after exhausting retries', async () => {
  const chat = vi.fn().mockResolvedValue('totally-not-a-move')
  const out = await selectMove(params(), {
    adapter: fakeAdapter,
    chat,
    rng: () => 0, // pick the first legal move deterministically
  })
  expect(out.source).toBe('fallback')
  expect(chat).toHaveBeenCalledTimes(3) // MAX_MOVE_ATTEMPTS
  // the fallback move is genuinely legal (engine applied it)
  expect(out.nextState.history).toHaveLength(2)
})

test('propagates LMStudioError from the transport (no fallback)', async () => {
  const chat = vi.fn().mockRejectedValue(new LMStudioError('network', 'down'))
  await expect(
    selectMove(params(), { adapter: fakeAdapter, chat }),
  ).rejects.toBeInstanceOf(LMStudioError)
})

test('dispatches to the completion transport for completion adapters', async () => {
  const complete = vi.fn().mockResolvedValue('e5')
  const adapter: ModelAdapter = {
    ...fakeAdapter,
    buildRequest: () => ({ kind: 'completion', prompt: 'p' }),
  }
  const out = await selectMove(params(), { adapter, complete })
  expect(out.san).toBe('e5')
  expect(complete).toHaveBeenCalledTimes(1)
})
