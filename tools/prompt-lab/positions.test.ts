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
