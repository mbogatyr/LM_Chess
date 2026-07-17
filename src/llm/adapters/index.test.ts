import { expect, test } from 'vitest'
import { resolveAdapter, defaultAdapter } from './index'
import { genericFenAdapter } from './genericFen'

test('resolveAdapter falls back to the generic default for unknown models', () => {
  expect(resolveAdapter('some/unknown-model')).toBe(genericFenAdapter)
  expect(defaultAdapter).toBe(genericFenAdapter)
})
