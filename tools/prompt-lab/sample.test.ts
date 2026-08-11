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
