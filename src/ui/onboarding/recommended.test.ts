import { expect, test } from 'vitest'
import { findRecommendation, recommendedModels } from './recommended'

test('lists exactly three models sorted by rank', () => {
  expect(recommendedModels.map((m) => m.rank)).toEqual([1, 2, 3])
})

test('finds each tested id exactly', () => {
  expect(findRecommendation('chesslm-0.01-llama-3.1-8b')?.rank).toBe(1)
  expect(findRecommendation('qwen/qwen3.5-9b')?.rank).toBe(2)
  expect(findRecommendation('google/gemma-4-12b')?.rank).toBe(3)
})

test('normalizes an LM Studio instance suffix', () => {
  expect(findRecommendation('chesslm-0.01-llama-3.1-8b:2')?.rank).toBe(1)
})

test('does not match untested variants or unknown models', () => {
  expect(findRecommendation('google/gemma-4-12b-qat')).toBeUndefined()
  expect(findRecommendation('google/gemma-4-e4b')).toBeUndefined()
  expect(findRecommendation('qwen2.5-7b-instruct-1m')).toBeUndefined()
  expect(findRecommendation('')).toBeUndefined()
})

test('every entry carries both comment languages', () => {
  for (const m of recommendedModels) {
    expect(m.comment.ru.length).toBeGreaterThan(0)
    expect(m.comment.en.length).toBeGreaterThan(0)
  }
})
