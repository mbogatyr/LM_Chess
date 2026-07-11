import { afterEach, expect, test, vi } from 'vitest'
import { loadModel } from './client'

afterEach(() => {
  vi.restoreAllMocks()
})

test('POSTs a minimal completion to trigger JIT load', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as Response)
  await loadModel('http://localhost:1234', 'google/gemma-4-e4b')
  expect(spy).toHaveBeenCalledTimes(1)
  const [url, init] = spy.mock.calls[0]
  expect(url).toBe('http://localhost:1234/api/v0/chat/completions')
  expect(init?.method).toBe('POST')
  expect(JSON.parse(init?.body as string)).toEqual({
    model: 'google/gemma-4-e4b',
    messages: [{ role: 'user', content: ' ' }],
    max_tokens: 1,
  })
})

test('throws http error when load response is not ok', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: false,
    status: 400,
    json: async () => ({}),
  } as Response)
  await expect(loadModel('http://localhost:1234', 'x')).rejects.toMatchObject({
    kind: 'http',
  })
})

test('throws network error when fetch rejects', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
    new TypeError('failed to fetch'),
  )
  await expect(loadModel('http://localhost:1234', 'x')).rejects.toMatchObject({
    kind: 'network',
  })
})
