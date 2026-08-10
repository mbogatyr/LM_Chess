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

if (!command) {
  console.log(USAGE)
  process.exit(1)
}

console.log(`prompt-lab: unknown command "${command}"`)
process.exit(1)
