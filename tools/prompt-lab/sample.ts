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
