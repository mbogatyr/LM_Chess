import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  appendGame,
  gameStats,
  loadGames,
  type GameRecord,
  type MatchResult,
} from './gameHistory'

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  id: crypto.randomUUID(),
  endedAt: 1_000,
  opponent: 'test-model',
  elo: 1000,
  plies: 20,
  result: 'win',
  reason: 'checkmate',
  ...over,
})

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('loadGames returns [] when nothing is stored', () => {
  expect(loadGames()).toEqual([])
})

test('loadGames returns [] on corrupt storage', () => {
  localStorage.setItem('nocturne-chess-games', 'not json')
  expect(loadGames()).toEqual([])
})

test('appendGame prepends newest-first and round-trips', () => {
  appendGame(rec({ id: 'a' }))
  appendGame(rec({ id: 'b' }))
  expect(loadGames().map((g) => g.id)).toEqual(['b', 'a'])
})

test('appendGame caps the list at 50', () => {
  for (let i = 0; i < 55; i++) appendGame(rec({ id: `g${i}` }))
  const games = loadGames()
  expect(games).toHaveLength(50)
  expect(games[0].id).toBe('g54')
  expect(games[49].id).toBe('g5')
})

test('gameStats is all zeros for an empty list', () => {
  expect(gameStats([])).toEqual({
    played: 0,
    winRate: 0,
    streak: 0,
    best: 0,
  })
})

test('gameStats computes played/winRate/streak/best', () => {
  const r = (result: MatchResult, elo: number) => rec({ result, elo })
  // newest-first: two leading wins, then a loss
  const stats = gameStats([
    r('win', 1200),
    r('win', 900),
    r('loss', 1350),
    r('win', 1000),
  ])
  expect(stats.played).toBe(4)
  expect(stats.winRate).toBe(75)
  expect(stats.streak).toBe(2)
  expect(stats.best).toBe(1350)
})
