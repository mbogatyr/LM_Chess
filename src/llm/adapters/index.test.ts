import { expect, test } from 'vitest'
import { resolveAdapter, defaultAdapter } from './index'
import { genericFenAdapter } from './genericFen'
import { gemma4Adapter } from './gemma4'

test('resolveAdapter falls back to the generic default for unknown models', () => {
  expect(resolveAdapter('some/unknown-model')).toBe(genericFenAdapter)
  expect(defaultAdapter).toBe(genericFenAdapter)
})

test('resolveAdapter routes gemma-4 model ids to the gemma4 adapter', () => {
  const adapter = resolveAdapter('google/gemma-4-12b')
  expect(adapter).toBe(gemma4Adapter)
  expect(adapter.name).toBe('gemma-4-legal-list')
})

test('resolveAdapter still falls back to generic for other models', () => {
  expect(resolveAdapter('some-other-model')).toBe(genericFenAdapter)
})
