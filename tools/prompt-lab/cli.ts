import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { parseGames } from './pgn'
import { buildBenchmark } from './sample'

export const DATA_FILE = 'tools/prompt-lab/data/positions.json'
export const RESULTS_DIR = 'tools/prompt-lab/results'

const USAGE = `prompt-lab — move-prompt evaluation harness

Usage: npm run prompt-lab -- <command> [options]

Commands:
  sample    build the shared benchmark from a PGN corpus
  eval      evaluate one prompt variant against the benchmark
  race      screen variants, promote finalists, declare a winner
  compare   print a ranked table of stored runs for a model
`

const args = process.argv.slice(2).filter((a) => a !== '--')
const command = args[0]

if (command === 'sample') {
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
} else {
  console.log(command ? `prompt-lab: unknown command "${command}"` : USAGE)
  process.exit(1)
}
