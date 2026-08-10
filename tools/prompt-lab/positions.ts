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
