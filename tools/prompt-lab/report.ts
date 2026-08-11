import { Chess } from 'chess.js'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EvalRun } from './evalRunner'

export type RunStats = {
  n: number
  match: number
  legal: number
  illegal: number
  unparseable: number
  matchRate: number
  matchLegalRate: number
  se: number
  latencyMeanMs: number
  latencyP95Ms: number
}

export function computeStats(run: EvalRun): RunStats {
  const n = run.n
  const by = (o: string) => run.results.filter((r) => r.outcome === o).length
  const match = by('match')
  const legal = by('legal')
  const p = n > 0 ? match / n : 0
  const lat = run.results.map((r) => r.latencyMs).sort((a, b) => a - b)
  return {
    n,
    match,
    legal,
    illegal: by('illegal'),
    unparseable: by('unparseable'),
    matchRate: p,
    matchLegalRate: n > 0 ? (match + legal) / n : 0,
    se: n > 0 ? Math.sqrt((p * (1 - p)) / n) : 0,
    latencyMeanMs: n > 0 ? lat.reduce((s, x) => s + x, 0) / n : 0,
    latencyP95Ms: n > 0 ? lat[Math.min(n - 1, Math.floor(n * 0.95))] : 0,
  }
}

export function failuresMarkdown(run: EvalRun): string {
  const blocks = run.results
    .filter((r) => r.outcome !== 'match')
    .map((r) =>
      [
        `## #${r.index} — ${r.outcome}`,
        '',
        '```',
        new Chess(r.fen).ascii(),
        '```',
        '',
        `- FEN: \`${r.fen}\``,
        `- Last moves: ${r.historySan.slice(-8).join(' ') || '(game start)'}`,
        `- Expected (game): **${r.expectedSan}** | Model: **${r.modelSan ?? '—'}**`,
        '- Raw reply:',
        '```text',
        r.reply.slice(0, 800),
        '```',
      ].join('\n'),
    )
  return [
    `# Failures — ${run.model} / ${run.variant} (n=${run.n})`,
    ...blocks,
  ].join('\n\n')
}

export function sanitizeModelId(model: string): string {
  return model.replace(/\//g, '__')
}

export function writeRunReport(
  resultsDir: string,
  run: EvalRun,
): { jsonPath: string; failuresPath: string } {
  const dir = join(resultsDir, sanitizeModelId(run.model))
  mkdirSync(dir, { recursive: true })
  const jsonPath = join(dir, `${run.variant}.n${run.n}.json`)
  writeFileSync(
    jsonPath,
    JSON.stringify({ ...run, stats: computeStats(run) }, null, 2),
  )
  const failuresPath = join(dir, `${run.variant}.n${run.n}.failures.md`)
  writeFileSync(failuresPath, failuresMarkdown(run))
  return { jsonPath, failuresPath }
}

export function loadRunSummaries(
  resultsDir: string,
  model: string,
): { variant: string; n: number; stats: RunStats }[] {
  const dir = join(resultsDir, sanitizeModelId(model))
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  return files.map((f) => {
    const run = JSON.parse(readFileSync(join(dir, f), 'utf8')) as EvalRun & {
      stats: RunStats
    }
    return { variant: run.variant, n: run.n, stats: run.stats }
  })
}

const pct = (x: number): string => `${(100 * x).toFixed(1)}%`

export function compareTable(
  rows: { variant: string; stats: RunStats }[],
): string {
  const sorted = [...rows].sort(
    (a, b) =>
      b.stats.matchRate - a.stats.matchRate ||
      b.stats.matchLegalRate - a.stats.matchLegalRate,
  )
  return [
    '| variant | n | match | ±se | match+legal | illegal | unparseable | mean ms |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...sorted.map(
      ({ variant, stats: s }) =>
        `| ${variant} | ${s.n} | ${pct(s.matchRate)} | ${pct(s.se)} | ` +
        `${pct(s.matchLegalRate)} | ${s.illegal} | ${s.unparseable} | ` +
        `${Math.round(s.latencyMeanMs)} |`,
    ),
  ].join('\n')
}
