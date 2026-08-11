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
