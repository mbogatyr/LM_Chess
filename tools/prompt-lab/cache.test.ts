// @vitest-environment node
import { appendFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ModelRequest } from '../../src/llm/adapters/types'
import { cacheKey, ResponseCache } from './cache'

const req = (content: string): ModelRequest => ({
  kind: 'chat',
  messages: [{ role: 'user', content }],
})
const S = { temperature: 0, maxTokens: 64 }

describe('cacheKey', () => {
  it('is stable for identical inputs and differs when anything changes', () => {
    expect(cacheKey('m', req('a'), S)).toBe(cacheKey('m', req('a'), S))
    expect(cacheKey('m', req('a'), S)).not.toBe(cacheKey('m2', req('a'), S))
    expect(cacheKey('m', req('a'), S)).not.toBe(cacheKey('m', req('b'), S))
    expect(cacheKey('m', req('a'), S)).not.toBe(
      cacheKey('m', req('a'), { ...S, maxTokens: 65 }),
    )
  })
})

describe('ResponseCache', () => {
  it('round-trips and persists across instances', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'plab-')), 'cache.jsonl')
    const a = new ResponseCache(file)
    expect(a.get('k1')).toBeUndefined()
    a.put('k1', { reply: 'Nf3', latencyMs: 123 })
    expect(a.get('k1')).toEqual({ reply: 'Nf3', latencyMs: 123 })
    const b = new ResponseCache(file)
    expect(b.get('k1')).toEqual({ reply: 'Nf3', latencyMs: 123 })
  })

  it('ignores a torn trailing line from an interrupted run', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'plab-')), 'cache.jsonl')
    const a = new ResponseCache(file)
    a.put('k1', { reply: 'e4', latencyMs: 1 })
    appendFileSync(file, '{"key":"k2","repl')
    const b = new ResponseCache(file)
    expect(b.get('k1')).toBeDefined()
    expect(b.get('k2')).toBeUndefined()
  })
})
