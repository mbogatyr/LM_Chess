import { afterEach, expect, test, vi } from 'vitest'
import { listModels } from './client'
import { LMStudioError } from './types'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetchOnce(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  const { ok = true, status = 200 } = init
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  } as Response)
}

const sample = {
  object: 'list',
  data: [
    {
      id: 'google/gemma-4-e4b',
      object: 'model',
      type: 'vlm',
      state: 'not-loaded',
      max_context_length: 131072,
    },
    {
      id: 'qwen/qwen3.5-9b',
      object: 'model',
      type: 'llm',
      state: 'loaded',
      max_context_length: 262144,
    },
    {
      id: 'text-embedding-nomic',
      object: 'model',
      type: 'embeddings',
      state: 'not-loaded',
      max_context_length: 2048,
    },
  ],
}

test('requests the /api/v0/models endpoint on the normalized base URL', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => sample,
  } as Response)
  await listModels('localhost:1234/')
  expect(spy).toHaveBeenCalledWith('http://localhost:1234/api/v0/models')
})

test('returns only chat models, mapping context length', async () => {
  mockFetchOnce(sample)
  const models = await listModels('http://localhost:1234')
  expect(models.map((m) => m.id)).toEqual([
    'google/gemma-4-e4b',
    'qwen/qwen3.5-9b',
  ])
  expect(models[0].maxContextLength).toBe(131072)
})

test('throws network error when fetch rejects', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
    new TypeError('failed to fetch'),
  )
  await expect(listModels('http://localhost:1234')).rejects.toMatchObject({
    kind: 'network',
  })
})

test('throws http error on non-ok response', async () => {
  mockFetchOnce({}, { ok: false, status: 500 })
  const error = await listModels('http://localhost:1234').catch((e) => e)
  expect(error).toBeInstanceOf(LMStudioError)
  expect(error).toMatchObject({ kind: 'http' })
})

test('throws empty error when no chat models remain', async () => {
  mockFetchOnce({
    object: 'list',
    data: [
      { id: 'e', object: 'model', type: 'embeddings', state: 'not-loaded' },
    ],
  })
  await expect(listModels('http://localhost:1234')).rejects.toMatchObject({
    kind: 'empty',
  })
})

test('throws parse error when data is not an array', async () => {
  mockFetchOnce({ object: 'list' })
  await expect(listModels('http://localhost:1234')).rejects.toMatchObject({
    kind: 'parse',
  })
})
