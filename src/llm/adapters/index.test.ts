import { expect, test } from 'vitest'
import { resolveAdapter, defaultAdapter } from './index'
import { genericFenAdapter } from './genericFen'
import { gemma4Adapter } from './gemma4'
import { qwen35Adapter } from './qwen35'
import { chessLmAdapter } from './chessLm'

test('resolveAdapter falls back to the generic default for unknown models', () => {
  expect(resolveAdapter('some/unknown-model')).toBe(genericFenAdapter)
  expect(defaultAdapter).toBe(genericFenAdapter)
})

test('resolveAdapter routes gemma-4 model ids to the gemma4 adapter', () => {
  const adapter = resolveAdapter('google/gemma-4-12b')
  expect(adapter).toBe(gemma4Adapter)
  expect(adapter.name).toBe('gemma-4-legal-list')
})

test('resolveAdapter routes qwen3.5 model ids to the qwen35 adapter', () => {
  const adapter = resolveAdapter('qwen/qwen3.5-9b')
  expect(adapter).toBe(qwen35Adapter)
  expect(adapter.name).toBe('qwen3.5-two-stage')
})

test('resolveAdapter routes chessLM model ids to the chessLm adapter', () => {
  const adapter = resolveAdapter('chesslm-0.01-llama-3.1-8b')
  expect(adapter).toBe(chessLmAdapter)
  expect(adapter.name).toBe('chesslm-alpaca')
})

test('resolveAdapter still falls back to generic for other models', () => {
  expect(resolveAdapter('some-other-model')).toBe(genericFenAdapter)
})
