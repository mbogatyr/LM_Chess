# Prompt Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone TypeScript CLI (`tools/prompt-lab/`) that measures move-selection prompt variants against positions sampled from `karpov.pgn`, plus optimization campaigns for `google/gemma-4-12b` and `qwen/qwen3.5-9b` whose winning prompts get wired into `src/llm/adapters`.

**Architecture:** A pure evaluator: `sample` builds a committed benchmark of positions from the PGN corpus; `eval` scores one prompt variant single-shot per position (temperature 0, response cache); `race` screens many variants on a small prefix and promotes the top `--keep` to a large prefix; Claude iterates between races using the failure logs. Spec: `docs/superpowers/specs/2026-08-10-prompt-lab-design.md`.

**Tech Stack:** TypeScript 5 strict, chess.js 1.4 (`loadPgn`, verbose history with `before` FENs), Node 24 built-ins (`node:util` `parseArgs`, `node:crypto`, `node:fs`, native `fetch`), `vite-node` runner (already installed via Vitest), Vitest for tests. Reuses `src/engine` (legality) and `src/llm` (transports, types, `parseSanCandidates`).

## Global Constraints

- **No new runtime dependencies.** The only new package is dev-only `@types/node` (needed to type-check `node:fs`/`node:crypto`/`process` in `tools/`).
- **No backend, no secrets.** The tool talks only to LM Studio at `http://localhost:1234` (overridable `--base-url`).
- **Dependency direction:** `tools/` may import from `src/`; `src/` must NEVER import from `tools/`. `llm` must not import `ui`.
- **TypeScript strict**; no `any` without a justifying comment.
- **Prettier**: no semicolons, single quotes, trailing commas, 80 col. Run `npm run format` before each commit.
- **typecheck is `tsc -b`** (composite references). Never change it to `--noEmit`. Build artifacts go under `node_modules/.tmp/`.
- **Scoring is single-shot**: one request per position, `temperature: 0`, no correction retries.
- **Benchmark determinism**: same seed + same corpus ⇒ byte-identical `positions.json`. No timestamps in generated data files.
- **Unit tests never hit a live LM Studio** — the transport is injected and mocked.
- Quality gate before any push: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
- Work on branch `feat/prompt-lab`; conventional commit messages.
- Campaign tasks (13, 15) are **operational, Claude-in-the-loop** — they are driven from the main session (long background runs), not dispatched to implementer subagents.

## File Structure

```
tools/prompt-lab/
  cli.ts               # parseArgs + command dispatch (sample|eval|race|compare)
  pgn.ts               # splitPgn, parseGames            (+ pgn.test.ts)
  positions.ts         # extractPositions, PositionRecord (+ positions.test.ts)
  sample.ts            # mulberry32, buildBenchmark       (+ sample.test.ts)
  cache.ts             # cacheKey, ResponseCache          (+ cache.test.ts)
  evalRunner.ts        # rebuildContext, classify, runEval, makeLmStudioTransport (+ test)
  report.ts            # computeStats, failuresMarkdown, writeRunReport, compareTable (+ test)
  race.ts              # rankRuns, runRace                (+ race.test.ts)
  variants/
    types.ts           # PositionContext, PromptVariant
    index.ts           # ALL_VARIANTS registry, getVariants (+ index.test.ts)
    v0-baseline.ts ... v6-pgn-completion.ts (+ one test file per variant)
  data/positions.json  # committed benchmark (generated in Task 4)
  results/             # gitignored (run reports, failures, cache JSONL)
tsconfig.tools.json    # new composite project
docs/prompt-lab/       # campaign reports (Tasks 13, 15)
```

All tool test files start with `// @vitest-environment node` (the project default is jsdom; these tests need Node APIs, not a DOM).

---

### Task 1: Toolchain plumbing + CLI stub

**Files:**

- Create: `tsconfig.tools.json`, `tools/prompt-lab/cli.ts`
- Modify: `tsconfig.json` (add reference), `package.json` (script + devDep), `eslint.config.js` (node globals for tools), `.gitignore`, `.prettierignore`

**Interfaces:**

- Produces: `npm run prompt-lab -- <cmd>` runs `tools/prompt-lab/cli.ts` with `<cmd>` in argv; `tools/` is covered by `tsc -b`, eslint, and Vitest.

- [ ] **Step 1: Install the types dependency**

```bash
npm install --save-dev @types/node
```

- [ ] **Step 2: Create `tsconfig.tools.json`** (composite; includes `tools` plus the `src` subtrees it imports; artifacts to `node_modules/.tmp/`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "composite": true,
    "emitDeclarationOnly": true,
    "types": ["node", "vitest/globals"],
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tools.tsbuildinfo",
    "outDir": "./node_modules/.tmp/tools"
  },
  "include": ["tools", "src/engine", "src/llm"]
}
```

(If `tsc -b` complains about jest-dom matchers in `src/llm` tests, add `"@testing-library/jest-dom"` to `types`.)

- [ ] **Step 3: Reference it from the root `tsconfig.json`**

```json
"references": [
  { "path": "./tsconfig.node.json" },
  { "path": "./tsconfig.tools.json" }
]
```

- [ ] **Step 4: Add the npm script to `package.json`**

```json
"prompt-lab": "vite-node tools/prompt-lab/cli.ts --"
```

- [ ] **Step 5: ESLint — Node globals for `tools/`** (new object before the final `prettier` entry in `eslint.config.js`)

```js
{
  files: ['tools/**/*.ts'],
  languageOptions: { globals: globals.node },
},
```

- [ ] **Step 6: Ignore rules.** Append to `.gitignore`:

```
karpov.pgn
tools/prompt-lab/results/
```

Append to `.prettierignore`:

```
tools/prompt-lab/data/positions.json
```

- [ ] **Step 7: CLI stub** — `tools/prompt-lab/cli.ts`:

```ts
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
```

- [ ] **Step 8: Verify the plumbing**

Run: `npm run prompt-lab` → prints usage, exits 1.
Run: `npm run typecheck && npm run lint` → both pass (tools project builds).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore(prompt-lab): toolchain plumbing + CLI stub"
```

---

### Task 2: `pgn.ts` — corpus splitter + replayer

**Files:**

- Create: `tools/prompt-lab/pgn.ts`, `tools/prompt-lab/pgn.test.ts`

**Interfaces:**

- Consumes: chess.js `Chess` (`loadPgn`, `history({ verbose: true })` → `.before`/`.san`).
- Produces:

```ts
export type ParsedGame = {
  headers: Record<string, string>
  moves: { fenBefore: string; san: string }[]
}
export function splitPgn(text: string): string[]
export function parseGames(text: string): {
  games: ParsedGame[]
  skipped: number
}
```

- [ ] **Step 1: Write the failing tests** (`pgn.test.ts`)

```ts
// @vitest-environment node
import { parseGames, splitPgn } from './pgn'

const GAME_A = `[Event "Test A"]
[White "Alpha, A"]
[Black "Beta, B"]
[Result "1-0"]
[EventDate "2000.??.??"]

