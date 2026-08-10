// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ResponseCache } from './cache'
import { classify, rebuildContext, runEval } from './evalRunner'
import type { Transport } from './evalRunner'
import type { PositionRecord } from './positions'
import type { PromptVariant } from './variants/types'
import { parseSanCandidates } from '../../src/llm/adapters/genericFen'

const RECORD: PositionRecord = {
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  historySan: ['e4'],
  expectedSan: 'e5',
  turn: 'b',
  ply: 2,
  meta: { white: '', black: '', result: '', date: '', eco: '' },
}

const testVariant: PromptVariant = {
  name: 'test-variant',
  description: 'test',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [{ role: 'user', content: ctx.state.fen }],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}

const freshCache = () =>
  new ResponseCache(join(mkdtempSync(join(tmpdir(), 'plab-')), 'c.jsonl'))

describe('rebuildContext', () => {
  it('replays history to the recorded FEN and computes legal moves', () => {
    const ctx = rebuildContext(RECORD)
    expect(ctx.state.fen).toBe(RECORD.fen)
    expect(ctx.state.history).toEqual(['e4'])
    expect(ctx.legal.length).toBe(20)
  })
})

describe('classify', () => {
  const ctx = rebuildContext(RECORD)
  it.each([
    [['e5'], 'match', 'e5'],
    [['Nf6'], 'legal', 'Nf6'],
    [['Ke2'], 'illegal', null], // move-shaped but not legal for Black here
    [[], 'unparseable', null],
  ])('candidates %j → %s', (cands, outcome, modelSan) => {
    expect(classify(ctx, RECORD.expectedSan, cands as string[])).toEqual({
      outcome,
      modelSan,
    })
  })
  it('accepts UCI-shaped candidates via from/to', () => {
    expect(classify(ctx, 'e5', ['e7e5'])).toEqual({
      outcome: 'match',
      modelSan: 'e5',
    })
  })
  it('takes the first LEGAL candidate, skipping earlier junk', () => {
    expect(classify(ctx, 'e5', ['Ke2', 'e5'])).toEqual({
      outcome: 'match',
      modelSan: 'e5',
    })
  })
})

describe('runEval', () => {
  it('classifies via the transport and caches replies', async () => {
    const calls: string[] = []
    const transport: Transport = async (_model, request) => {
      calls.push(JSON.stringify(request))
      return 'e5'
    }
    const cache = freshCache()
    const run1 = await runEval({
      model: 'test',
      variant: testVariant,
      positions: [RECORD],
      n: 1,
      transport,
      cache,
    })
    expect(run1.results[0].outcome).toBe('match')
    expect(run1.results[0].cached).toBe(false)
    const run2 = await runEval({
      model: 'test',
      variant: testVariant,
      positions: [RECORD],
      n: 1,
      transport,
      cache,
    })
    expect(run2.results[0].cached).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('passes the merged sampling (including reasoningEffort) to the transport', async () => {
    const samplingSeen: unknown[] = []
    const transport: Transport = async (_model, _request, sampling) => {
      samplingSeen.push(sampling)
      return 'e5'
    }
    const cache = freshCache()
    await runEval({
      model: 'test',
      variant: testVariant,
      positions: [RECORD],
      n: 1,
      transport,
      cache,
      reasoningEffort: 'none',
    })
    expect(samplingSeen[0]).toMatchObject({ reasoningEffort: 'none' })
  })

  it('does not share cache entries between runs differing only in reasoningEffort', async () => {
    let calls = 0
    const transport: Transport = async () => {
      calls++
      return 'e5'
    }
    const cache = freshCache()
    await runEval({
      model: 'test',
      variant: testVariant,
      positions: [RECORD],
      n: 1,
      transport,
      cache,
    })
    await runEval({
      model: 'test',
      variant: testVariant,
      positions: [RECORD],
      n: 1,
      transport,
      cache,
      reasoningEffort: 'none',
    })
    expect(calls).toBe(2)
  })
})
