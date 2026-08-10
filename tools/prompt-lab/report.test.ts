// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EvalRun, Outcome, PositionResult } from './evalRunner'
import {
  compareTable,
  computeStats,
  failuresMarkdown,
  loadRunSummaries,
  sanitizeModelId,
  writeRunReport,
} from './report'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const result = (index: number, outcome: Outcome): PositionResult => ({
  index,
  fen: START_FEN,
  historySan: [],
  expectedSan: 'e4',
  modelSan: outcome === 'match' ? 'e4' : outcome === 'legal' ? 'd4' : null,
  outcome,
  reply: outcome === 'unparseable' ? 'I resign' : 'raw model reply',
  latencyMs: 100 + index,
  cached: false,
})

const run: EvalRun = {
  model: 'google/gemma-4-12b',
  variant: 'v0-baseline',
  description: 'control',
  n: 4,
  results: [
    result(0, 'match'),
    result(1, 'match'),
    result(2, 'legal'),
    result(3, 'illegal'),
  ],
}

describe('computeStats', () => {
  it('computes counts, rates and the binomial standard error', () => {
    const s = computeStats(run)
    expect(s).toMatchObject({ n: 4, match: 2, legal: 1, illegal: 1 })
    expect(s.matchRate).toBeCloseTo(0.5)
    expect(s.matchLegalRate).toBeCloseTo(0.75)
    expect(s.se).toBeCloseTo(Math.sqrt((0.5 * 0.5) / 4))
  })
})

describe('failuresMarkdown', () => {
  it('renders only non-matches, with board, FEN and expected move', () => {
    const md = failuresMarkdown(run)
    expect(md).toContain('+------------------------+') // ascii board frame
    expect(md).toContain(START_FEN)
    expect(md).toContain('Expected (game): **e4**')
    expect(md.match(/^## #/gm)).toHaveLength(2) // legal + illegal only
  })
})

describe('reports on disk', () => {
  it('writeRunReport + loadRunSummaries round-trip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plab-'))
    writeRunReport(dir, run)
    const rows = loadRunSummaries(dir, 'google/gemma-4-12b')
    expect(rows).toHaveLength(1)
    expect(rows[0].variant).toBe('v0-baseline')
    expect(rows[0].stats.match).toBe(2)
  })
  it('sanitizes model ids for directory names', () => {
    expect(sanitizeModelId('google/gemma-4-12b')).toBe('google__gemma-4-12b')
  })
})

describe('compareTable', () => {
  it('sorts by matchRate, then matchLegalRate', () => {
    const s = computeStats(run)
    const better = { ...s, matchRate: 0.9 }
    const table = compareTable([
      { variant: 'worse', stats: s },
      { variant: 'better', stats: better },
    ])
    const lines = table.split('\n')
    expect(lines[2]).toContain('better')
    expect(lines[3]).toContain('worse')
  })
})
