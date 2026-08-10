import type { ResponseCache } from './cache'
import { runEval, type Transport } from './evalRunner'
import type { PositionRecord } from './positions'
import {
  compareTable,
  computeStats,
  writeRunReport,
  type RunStats,
} from './report'
import type { PromptVariant } from './variants/types'

export function rankRuns(
  rows: { variant: string; stats: RunStats }[],
): { variant: string; stats: RunStats }[] {
  return [...rows].sort(
    (a, b) =>
      b.stats.matchRate - a.stats.matchRate ||
      b.stats.matchLegalRate - a.stats.matchLegalRate,
  )
}

export async function runRace(opts: {
  model: string
  variants: PromptVariant[]
  positions: PositionRecord[]
  screen: number
  final: number
  keep: number
  transport: Transport
  cache: ResponseCache
  resultsDir: string
  reasoningEffort?: string
  log?: (msg: string) => void
}): Promise<{ winner: string; screenTable: string; finalTable: string }> {
  const log = opts.log ?? (() => {})
  const evalOne = async (variant: PromptVariant, n: number) => {
    log(`eval ${variant.name} (n=${n})…`)
    const run = await runEval({
      model: opts.model,
      variant,
      positions: opts.positions,
      n,
      transport: opts.transport,
      cache: opts.cache,
      reasoningEffort: opts.reasoningEffort,
      onProgress: (done, total, matches) => {
        if (done % 25 === 0 || done === total) {
          log(`  ${variant.name}: ${done}/${total} (match ${matches})`)
        }
      },
    })
    writeRunReport(opts.resultsDir, run)
    return { variant: variant.name, stats: computeStats(run) }
  }

  const screenRows = []
  for (const v of opts.variants) screenRows.push(await evalOne(v, opts.screen))
  const survivors = rankRuns(screenRows)
    .slice(0, opts.keep)
    .map((r) => r.variant)
  log(`screen done; finalists: ${survivors.join(', ')}`)

  const finalRows = []
  for (const v of opts.variants.filter((v) => survivors.includes(v.name))) {
    finalRows.push(await evalOne(v, opts.final))
  }
  return {
    winner: rankRuns(finalRows)[0].variant,
    screenTable: compareTable(screenRows),
    finalTable: compareTable(finalRows),
  }
}