1. e4 e5 2. Nf3 Nc6 1-0`

const GAME_B = `[Event "Test B"]
[Result "1/2-1/2"]

1. d4 d5 1/2-1/2`

const BROKEN = `[Event "Broken"]
[Result "*"]

1. e4 Zz9 *`

describe('splitPgn', () => {
  it('splits games on [Event boundaries without matching [EventDate', () => {
    const chunks = splitPgn(`${GAME_A}\n\n${GAME_B}\n`)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toContain('[Event "Test A"]')
    expect(chunks[1]).toContain('[Event "Test B"]')
  })
})

describe('parseGames', () => {
  it('replays moves and exposes before-FENs and headers', () => {
    const { games, skipped } = parseGames(GAME_A)
    expect(skipped).toBe(0)
    expect(games).toHaveLength(1)
    expect(games[0].headers.White).toBe('Alpha, A')
    expect(games[0].moves).toHaveLength(4)
    expect(games[0].moves[0].san).toBe('e4')
    expect(games[0].moves[0].fenBefore).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    )
    expect(games[0].moves[1].fenBefore).toContain(' b ')
  })

  it('skips games chess.js rejects and counts them', () => {
    const { games, skipped } = parseGames(`${GAME_A}\n\n${BROKEN}\n`)
    expect(games).toHaveLength(1)
    expect(skipped).toBe(1)
  })

  it('skips moveless games (e.g. a bare result)', () => {
    const { games, skipped } = parseGames(`[Event "Empty"]\n[Result "*"]\n\n*`)
    expect(games).toHaveLength(0)
    expect(skipped).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail** — `npx vitest run tools/prompt-lab/pgn.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `pgn.ts`**

