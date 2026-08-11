// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ResponseCache } from './cache'
import type { Transport } from './evalRunner'
import type { PositionRecord } from './positions'
import { rankRuns, runRace } from './race'
import { parseSanCandidates } from '../../src/llm/adapters/genericFen'
import type { PromptVariant } from './variants/types'
import type { RunStats } from './report'

// Two easy fixtures: the start position (expected e4) and after e4 (expected e5).
const RECORDS: PositionRecord[] = [
  {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    historySan: [],
    expectedSan: 'e4',
    turn: 'w',
    ply: 1,
    meta: { white: '', black: '', result: '', date: '', eco: '' },
  },
  {
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    historySan: ['e4'],
    expectedSan: 'e5',
    turn: 'b',
    ply: 2,
    meta: { white: '', black: '', result: '', date: '', eco: '' },
  },
]

// Each variant tags its request content so the scripted transport can answer
// per-variant: 'good' always matches, 'medium' plays legal-but-different,
// 'bad' answers garbage.
const variant = (name: string): PromptVariant => ({
  name,
  description: name,
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [{ role: 'user', content: `${name}|${ctx.state.fen}` }],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 8 },
})

const SCRIPT: Record<string, Record<string, string>> = {
  good: { w: 'e4', b: 'e5' },
  medium: { w: 'd4', b: 'd5' }, // legal, never the game move
  bad: { w: 'xyzzy', b: 'xyzzy' },
}

describe('runRace', () => {
  it('culls to --keep after screening and picks the final winner', async () => {
    const calls: string[] = []
    const transport: Transport = async (_m, request) => {
      if (request.kind !== 'chat') throw new Error('unexpected')
      const [name, fen] = request.messages[0].content.split('|')
      calls.push(name)
      return SCRIPT[name][fen.split(' ')[1]]
    }
    const dir = mkdtempSync(join(tmpdir(), 'plab-'))
    const { winner } = await runRace({
      model: 'test-model',
      variants: [variant('bad'), variant('good'), variant('medium')],
      positions: RECORDS,
      screen: 1,
      final: 2,
      keep: 2,
      transport,
      cache: new ResponseCache(join(dir, 'cache.jsonl')),
      resultsDir: dir,
    })
    expect(winner).toBe('good')
    // 'bad' was screened (1 call) but never ran at final size; the finalists'
    // screening call is cached, so each adds only 1 new call at final=2.
    expect(calls.filter((c) => c === 'bad')).toHaveLength(1)
    expect(calls.filter((c) => c === 'good')).toHaveLength(2)
    expect(calls.filter((c) => c === 'medium')).toHaveLength(2)
  })
})

describe('rankRuns', () => {
  it('breaks a matchRate tie using matchLegalRate', () => {
    const makeStats = (matchLegalRate: number): RunStats => ({
      n: 10,
      match: 5,
      legal: 0,
      illegal: 0,
      unparseable: 0,
      matchRate: 0.5,
      matchLegalRate,
      se: 0,
      latencyMeanMs: 0,
      latencyP95Ms: 0,
    })
    const rows = [
      { variant: 'lower', stats: makeStats(0.6) },
      { variant: 'higher', stats: makeStats(0.8) },
    ]
    expect(rankRuns(rows).map((r) => r.variant)).toEqual(['higher', 'lower'])
  })
})
