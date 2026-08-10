import { afterEach, expect, test, vi } from 'vitest'
import { chatCompletion, completion } from './chat'
import { LMStudioError } from './types'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetchOnce(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  const { ok = true, status = 200 } = init
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  } as Response)
}

const chatBody = { choices: [{ message: { content: 'Nf3' } }] }
const completionBody = { choices: [{ text: ' e5 Nf6' }] }

test('chatCompletion posts to /api/v0/chat/completions and returns content', async () => {
  const spy = mockFetchOnce(chatBody)
  const out = await chatCompletion('localhost:1234/', {
    model: 'm',
    messages: [{ role: 'user', content: 'hi' }],
    temperature: 0.7,
    maxTokens: 64,
  })
  expect(out).toBe('Nf3')
  const [url, init] = spy.mock.calls[0]
  expect(url).toBe('http://localhost:1234/api/v0/chat/completions')
  expect(init?.method).toBe('POST')
  const sent = JSON.parse(init?.body as string)
  expect(sent).toMatchObject({ model: 'm', max_tokens: 64, temperature: 0.7 })
  expect(sent.messages).toEqual([{ role: 'user', content: 'hi' }])
})

test('completion posts to /api/v0/completions and returns text', async () => {
  const spy = mockFetchOnce(completionBody)
  const out = await completion('http://localhost:1234', {
    model: 'm',
    prompt: 'Moves so far: e4',
    maxTokens: 16,
  })
  expect(out).toBe(' e5 Nf6')
  expect(spy.mock.calls[0][0]).toBe('http://localhost:1234/api/v0/completions')
})

test('chatCompletion throws network error when fetch rejects', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
    new TypeError('failed to fetch'),
  )
  await expect(
    chatCompletion('http://localhost:1234', { model: 'm', messages: [] }),
  ).rejects.toMatchObject({ kind: 'network' })
})

test('chatCompletion throws http error on non-ok response', async () => {
  mockFetchOnce({}, { ok: false, status: 500 })
  const err = await chatCompletion('http://localhost:1234', {
    model: 'm',
    messages: [],
  }).catch((e) => e)
  expect(err).toBeInstanceOf(LMStudioError)
  expect(err).toMatchObject({ kind: 'http' })
})

test('chatCompletion throws parse error when content is missing', async () => {
  mockFetchOnce({ choices: [{}] })
  await expect(
    chatCompletion('http://localhost:1234', { model: 'm', messages: [] }),
  ).rejects.toMatchObject({ kind: 'parse' })
})

test('completion throws parse error when text is missing', async () => {
  mockFetchOnce({ choices: [{}] })
  await expect(
    completion('http://localhost:1234', { model: 'm', prompt: 'x' }),
  ).rejects.toMatchObject({ kind: 'parse' })
})

test('chatCompletion includes reasoning_effort in the body when set', async () => {
  const spy = mockFetchOnce(chatBody)
  await chatCompletion('http://localhost:1234', {
    model: 'm',
    messages: [],
    reasoningEffort: 'none',
  })
  const sent = JSON.parse(spy.mock.calls[0][1]?.body as string)
  expect(sent.reasoning_effort).toBe('none')
})

test('chatCompletion omits reasoning_effort from the body when not set', async () => {
  const spy = mockFetchOnce(chatBody)
  await chatCompletion('http://localhost:1234', { model: 'm', messages: [] })
  const sent = JSON.parse(spy.mock.calls[0][1]?.body as string)
  expect(sent).not.toHaveProperty('reasoning_effort')
})

test('completion includes reasoning_effort in the body when set', async () => {
  const spy = mockFetchOnce(completionBody)
  await completion('http://localhost:1234', {
    model: 'm',
    prompt: 'x',
    reasoningEffort: 'none',
  })
  const sent = JSON.parse(spy.mock.calls[0][1]?.body as string)
  expect(sent.reasoning_effort).toBe('none')
})

test('completion omits reasoning_effort from the body when not set', async () => {
  const spy = mockFetchOnce(completionBody)
  await completion('http://localhost:1234', { model: 'm', prompt: 'x' })
  const sent = JSON.parse(spy.mock.calls[0][1]?.body as string)
  expect(sent).not.toHaveProperty('reasoning_effort')
})
