import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useConnection } from './useConnection'
import { LMStudioError, type LMModel } from '../llm/types'
import * as client from '../llm/client'

const models: LMModel[] = [
  { id: 'a', type: 'llm', state: 'not-loaded' },
  { id: 'b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

test('defaults baseUrl to localhost when nothing stored', () => {
  const { result } = renderHook(() => useConnection())
  expect(result.current.state.baseUrl).toBe('http://localhost:1234')
  expect(result.current.state.phase).toBe('idle')
})

test('connect loads models and persists the url', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  expect(result.current.state.phase).toBe('connected')
  expect(result.current.state.models).toEqual(models)
  expect(localStorage.getItem('lmchess.baseUrl')).toBe('localhost:1234')
})

test('connect surfaces a typed error and stays on the dialog', async () => {
  vi.spyOn(client, 'listModels').mockRejectedValue(
    new LMStudioError('network', 'boom'),
  )
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  expect(result.current.state.phase).toBe('error')
  expect(result.current.state.error).toBe('boom')
})

test('load refreshes model state to loaded', async () => {
  vi.spyOn(client, 'listModels')
    .mockResolvedValueOnce(models)
    .mockResolvedValueOnce([
      { id: 'a', type: 'llm', state: 'loaded' },
      { id: 'b', type: 'vlm', state: 'loaded' },
    ])
  vi.spyOn(client, 'loadModel').mockResolvedValue()
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  await act(async () => {
    await result.current.load('a')
  })
  expect(client.loadModel).toHaveBeenCalledWith('localhost:1234', 'a')
  await waitFor(() =>
    expect(result.current.state.models[0].state).toBe('loaded'),
  )
  expect(result.current.state.loadingModelId).toBeNull()
})

test('use marks a model active and reset returns to the list', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  act(() => {
    result.current.use('b')
  })
  expect(result.current.state.phase).toBe('ready')
  expect(result.current.state.activeModel).toBe('b')
  act(() => {
    result.current.reset()
  })
  expect(result.current.state.phase).toBe('connected')
  expect(result.current.state.activeModel).toBeNull()
  expect(result.current.state.models).toEqual(models)
})
