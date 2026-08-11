import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { listModels, loadModel } from '../../src/llm/client'
import { ResponseCache } from './cache'
import { makeLmStudioTransport, runEval } from './evalRunner'
import { parseGames } from './pgn'
import {
  compareTable,
  computeStats,
  loadRunSummaries,
  sanitizeModelId,
  writeRunReport,
} from './report'
import { rankRuns, runRace } from './race'
import { buildBenchmark, type Benchmark } from './sample'
import { getVariants } from './variants/index'

export const DATA_FILE = 'tools/prompt-lab/data/positions.json'
export const RESULTS_DIR = 'tools/prompt-lab/results'

const USAGE = `prompt-lab — move-prompt evaluation harness

Usage: npm run prompt-lab -- <command> [options]

Commands:
  sample    build the shared benchmark from a PGN corpus
              --pgn <path>         default: karpov.pgn
              --size <n>           default: 1000
              --seed <n>           default: 42

  eval      evaluate one prompt variant against the benchmark
              --model <id>         required
              --prompt <variant>   required
              --n <count>          default: 150
              --base-url <url>     default: http://localhost:1234
              --reasoning-effort <value>  optional, forwarded to the model

  race      screen variants, promote finalists, declare a winner
              --model <id>         required
              --variants <a,b,…>   default: all registered variants
              --screen <count>     default: 150
              --final <count>      default: 600
              --keep <count>       default: 3
              --base-url <url>     default: http://localhost:1234
              --reasoning-effort <value>  optional, forwarded to the model

  compare   print a ranked table of stored runs for a model
              --model <id>         required
`

function loadBenchmark(): Benchmark {
  return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Benchmark
}

async function ensureModel(baseUrl: string, id: string): Promise<void> {
  const models = await listModels(baseUrl)
  const found = models.find((m) => m.id === id)
  if (!found) {
    throw new Error(
      `Model "${id}" not found in LM Studio. Available: ${models
        .map((m) => m.id)
        .join(', ')}`,
    )
  }
  if (found.state !== 'loaded') {
    console.log(`Loading ${id}…`)
    await loadModel(baseUrl, id)
  }
}

function makeCache(model: string): ResponseCache {
  return new ResponseCache(
    join(RESULTS_DIR, sanitizeModelId(model), 'cache.jsonl'),
  )
}

const args = process.argv.slice(2).filter((a) => a !== '--')
const command = args[0]

async function runSample(): Promise<void> {
  const { values } = parseArgs({
    args: args.slice(1),
    allowPositionals: false,
    options: {
      pgn: { type: 'string', default: 'karpov.pgn' },
      size: { type: 'string', default: '1000' },
      seed: { type: 'string', default: '42' },
    },
  })
  const text = readFileSync(values.pgn, 'utf8')
  const { games, skipped } = parseGames(text)
  const bench = buildBenchmark(
    games,
    skipped,
    Number(values.size),
    Number(values.seed),
  )
  mkdirSync('tools/prompt-lab/data', { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(bench))
  console.log(
    `games=${games.length} skipped=${skipped} ` +
      `extracted=${bench.meta.extractedPositions} ` +
      `deduped=${bench.meta.dedupedPositions} → ${bench.positions.length} ` +
      `positions → ${DATA_FILE}`,
  )
}

async function runEvalCommand(): Promise<void> {
  const { values } = parseArgs({
    args: args.slice(1),
    allowPositionals: false,
    options: {
      model: { type: 'string' },
      prompt: { type: 'string' },
      n: { type: 'string', default: '150' },
      'base-url': { type: 'string', default: 'http://localhost:1234' },
      'reasoning-effort': { type: 'string' },
    },
  })
  if (!values.model) throw new Error('--model is required')
  if (!values.prompt) throw new Error('--prompt is required')
  const baseUrl = values['base-url']
  const [variant] = getVariants([values.prompt])
  await ensureModel(baseUrl, values.model)
  const benchmark = loadBenchmark()
  const run = await runEval({
    model: values.model,
    variant,
    positions: benchmark.positions,
    n: Number(values.n),
    transport: makeLmStudioTransport(baseUrl),
    cache: makeCache(values.model),
    reasoningEffort: values['reasoning-effort'],
    onProgress: (done, total, matches) => {
      if (done % 10 === 0 || done === total) {
        console.log(`  ${done}/${total} (match ${matches})`)
      }
    },
  })
  writeRunReport(RESULTS_DIR, run)
  console.log(
    compareTable([{ variant: run.variant, stats: computeStats(run) }]),
  )
}

async function runRaceCommand(): Promise<void> {
  const { values } = parseArgs({
    args: args.slice(1),
    allowPositionals: false,
    options: {
      model: { type: 'string' },
      variants: { type: 'string' },
      screen: { type: 'string', default: '150' },
      final: { type: 'string', default: '600' },
      keep: { type: 'string', default: '3' },
      'base-url': { type: 'string', default: 'http://localhost:1234' },
      'reasoning-effort': { type: 'string' },
    },
  })
  if (!values.model) throw new Error('--model is required')
  const baseUrl = values['base-url']
  const variants = getVariants(values.variants?.split(','))
  await ensureModel(baseUrl, values.model)
  const benchmark = loadBenchmark()
  const { winner, screenTable, finalTable } = await runRace({
    model: values.model,
    variants,
    positions: benchmark.positions,
    screen: Number(values.screen),
    final: Number(values.final),
    keep: Number(values.keep),
    transport: makeLmStudioTransport(baseUrl),
    cache: makeCache(values.model),
    resultsDir: RESULTS_DIR,
    reasoningEffort: values['reasoning-effort'],
    log: console.log,
  })
  console.log('\nScreen:')
  console.log(screenTable)
  console.log('\nFinal:')
  console.log(finalTable)
  console.log(`\nWINNER: ${winner}`)
}

async function runCompareCommand(): Promise<void> {
  const { values } = parseArgs({
    args: args.slice(1),
    allowPositionals: false,
    options: {
      model: { type: 'string' },
    },
  })
  if (!values.model) throw new Error('--model is required')
  const rows = loadRunSummaries(RESULTS_DIR, values.model)
  console.log(compareTable(rankRuns(rows)))
}

async function main(): Promise<void> {
  if (command === 'sample') {
    await runSample()
    return
  }
  if (command === 'eval' || command === 'race' || command === 'compare') {
    try {
      if (command === 'eval') await runEvalCommand()
      else if (command === 'race') await runRaceCommand()
      else await runCompareCommand()
    } catch (e) {
      console.error((e as Error).message)
      process.exit(1)
    }
    return
  }
  console.log(command ? `prompt-lab: unknown command "${command}"` : USAGE)
  process.exit(1)
}

void main()
