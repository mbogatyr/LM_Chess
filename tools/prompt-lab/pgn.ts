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