```ts
import { Chess } from 'chess.js'

export type ParsedGame = {
  headers: Record<string, string>
  moves: { fenBefore: string; san: string }[]
}

// Every game in a PGN export begins with its tag section; `[Event ` (with the
// trailing space) marks it without matching `[EventDate `.
export function splitPgn(text: string): string[] {
  return text
    .split(/\r?\n(?=\[Event )/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

function parseHeaders(chunk: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const m of chunk.matchAll(/^\[(\w+) "([^"]*)"\]/gm)) {
    headers[m[1]] = m[2]
  }
  return headers
}

export function parseGames(text: string): {
  games: ParsedGame[]
  skipped: number
} {
  const games: ParsedGame[] = []
  let skipped = 0
  for (const chunk of splitPgn(text)) {
    const chess = new Chess()
    try {
      chess.loadPgn(chunk)
    } catch {
      skipped++
      continue
    }
    const verbose = chess.history({ verbose: true })
    if (verbose.length === 0) {
      skipped++
      continue
    }
    games.push({
      headers: parseHeaders(chunk),
      moves: verbose.map((m) => ({ fenBefore: m.before, san: m.san })),
    })
  }
  return { games, skipped }
}
```

- [ ] **Step 4: Run tests, verify they pass** — `npx vitest run tools/prompt-lab/pgn.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add tools/prompt-lab/pgn.ts tools/prompt-lab/pgn.test.ts && git commit -m "feat(prompt-lab): PGN corpus splitter and replayer"`

---

### Task 3: `positions.ts` — position extraction

**Files:**

- Create: `tools/prompt-lab/positions.ts`, `tools/prompt-lab/positions.test.ts`

**Interfaces:**

- Consumes: `ParsedGame` from `./pgn`.
- Produces:

```ts
export type PositionRecord = {
  fen: string
  historySan: string[] // SAN of every move before this position
  expectedSan: string // canonical SAN (from chess.js history)
  turn: 'w' | 'b'
  ply: number // 1-based halfmove index of the expected move
  meta: {
    white: string
    black: string
    result: string
    date: string
    eco: string
  }
}
export function extractPositions(game: ParsedGame): PositionRecord[]
```

Rules: drop positions with fewer than two legal moves (forced replies);
skip games with a `SetUp`/`FEN` header entirely (their `historySan` would not
replay from the standard start position — `rebuildContext` in Task 8 depends
on that replay).

- [ ] **Step 1: Write the failing tests** (`positions.test.ts`)

```ts
// @vitest-environment node
import { parseGames } from './pgn'
import { extractPositions } from './positions'

const GAME = `[Event "Test"]
[White "Alpha, A"]
[Black "Beta, B"]
[Result "1-0"]
[Date "2000.01.01"]
[ECO "C20"]

1. e4 e5 2. Nf3 Nc6 1-0`

// After 1. e4 e5 2. Qh5?! Black has many replies, but after 2... Nc6 3. Qxf7#
// never happens — instead craft a forced position via SetUp to assert skipping.
const SETUP_GAME = `[Event "Setup"]
[Result "*"]
[SetUp "1"]
[FEN "k7/8/8/8/8/8/7r/K7 w - - 0 1"]

1. Kb1 *`

describe('extractPositions', () => {
  it('emits one record per ply with history, expected move, and meta', () => {
    const { games } = parseGames(GAME)
    const records = extractPositions(games[0])
    expect(records).toHaveLength(4)
    expect(records[0]).toMatchObject({
      historySan: [],
      expectedSan: 'e4',
      turn: 'w',
      ply: 1,
      meta: {
        white: 'Alpha, A',
        black: 'Beta, B',
        result: '1-0',
        date: '2000.01.01',
        eco: 'C20',
      },
    })
    expect(records[3]).toMatchObject({
      historySan: ['e4', 'e5', 'Nf3'],
      expectedSan: 'Nc6',
      turn: 'b',
      ply: 4,
    })
  })

  it('skips SetUp games entirely', () => {
    const { games } = parseGames(SETUP_GAME)
    expect(extractPositions(games[0])).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail** — `npx vitest run tools/prompt-lab/positions.test.ts` → FAIL.

- [ ] **Step 3: Implement `positions.ts`**

```ts
import { Chess } from 'chess.js'
import type { ParsedGame } from './pgn'

export type PositionRecord = {
  fen: string
  historySan: string[]
  expectedSan: string
  turn: 'w' | 'b'
  ply: number
  meta: {
    white: string
    black: string
    result: string
    date: string
    eco: string
  }
}

export function extractPositions(game: ParsedGame): PositionRecord[] {
  // rebuildContext replays historySan from the standard start; games with a
  // custom start position can't be replayed that way, so skip them wholesale.
  if (game.headers.SetUp || game.headers.FEN) return []
  const records: PositionRecord[] = []
  const historySan: string[] = []
  for (let i = 0; i < game.moves.length; i++) {
    const { fenBefore, san } = game.moves[i]
    // Fewer than two legal moves = a forced reply = free points; drop it.
    if (new Chess(fenBefore).moves().length >= 2) {
      records.push({
        fen: fenBefore,
        historySan: [...historySan],
        expectedSan: san,
        turn: fenBefore.split(' ')[1] as 'w' | 'b',
        ply: i + 1,
        meta: {
          white: game.headers.White ?? '',
          black: game.headers.Black ?? '',
          result: game.headers.Result ?? '',
          date: game.headers.Date ?? '',
          eco: game.headers.ECO ?? '',
        },
      })
    }
    historySan.push(san)
  }
  return records
}
```

- [ ] **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(prompt-lab): position extraction with forced-move and SetUp filtering"`

---

### Task 4: `sample.ts` + `sample` command + generate the committed benchmark

**Files:**

- Create: `tools/prompt-lab/sample.ts`, `tools/prompt-lab/sample.test.ts`, `tools/prompt-lab/data/positions.json` (generated)
- Modify: `tools/prompt-lab/cli.ts`

**Interfaces:**

- Consumes: `parseGames` (Task 2), `extractPositions`, `PositionRecord` (Task 3).
- Produces:

```ts
export function mulberry32(seed: number): () => number
export type Benchmark = {
  meta: {
    seed: number
    requestedSize: number
    sourceGames: number
    skippedGames: number
    extractedPositions: number
    dedupedPositions: number
  }
  positions: PositionRecord[]
}
export function buildBenchmark(
  games: ParsedGame[],
  skippedGames: number,
  size: number,
  seed: number,
): Benchmark
```

Also: the CLI constant `DATA_FILE = 'tools/prompt-lab/data/positions.json'` that Tasks 11 reuses.

- [ ] **Step 1: Write the failing tests** (`sample.test.ts`)

```ts
// @vitest-environment node
import { parseGames } from './pgn'
import { buildBenchmark, mulberry32 } from './sample'

const TWO_GAMES = `[Event "One"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "Two"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nf6 0-1`

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('buildBenchmark', () => {
  it('dedupes shared positions by FEN (ignoring move counters)', () => {
    const { games, skipped } = parseGames(TWO_GAMES)
    const bench = buildBenchmark(games, skipped, 100, 42)
    // The games differ only in the 4th MOVE (Nc6 vs Nf6) — all four
    // POSITIONS (before each move) have identical FENs, so dedupe keeps
    // game One's four records and drops all of game Two's.
    expect(bench.meta.extractedPositions).toBe(8)
    expect(bench.meta.dedupedPositions).toBe(4)
    expect(bench.positions).toHaveLength(4)
  })

  it('is reproducible: same seed, same order', () => {
    const { games, skipped } = parseGames(TWO_GAMES)
    const a = buildBenchmark(games, skipped, 5, 7)
    const b = buildBenchmark(games, skipped, 5, 7)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('truncates to the requested size', () => {
    const { games, skipped } = parseGames(TWO_GAMES)
    expect(buildBenchmark(games, skipped, 2, 1).positions).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement `sample.ts`**

```ts
import type { ParsedGame } from './pgn'
import { extractPositions, type PositionRecord } from './positions'

// Deterministic 32-bit PRNG — the benchmark must be byte-reproducible.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Benchmark = {
  meta: {
    seed: number
    requestedSize: number
    sourceGames: number
    skippedGames: number
    extractedPositions: number
    dedupedPositions: number
  }
  positions: PositionRecord[]
}

// Board + turn + castling + en passant; halfmove/fullmove counters excluded
// so transpositions across games collapse into one benchmark entry.
const fenKey = (fen: string): string => fen.split(' ').slice(0, 4).join(' ')

export function buildBenchmark(
  games: ParsedGame[],
  skippedGames: number,
  size: number,
  seed: number,
): Benchmark {
  const all: PositionRecord[] = []
  for (const g of games) all.push(...extractPositions(g))
  const seen = new Set<string>()
  const deduped = all.filter((p) => {
    const k = fenKey(p.fen)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const rand = mulberry32(seed)
  const shuffled = [...deduped]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return {
    meta: {
      seed,
      requestedSize: size,
      sourceGames: games.length,
      skippedGames,
      extractedPositions: all.length,
      dedupedPositions: deduped.length,
    },
    positions: shuffled.slice(0, size),
  }
}
```

- [ ] **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Wire the `sample` command into `cli.ts`** (replace the stub's fall-through; keep USAGE)

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { parseGames } from './pgn'
import { buildBenchmark } from './sample'

export const DATA_FILE = 'tools/prompt-lab/data/positions.json'
export const RESULTS_DIR = 'tools/prompt-lab/results'

const args = process.argv.slice(2).filter((a) => a !== '--')
const command = args[0]

const { values } = parseArgs({
  args: args.slice(1),
  allowPositionals: false,
  options: {
    pgn: { type: 'string', default: 'karpov.pgn' },
    size: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '42' },
  },
})

if (command === 'sample') {
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
```

(Structure the file so later tasks add `eval`/`race`/`compare` branches with their own `parseArgs` option sets — one `parseArgs` call per command branch is fine and keeps options local.)

- [ ] **Step 6: Generate the real benchmark** (needs `karpov.pgn` in the repo root — it is gitignored but present locally)

Run: `npm run prompt-lab -- sample --size 1000 --seed 42`
Expected: ~2300 games parsed, a small `skipped` count, >100k extracted, and `tools/prompt-lab/data/positions.json` written (~0.5 MB). Sanity-check: `node -e "const b=require('./tools/prompt-lab/data/positions.json'); console.log(b.meta, b.positions.length)"`.

- [ ] **Step 7: Run the full test suite** — `npm test` → PASS.

- [ ] **Step 8: Commit (including the generated benchmark)**

```bash
git add -A && git commit -m "feat(prompt-lab): seeded benchmark sampler + committed 1000-position benchmark"
```

---

### Task 5: `variants/types.ts`, `v0-baseline`, registry

**Files:**

- Create: `tools/prompt-lab/variants/types.ts`, `tools/prompt-lab/variants/v0-baseline.ts`, `tools/prompt-lab/variants/index.ts`, `tools/prompt-lab/variants/v0-baseline.test.ts`, `tools/prompt-lab/variants/index.test.ts`

**Interfaces:**

- Consumes: `GameState`, `LegalMove` from `src/engine/types`; `ModelRequest` from `src/llm/adapters/types`; `genericFenAdapter`, `parseSanCandidates` from `src/llm/adapters/genericFen`.
- Produces:

```ts
// variants/types.ts
export type PositionContext = { state: GameState; legal: LegalMove[] }
export type PromptVariant = {
  name: string
  description: string
  buildRequest(ctx: PositionContext): ModelRequest
  parse(reply: string): string[]
  sampling: { temperature: number; maxTokens: number }
}
// variants/index.ts
export const ALL_VARIANTS: PromptVariant[]
export function getVariants(names?: string[]): PromptVariant[]
// variants/v0-baseline.ts
export const BASELINE_ELO = 1600
export const v0Baseline: PromptVariant
```

- [ ] **Step 1: Write the failing tests**

`v0-baseline.test.ts`:

```ts
// @vitest-environment node
import { newGame, legalMoves, move } from '../../../src/engine/game'
import { genericFenAdapter } from '../../../src/llm/adapters/genericFen'
import { BASELINE_ELO, v0Baseline } from './v0-baseline'

describe('v0-baseline', () => {
  it('builds the exact production genericFen request at the baseline elo', () => {
    let state = newGame()
    state = move(state, 'e4')!
    const legal = legalMoves(state)
    const expected = genericFenAdapter.buildRequest({
      state,
      elo: BASELINE_ELO,
      legal,
    })
    expect(v0Baseline.buildRequest({ state, legal })).toEqual(expected)
  })

  it('scores deterministically: temperature 0', () => {
    expect(v0Baseline.sampling.temperature).toBe(0)
  })
})
```

`index.test.ts`:

```ts
// @vitest-environment node
import { ALL_VARIANTS, getVariants } from './index'

describe('variant registry', () => {
  it('has unique names', () => {
    const names = ALL_VARIANTS.map((v) => v.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('resolves by exact name and rejects unknowns', () => {
    expect(getVariants(['v0-baseline'])[0].name).toBe('v0-baseline')
    expect(() => getVariants(['nope'])).toThrow(/Unknown variant/)
  })

  it('defaults to the whole roster', () => {
    expect(getVariants()).toEqual(ALL_VARIANTS)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement.** `variants/types.ts`:

```ts
import type { GameState, LegalMove } from '../../../src/engine/types'
import type { ModelRequest } from '../../../src/llm/adapters/types'

export type PositionContext = { state: GameState; legal: LegalMove[] }

export type PromptVariant = {
  name: string
  description: string
  buildRequest(ctx: PositionContext): ModelRequest
  parse(reply: string): string[]
  sampling: { temperature: number; maxTokens: number }
}
```

`variants/v0-baseline.ts`:

```ts
import {
  genericFenAdapter,
  parseSanCandidates,
} from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

// The app's strongest ELO band tops out at 1600 (src/ui/app/demoData.ts), so
// the control measures the prompt the app actually sends at max strength.
export const BASELINE_ELO = 1600

export const v0Baseline: PromptVariant = {
  name: 'v0-baseline',
  description: 'Production genericFen prompt, unchanged (control)',
  buildRequest: (ctx) =>
    genericFenAdapter.buildRequest({
      state: ctx.state,
      elo: BASELINE_ELO,
      legal: ctx.legal,
    }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
```

`variants/index.ts`:

```ts
import type { PromptVariant } from './types'
import { v0Baseline } from './v0-baseline'

export const ALL_VARIANTS: PromptVariant[] = [v0Baseline]

export function getVariants(names?: string[]): PromptVariant[] {
  if (!names || names.length === 0) return ALL_VARIANTS
  return names.map((n) => {
    const v = ALL_VARIANTS.find((x) => x.name === n)
    if (!v) {
      throw new Error(
        `Unknown variant "${n}". Known: ${ALL_VARIANTS.map((x) => x.name).join(', ')}`,
      )
    }
    return v
  })
}
```

- [ ] **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(prompt-lab): PromptVariant interface, registry, v0-baseline control"`

---

### Task 6: Variants `v1-legal-list`, `v2-uci`, `v3-board`

**Files:**

- Create: `tools/prompt-lab/variants/v1-legal-list.ts` (+ `.test.ts`), `v2-uci.ts` (+ `.test.ts`), `v3-board.ts` (+ `.test.ts`)
- Modify: `tools/prompt-lab/variants/index.ts` (register)

**Interfaces:**

- Consumes: `PromptVariant`, `PositionContext` (Task 5); `parseSanCandidates` from `src/llm/adapters/genericFen`; chess.js `ascii()`.
- Produces: `v1LegalList`, `v2Uci` (+ exported `parseUciCandidates`), `v3Board`, all registered in `ALL_VARIANTS`.

All three share the persona line `'You are a strong chess grandmaster.'` — deliberately one shared persona across v1–v6 so they differ from each other in a single dimension each (the ELO-persona dimension itself is explored in-loop during campaigns).

- [ ] **Step 1: Write the failing tests.** One test file per variant; the pattern (shown for v1, mirror for the others):

```ts
// @vitest-environment node
import { newGame, legalMoves } from '../../../src/engine/game'
import { v1LegalList } from './v1-legal-list'

describe('v1-legal-list', () => {
  it('lists the legal moves in the user message', () => {
    const state = newGame()
    const req = v1LegalList.buildRequest({ state, legal: legalMoves(state) })
    if (req.kind !== 'chat') throw new Error('expected chat request')
    const user = req.messages.find((m) => m.role === 'user')!.content
    expect(user).toContain('Legal moves:')
    expect(user).toContain('Nf3')
    expect(user).toContain(state.fen)
  })
})
```

For v2 additionally test the parser:

```ts
import { parseUciCandidates } from './v2-uci'

it('extracts UCI tokens, last-mentioned first, lowercased', () => {
  expect(parseUciCandidates('I considered g1f3 but play E2E4')).toEqual([
    'e2e4',
    'g1f3',
  ])
})
it('keeps promotion suffixes', () => {
  expect(parseUciCandidates('e7e8q')).toEqual(['e7e8q'])
})
```

For v3 test that the user message contains an ASCII rank line (`'| r  n  b  q  k  b  n  r |'` appears in `new Chess(fen).ascii()` for the start position) and the FEN.

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement.** `v1-legal-list.ts`:

```ts
import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

const SYSTEM =
  'You are a strong chess grandmaster. You will be given a chess position ' +
  'and the list of all legal moves. Choose the best move. Reply with ONLY ' +
  'that move in Standard Algebraic Notation, exactly as it appears in the ' +
  'list. No explanation.'

export const v1LegalList: PromptVariant = {
  name: 'v1-legal-list',
  description: 'Legal-move list included; model picks from it',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          `Position (FEN): ${ctx.state.fen}\n` +
          `Legal moves: ${ctx.legal.map((m) => m.san).join(' ')}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn. Your move:`,
      },
    ],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
```

`v2-uci.ts`:

```ts
import type { PromptVariant } from './types'

const UCI_RE = /\b([a-h][1-8][a-h][1-8][qrbnQRBN]?)\b/g

// Last-mentioned first, like parseSanCandidates: chatty replies often discard
// early candidates and finish with the chosen move.
export function parseUciCandidates(reply: string): string[] {
  const tokens = [...reply.matchAll(UCI_RE)].map((m) => m[1].toLowerCase())
  const out: string[] = []
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!out.includes(tokens[i])) out.push(tokens[i])
  }
  return out
}

const SYSTEM =
  'You are a strong chess grandmaster. Reply with ONLY your move in UCI ' +
  'coordinate notation: from-square then to-square, e.g. e2e4, g8f6, e7e8q. ' +
  'No explanation.'

export const v2Uci: PromptVariant = {
  name: 'v2-uci',
  description: 'Answer in UCI coordinates instead of SAN',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          `Position (FEN): ${ctx.state.fen}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn. Your move:`,
      },
    ],
  }),
  parse: parseUciCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
```

`v3-board.ts` — same shape as v2 but SAN reply, and the user message starts
with a board diagram:

```ts
import { Chess } from 'chess.js'
import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

const SYSTEM =
  'You are a strong chess grandmaster. Reply with ONLY your move in ' +
  'Standard Algebraic Notation (SAN), for example: Nf3, e5, O-O, exd8=Q. ' +
  'No explanation.'

export const v3Board: PromptVariant = {
  name: 'v3-board',
  description: 'ASCII board diagram + FEN',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          `Current board (uppercase = White, lowercase = Black):\n` +
          `${new Chess(ctx.state.fen).ascii()}\n` +
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          `Position (FEN): ${ctx.state.fen}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn. Your move:`,
      },
    ],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
```

Register all three in `variants/index.ts`:
`ALL_VARIANTS = [v0Baseline, v1LegalList, v2Uci, v3Board]`.

- [ ] **Step 4: Run tests, verify they pass** (including the registry uniqueness test).

- [ ] **Step 5: Commit** — `git commit -m "feat(prompt-lab): variants v1-legal-list, v2-uci, v3-board"`

---

### Task 7: Variants `v4-cot`, `v5-fewshot`, `v6-pgn-completion`

**Files:**

- Create: `tools/prompt-lab/variants/v4-cot.ts` (+ `.test.ts`), `v5-fewshot.ts` (+ `.test.ts`), `v6-pgn-completion.ts` (+ `.test.ts`)
- Modify: `tools/prompt-lab/variants/index.ts` (register; final roster v0…v6)

**Interfaces:**

- Consumes: `PromptVariant` (Task 5); `toPgn` from `src/llm/adapters/encoding`; `parseSanCandidates`.
- Produces: `v4Cot` (+ `parseFinalLineSan`), `v5Fewshot`, `v6PgnCompletion` (+ `parseFirstSan`).

- [ ] **Step 1: Write the failing tests.** Key cases:

```ts
// v4-cot.test.ts
import { parseFinalLineSan } from './v4-cot'
it('prefers the last line over moves mentioned while thinking', () => {
  expect(parseFinalLineSan('Candidates: Nf3, d4. Nf3 develops...\nd4')[0]).toBe(
    'd4',
  )
})
it('falls back to whole-reply parsing when the last line has no move', () => {
  expect(parseFinalLineSan('I would play Nf3.\nGood luck!')).toContain('Nf3')
})

// v5-fewshot.test.ts — the two worked examples must themselves be legal:
import { newGame, move } from '../../../src/engine/game'
it('example answers are legal in their example positions', () => {
  const req = v5Fewshot.buildRequest({ state: newGame(), legal: [] })
  if (req.kind !== 'chat') throw new Error('expected chat')
  const pairs: [string, string][] = []
  for (let i = 0; i < req.messages.length - 1; i++) {
    const m = req.messages[i]
    const next = req.messages[i + 1]
    if (m.role === 'user' && next.role === 'assistant') {
      pairs.push([m.content, next.content])
    }
  }
  expect(pairs.length).toBeGreaterThanOrEqual(2)
  for (const [user, san] of pairs) {
    const fen = /Position \(FEN\): (.+)/.exec(user)![1].trim()
    expect(move(newGame(fen), san)).not.toBeNull()
  }
})

// v6-pgn-completion.test.ts
it('builds a completion prompt ending at the side to move', () => {
  let state = newGame()
  state = move(state, 'e4')!
  state = move(state, 'e5')!
  const req = v6PgnCompletion.buildRequest({ state, legal: [] })
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt).toContain('[White "Kasparov, Garry"]')
  expect(req.prompt.trimEnd().endsWith('1. e4 e5 2.')).toBe(true)
})
it('parses the first continuation move, not later ones', () => {
  expect(parseFirstSan(' Nf3 Nc6 3. Bb5')[0]).toBe('Nf3')
})
```

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement.** `v4-cot.ts`:

```ts
import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

export function parseFinalLineSan(reply: string): string[] {
  const lines = reply
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const last = lines[lines.length - 1] ?? ''
  const fromLast = parseSanCandidates(last)
  return fromLast.length > 0 ? fromLast : parseSanCandidates(reply)
}

const SYSTEM =
  'You are a strong chess grandmaster. Think about the position step by ' +
  'step — candidate moves, tactics, threats — in at most 100 words. Then ' +
  'write your final chosen move ALONE on the last line, in Standard ' +
  'Algebraic Notation (SAN).'

export const v4Cot: PromptVariant = {
  name: 'v4-cot',
  description: 'Brief chain-of-thought, final move on the last line',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          `Position (FEN): ${ctx.state.fen}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn.`,
      },
    ],
  }),
  parse: parseFinalLineSan,
  sampling: { temperature: 0, maxTokens: 512 },
}
```

`v5-fewshot.ts` — baseline-shaped system prompt plus two verified
user/assistant example pairs before the real question (`a6` after 1. e4 e5 2. Nf3 Nc6 3. Bb5, and `cxd5` after 1. d4 d5 2. c4 Nf6 — FENs below are
canonical chess.js FENs for those lines):

```ts
import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

const SYSTEM =
  'You are a strong chess grandmaster. Given a chess position, reply with ' +
  'ONLY the best move in Standard Algebraic Notation (SAN). No explanation.'

const EXAMPLE_1_FEN =
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'
const EXAMPLE_2_FEN =
  'rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3'

const example = (fen: string, turn: string): string =>
  `Position (FEN): ${fen}\nIt is ${turn}'s turn. Your move:`

export const v5Fewshot: PromptVariant = {
  name: 'v5-fewshot',
  description: 'Two worked position→move examples before the real question',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: example(EXAMPLE_1_FEN, 'Black') },
      { role: 'assistant', content: 'a6' },
      { role: 'user', content: example(EXAMPLE_2_FEN, 'White') },
      { role: 'assistant', content: 'cxd5' },
      {
        role: 'user',
        content:
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          example(ctx.state.fen, ctx.state.turn === 'w' ? 'White' : 'Black'),
      },
    ],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
```

`v6-pgn-completion.ts`:

```ts
import { toPgn } from '../../../src/llm/adapters/encoding'
import type { PromptVariant } from './types'

const SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g

// First-mentioned first: a completion continues the movetext, so the first
// token IS the move (later tokens are the model continuing the game).
export function parseFirstSan(reply: string): string[] {
  const out: string[] = []
  for (const m of reply.matchAll(SAN_RE)) {
    if (!out.includes(m[0])) out.push(m[0])
  }
  return out
}

const HEADERS =
  '[Event "World Chess Championship"]\n' +
  '[White "Kasparov, Garry"]\n' +
  '[Black "Karpov, Anatoly"]\n' +
  '[WhiteElo "2800"]\n' +
  '[BlackElo "2780"]\n' +
  '[Result "*"]\n\n'

export const v6PgnCompletion: PromptVariant = {
  name: 'v6-pgn-completion',
  description: 'Raw completion: continue the PGN movetext of a GM game',
  buildRequest: (ctx) => {
    const movetext = toPgn(ctx.state)
    const fullmove = Number(ctx.state.fen.split(' ')[5])
    // White to move: append the next move number so the model completes it.
    const lead =
      ctx.state.turn === 'w' ? `${movetext ? ' ' : ''}${fullmove}.` : ''
    return { kind: 'completion', prompt: HEADERS + movetext + lead }
  },
  parse: parseFirstSan,
  sampling: { temperature: 0, maxTokens: 12 },
}
```

Register: `ALL_VARIANTS = [v0Baseline, v1LegalList, v2Uci, v3Board, v4Cot, v5Fewshot, v6PgnCompletion]`.

- [ ] **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(prompt-lab): variants v4-cot, v5-fewshot, v6-pgn-completion"`

---

### Task 8: `cache.ts` — response cache

**Files:**

- Create: `tools/prompt-lab/cache.ts`, `tools/prompt-lab/cache.test.ts`

**Interfaces:**

- Consumes: `ModelRequest` from `src/llm/adapters/types`; `node:crypto`, `node:fs`.
- Produces:

```ts
export type CacheEntry = { reply: string; latencyMs: number }
export function cacheKey(
  model: string,
  request: ModelRequest,
  sampling: { temperature: number; maxTokens: number },
): string // sha256 hex
export class ResponseCache {
  constructor(filePath: string)
  get(key: string): CacheEntry | undefined
  put(key: string, entry: CacheEntry): void // appends JSONL, updates memory
}
```

- [ ] **Step 1: Write the failing tests** (use `fs.mkdtempSync(join(os.tmpdir(), 'plab-'))` for the file path)

```ts
// @vitest-environment node
import { appendFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cacheKey, ResponseCache } from './cache'

const req = (content: string) =>
  ({ kind: 'chat', messages: [{ role: 'user', content }] }) as const
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
```

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement `cache.ts`**

```ts
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ModelRequest } from '../../src/llm/adapters/types'

export type CacheEntry = { reply: string; latencyMs: number }

export function cacheKey(
  model: string,
  request: ModelRequest,
  sampling: { temperature: number; maxTokens: number },
): string {
  return createHash('sha256')
    .update(JSON.stringify({ model, request, sampling }))
    .digest('hex')
}

export class ResponseCache {
  private entries = new Map<string, CacheEntry>()

  constructor(private filePath: string) {
    if (!existsSync(filePath)) return
    for (const line of readFileSync(filePath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const { key, reply, latencyMs } = JSON.parse(line) as {
          key: string
          reply: string
          latencyMs: number
        }
        this.entries.set(key, { reply, latencyMs })
      } catch {
        // torn last line from an interrupted run — safe to ignore
      }
    }
  }

  get(key: string): CacheEntry | undefined {
    return this.entries.get(key)
  }

  put(key: string, entry: CacheEntry): void {
    this.entries.set(key, entry)
    mkdirSync(dirname(this.filePath), { recursive: true })
    appendFileSync(this.filePath, `${JSON.stringify({ key, ...entry })}\n`)
  }
}
```

- [ ] **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(prompt-lab): request-keyed response cache (JSONL, resumable)"`

---

### Task 9: `evalRunner.ts` — the scoring loop

**Files:**

- Create: `tools/prompt-lab/evalRunner.ts`, `tools/prompt-lab/evalRunner.test.ts`

**Interfaces:**

- Consumes: `newGame`/`move`/`legalMoves` from `src/engine/game`; `chatCompletion`/`completion` from `src/llm/chat`; `cacheKey`/`ResponseCache` (Task 8); `PositionRecord` (Task 3); `PromptVariant`/`PositionContext` (Task 5).
- Produces:

```ts
export type Outcome = 'match' | 'legal' | 'illegal' | 'unparseable'
export type PositionResult = {
  index: number
  fen: string
  historySan: string[]
  expectedSan: string
  modelSan: string | null
  outcome: Outcome
  reply: string
  latencyMs: number
  cached: boolean
}
export type EvalRun = {
  model: string
  variant: string
  description: string
  n: number
  results: PositionResult[]
}
export type Transport = (
  model: string,
  request: ModelRequest,
  sampling: { temperature: number; maxTokens: number },
) => Promise<string>
export function rebuildContext(record: PositionRecord): PositionContext
export function classify(
  ctx: PositionContext,
  expectedSan: string,
  candidates: string[],
): { outcome: Outcome; modelSan: string | null }
export function runEval(opts: {
  model: string
  variant: PromptVariant
  positions: PositionRecord[]
  n: number
  transport: Transport
  cache: ResponseCache
  onProgress?: (done: number, total: number, matches: number) => void
}): Promise<EvalRun>
export function makeLmStudioTransport(
  baseUrl: string,
  timeoutMs?: number, // default 60_000
  retries?: number, // default 3
): Transport
```

- [ ] **Step 1: Write the failing tests**

```ts
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
})
```

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement `evalRunner.ts`**

```ts
import { legalMoves, move, newGame } from '../../src/engine/game'
import type { GameState, PromotionPiece } from '../../src/engine/types'
import { chatCompletion, completion } from '../../src/llm/chat'
import type { ModelRequest } from '../../src/llm/adapters/types'
import { cacheKey, ResponseCache } from './cache'
import type { PositionRecord } from './positions'
import type { PositionContext, PromptVariant } from './variants/types'

export type Outcome = 'match' | 'legal' | 'illegal' | 'unparseable'

export type PositionResult = {
  index: number
  fen: string
  historySan: string[]
  expectedSan: string
  modelSan: string | null
  outcome: Outcome
  reply: string
  latencyMs: number
  cached: boolean
}

export type EvalRun = {
  model: string
  variant: string
  description: string
  n: number
  results: PositionResult[]
}

export type Transport = (
  model: string,
  request: ModelRequest,
  sampling: { temperature: number; maxTokens: number },
) => Promise<string>

export function rebuildContext(record: PositionRecord): PositionContext {
  let state: GameState = newGame()
  for (const san of record.historySan) {
    const next = move(state, san)
    if (!next) {
      throw new Error(
        `Benchmark corrupt: cannot replay "${san}" toward ${record.fen}`,
      )
    }
    state = next
  }
  if (state.fen !== record.fen) {
    throw new Error(`Benchmark corrupt: replay mismatch for ${record.fen}`)
  }
  return { state, legal: legalMoves(state) }
}

const UCI_SHAPE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i

export function classify(
  ctx: PositionContext,
  expectedSan: string,
  candidates: string[],
): { outcome: Outcome; modelSan: string | null } {
  if (candidates.length === 0) {
    return { outcome: 'unparseable', modelSan: null }
  }
  for (const c of candidates) {
    const uci = UCI_SHAPE.exec(c)
    const input = uci
      ? {
          from: uci[1].toLowerCase(),
          to: uci[2].toLowerCase(),
          ...(uci[3]
            ? { promotion: uci[3].toLowerCase() as PromotionPiece }
            : {}),
        }
      : c
    const next = move(ctx.state, input)
    if (next?.lastMove) {
      return {
        outcome: next.lastMove.san === expectedSan ? 'match' : 'legal',
        modelSan: next.lastMove.san,
      }
    }
  }
  return { outcome: 'illegal', modelSan: null }
}

export async function runEval(opts: {
  model: string
  variant: PromptVariant
  positions: PositionRecord[]
  n: number
  transport: Transport
  cache: ResponseCache
  onProgress?: (done: number, total: number, matches: number) => void
}): Promise<EvalRun> {
  const slice = opts.positions.slice(0, opts.n)
  const results: PositionResult[] = []
  let matches = 0
  for (let i = 0; i < slice.length; i++) {
    const record = slice[i]
    const ctx = rebuildContext(record)
    const request = opts.variant.buildRequest(ctx)
    const key = cacheKey(opts.model, request, opts.variant.sampling)
    const hit = opts.cache.get(key)
    let reply: string
    let latencyMs: number
    let cached: boolean
    if (hit) {
      ;({ reply, latencyMs } = hit)
      cached = true
    } else {
      const t0 = Date.now()
      reply = await opts.transport(opts.model, request, opts.variant.sampling)
      latencyMs = Date.now() - t0
      cached = false
      opts.cache.put(key, { reply, latencyMs })
    }
    const { outcome, modelSan } = classify(
      ctx,
      record.expectedSan,
      opts.variant.parse(reply),
    )
    if (outcome === 'match') matches++
    results.push({
      index: i,
      fen: record.fen,
      historySan: record.historySan,
      expectedSan: record.expectedSan,
      modelSan,
      outcome,
      reply,
      latencyMs,
      cached,
    })
    opts.onProgress?.(i + 1, slice.length, matches)
  }
  return {
    model: opts.model,
    variant: opts.variant.name,
    description: opts.variant.description,
    n: slice.length,
    results,
  }
}

export function makeLmStudioTransport(
  baseUrl: string,
  timeoutMs = 60_000,
  retries = 3,
): Transport {
  return async (model, request, sampling) => {
    let lastError: unknown
    for (let attempt = 0; attempt < retries; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
      }
      const signal = AbortSignal.timeout(timeoutMs)
      try {
        if (request.kind === 'chat') {
          return await chatCompletion(baseUrl, {
            model,
            messages: request.messages,
            temperature: sampling.temperature,
            maxTokens: sampling.maxTokens,
            signal,
          })
        }
        return await completion(baseUrl, {
          model,
          prompt: request.prompt,
          temperature: sampling.temperature,
          maxTokens: sampling.maxTokens,
          signal,
        })
      } catch (e) {
        lastError = e
      }
    }
    throw lastError
  }
}
```

- [ ] **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(prompt-lab): eval runner — replay, classify, cache-aware scoring loop"`

---

### Task 10: `report.ts` — stats, failure logs, compare table

**Files:**

- Create: `tools/prompt-lab/report.ts`, `tools/prompt-lab/report.test.ts`

**Interfaces:**

- Consumes: `EvalRun`, `PositionResult` (Task 9); chess.js `ascii()`; `node:fs`.
- Produces:

```ts
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
export function computeStats(run: EvalRun): RunStats
export function failuresMarkdown(run: EvalRun): string
export function sanitizeModelId(model: string): string // '/' → '__'
export function writeRunReport(
  resultsDir: string,
  run: EvalRun,
): { jsonPath: string; failuresPath: string }
export function loadRunSummaries(
  resultsDir: string,
  model: string,
): { variant: string; n: number; stats: RunStats }[] // reads stored *.json
export function compareTable(
  rows: { variant: string; stats: RunStats }[],
): string
```

- [ ] **Step 1: Write the failing tests** (`report.test.ts`)

```ts
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
```

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement `report.ts`**

````ts
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
````

- [ ] **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(prompt-lab): run stats, Claude-readable failure logs, compare table"`

---

### Task 11: `race.ts` + CLI commands `eval`, `race`, `compare`

**Files:**

- Create: `tools/prompt-lab/race.ts`, `tools/prompt-lab/race.test.ts`
- Modify: `tools/prompt-lab/cli.ts`

**Interfaces:**

- Consumes: everything above; `listModels`/`loadModel` from `src/llm/client`.
- Produces:

```ts
export function rankRuns(
  rows: { variant: string; stats: RunStats }[],
): { variant: string; stats: RunStats }[] // matchRate desc, matchLegalRate tiebreak
export function runRace(opts: {
  model: string
  variants: PromptVariant[]
  positions: PositionRecord[]
  screen: number
  final: number
  keep: number
  transport: Transport
  cache: ResponseCache
  resultsDir: string
  log?: (msg: string) => void
}): Promise<{ winner: string; screenTable: string; finalTable: string }>
```

CLI surface (all defaults per spec):

```
eval    --model <id> --prompt <variant> [--n 150] [--base-url http://localhost:1234]
race    --model <id> [--variants v0-baseline,v1-legal-list,…(default: all)]
        [--screen 150] [--final 600] [--keep 3] [--base-url …]
compare --model <id>
```

- [ ] **Step 1: Write the failing tests** (`race.test.ts`)

```ts
// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ResponseCache } from './cache'
import type { Transport } from './evalRunner'
import type { PositionRecord } from './positions'
import { runRace } from './race'
import { parseSanCandidates } from '../../src/llm/adapters/genericFen'
import type { PromptVariant } from './variants/types'

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
```

Also test `rankRuns` directly: two rows with equal `matchRate` and different
`matchLegalRate` — the higher `matchLegalRate` sorts first.

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement `race.ts`**

```ts
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
```

- [ ] **Step 4: Wire `eval`, `race`, `compare` into `cli.ts`.** Shared helpers in the file:

```ts
import { listModels, loadModel } from '../../src/llm/client'
import { ResponseCache } from './cache'
import { makeLmStudioTransport, runEval } from './evalRunner'
import {
  compareTable,
  computeStats,
  loadRunSummaries,
  sanitizeModelId,
  writeRunReport,
} from './report'
import { runRace, rankRuns } from './race'
import { getVariants } from './variants/index'
import type { Benchmark } from './sample'
import { join } from 'node:path'

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
```

`eval` branch: parse `--model`, `--prompt`, `--n` (default `'150'`), `--base-url` (default `'http://localhost:1234'`); then `ensureModel` → `runEval` with `makeLmStudioTransport(baseUrl)`, a progress log every 10 positions, `writeRunReport`, and print `compareTable([{ variant, stats }])`.

`race` branch: parse `--model`, `--variants` (comma-split, default all), `--screen` `'150'`, `--final` `'600'`, `--keep` `'3'`, `--base-url`; `ensureModel` → `runRace(…, { log: console.log })` → print both tables and `WINNER: <name>`.

`compare` branch: `loadRunSummaries(RESULTS_DIR, model)` → print `compareTable(rankRuns(rows))` (no network).

Errors: wrap each command body in `try/catch`, print `error.message`, `process.exit(1)`.

- [ ] **Step 5: Run tests, verify they pass** — `npx vitest run tools/prompt-lab` → all green.

- [ ] **Step 6: CLI smoke test (no model call)** — `npm run prompt-lab -- compare --model google/gemma-4-12b` → prints an empty table (no stored runs yet), exits 0. `npm run prompt-lab -- eval` (missing `--model`) → clear error, exit 1.

- [ ] **Step 7: Commit** — `git commit -m "feat(prompt-lab): race with screen/cull/final + eval/race/compare CLI"`

---

### Task 12: Quality gate + docs checkpoint

**Files:**

- Modify: `CLAUDE.md` (project structure: add `tools/prompt-lab`; mention the harness under a new "Prompt Lab" bullet in the roadmap section)

- [ ] **Step 1: Full local gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all five green. Fix anything that isn't before proceeding.

- [ ] **Step 2: Update `CLAUDE.md`** — add `tools/prompt-lab/` to the project-structure block with a one-line description ("standalone move-prompt evaluation harness — see docs/superpowers/specs/2026-08-10-prompt-lab-design.md") and note the `prompt-lab` npm script.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "docs: register prompt-lab harness in CLAUDE.md"`

---

### Task 13: Campaign — `google/gemma-4-12b` (operational; main session)

**Files:**

- Create: `docs/prompt-lab/<run-date>-gemma-4-12b-campaign.md` (final report, dated the day the campaign runs), possibly `tools/prompt-lab/variants/v7-*.ts`+ (new in-loop variants, with tests, registered)

This task is Claude-in-the-loop by design (spec decision 3): it runs in the
main session, not in an implementer subagent. Long runs go through
`Bash run_in_background`; the cache makes any interrupted/timed-out
invocation resumable by re-running the same command.

- [ ] **Step 1: Preflight** — LM Studio reachable (`curl -s http://localhost:1234/api/v0/models`), `karpov.pgn` present, benchmark committed. Confirm with the user that the machine can sit on a ~1 h run.
- [ ] **Step 2: Round 1** — `npm run prompt-lab -- race --model google/gemma-4-12b` (all 7 starters, screen 150 → keep 3 → final 600), in the background; monitor progress.
- [ ] **Step 3: Analyze** — read both tables + the finalists' `failures.md`. Claude replays 10–15 contested positions itself (decision 5: compare model vs Claude vs Karpov). Identify failure patterns (illegal SAN shapes? wrong piece letters? loses track of history?).
- [ ] **Step 4: Author 1–3 targeted variants** (`v7-…`) based on the analysis — each a new file + test + registry entry, same shape as Tasks 6–7. Candidate dimensions: ELO/persona wording, history length trimming, explicit "reply with one token" formatting, combining the two strongest round-1 ideas. Commit them.
- [ ] **Step 5: Round 2** — `race` again with finalists + new variants (round-1 responses come from cache; only new variants cost time). Optionally a third round if budget remains (total new requests across the campaign ≤ ~3000).
- [ ] **Step 6: Write the campaign report** `docs/prompt-lab/<run-date>-gemma-4-12b-campaign.md`: final table, winner, its full prompt text, per-round narrative, Claude-vs-model observations, and the verdict vs `v0-baseline` (beats it beyond ±se, or not). Commit.

---

### Task 14: Adapter `gemma4` (conditional on Task 13's verdict)

**Files:**

- Create: `src/llm/adapters/gemma4.ts`, `src/llm/adapters/gemma4.test.ts`
- Modify: `src/llm/adapters/index.ts` (register before the generic fallback)

**Skip rule (from the spec):** if the Task-13 winner beats `v0-baseline` only within noise (≤ its ±se), do NOT add an adapter; record that in the campaign report instead, and mark this task complete as "not needed".

- [ ] **Step 1: Write the failing tests** — mirror `genericFen.test.ts`: `matches('google/gemma-4-12b')` true / `matches('qwen/qwen3.5-9b')` false; `buildRequest` snapshot of the winning prompt for a known mid-game state; `parseMoves` handles the winner's reply format (copy 2–3 raw replies from the campaign's results as fixtures).
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement** — transplant the winning variant's `buildRequest`/`parse` into a `ModelAdapter` (`matches: (id) => id.includes('gemma-4')`; keep the winner's temperature-0 sampling but raise `maxTokens` if the campaign showed truncation; production `selectMove` retry/fallback stays untouched). Register in `src/llm/adapters/index.ts` ahead of `genericFenAdapter` (the catch-all must stay last).
- [ ] **Step 4: Run the full suite** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(llm): gemma-4 adapter with campaign-winning move prompt"`

---

### Task 15: Campaign — `qwen/qwen3.5-9b` (operational; main session)

Same procedure as Task 13, against `qwen/qwen3.5-9b` (its own results dir and cache; the benchmark and variant roster — including any `v7+` authored in Task 13 — are shared).

- [ ] **Step 1: Preflight** (model present in LM Studio; unload/load handled by `ensureModel`).
- [ ] **Step 2: Round 1** — `npm run prompt-lab -- race --model qwen/qwen3.5-9b`.
- [ ] **Step 3: Analyze failures; replay contested positions.**
- [ ] **Step 4: Author model-specific variants if the failure modes differ; commit.**
- [ ] **Step 5: Round 2 race; budget ≤ ~3000 new requests.**
- [ ] **Step 6: Campaign report** `docs/prompt-lab/<run-date>-qwen3.5-9b-campaign.md`; commit.

---

### Task 16: Adapter `qwen35` (conditional on Task 15's verdict)

Mirror of Task 14 for `qwen/qwen3.5-9b`: `src/llm/adapters/qwen35.ts` (+ test), `matches: (id) => id.includes('qwen3.5')`, registered ahead of the generic fallback; same skip rule.

---

### Task 17: Final gate, docs, finish the branch

- [ ] **Step 1: Full quality gate** — `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` → all green.
- [ ] **Step 2: Update `CLAUDE.md`** — mark the Prompt Lab cycle done: project-structure entries (`tools/prompt-lab`, new adapters if added), a "Prompt Lab" paragraph (what it is, how to run a campaign for the next model), and the roadmap note. Update `README.md` if adapters changed how the app plays.
- [ ] **Step 3: Commit docs.**
- [ ] **Step 4: Finish the branch** — invoke `superpowers:finishing-a-development-branch`: PR from `feat/prompt-lab` to `main` with the campaign tables in the description; verify CI green (note: CI does not run campaigns — only unit tests).
