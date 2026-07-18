import { expect, test, vi } from 'vitest'
import { getHint, HintUnavailableError, MAX_HINT_ATTEMPTS } from './hint'
import { newGame } from '../engine/game'
import { LMStudioError } from './types'
import type { chatCompletion } from './chat'

// A chat stub returning a fixed reply (ignores its arguments).
const replying = (reply: string): typeof chatCompletion =>
  (async () => reply) as unknown as typeof chatCompletion

test('parses Move/Idea and returns a validated Hint', async () => {
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: replying('Move: e4\nIdea: Grab the centre.') },
  )
  expect(hint.san).toBe('e4')
  expect(hint.from).toBe('e2')
  expect(hint.to).toBe('e4')
  expect(hint.pieceType).toBe('p')
  expect(hint.idea).toBe('Grab the centre.')
})

test('picks the first legal candidate from a chatty reply', async () => {
  // Qh5 is illegal from the start; Nf3 is legal and mentioned last.
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: replying('Maybe Qh5? No. Move: Nf3\nIdea: Develop.') },
  )
  expect(hint.san).toBe('Nf3')
  expect(hint.pieceType).toBe('n')
})

test('empty idea line yields an empty idea string', async () => {
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: replying('Move: d4') },
  )
  expect(hint.idea).toBe('')
})

test('retries with a correction after an illegal move, then succeeds', async () => {
  const chat = vi
    .fn()
    .mockResolvedValueOnce('Move: e5') // illegal for White at the start
    .mockResolvedValueOnce('Move: e4\nIdea: ok')
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: chat as unknown as typeof chatCompletion },
  )
  expect(hint.san).toBe('e4')
  expect(chat).toHaveBeenCalledTimes(2)
})

test('throws HintUnavailableError after MAX_HINT_ATTEMPTS of nonsense', async () => {
  const chat = vi.fn().mockResolvedValue('no idea, sorry')
  await expect(
    getHint(
      { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
      { chat: chat as unknown as typeof chatCompletion },
    ),
  ).rejects.toBeInstanceOf(HintUnavailableError)
  expect(chat).toHaveBeenCalledTimes(MAX_HINT_ATTEMPTS)
})

test('propagates LMStudioError from the transport', async () => {
  const chat = (async () => {
    throw new LMStudioError('network', 'down')
  }) as unknown as typeof chatCompletion
  await expect(
    getHint(
      { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
      { chat },
    ),
  ).rejects.toBeInstanceOf(LMStudioError)
})
