import { expect, test } from 'vitest'
import { HISTORY, historyStats, type HistoryEntry } from './demoData'

const entry = (res: HistoryEntry['res'], elo = 1000): HistoryEntry => ({
  date: '',
  edate: '',
  opp: '',
  elo,
  len: 0,
  res,
  open: '',
  eopen: '',
})

test('historyStats on the demo history', () => {
  expect(historyStats(HISTORY)).toEqual({
    played: 8,
    winRate: 63,
    streak: 1,
    best: 1350,
  })
})

test('streak counts only the leading run of wins', () => {
  expect(
    historyStats([entry('win'), entry('win'), entry('loss'), entry('win')])
      .streak,
  ).toBe(2)
  expect(historyStats([entry('loss'), entry('win')]).streak).toBe(0)
})

test('winRate rounds to the nearest percent and best is the max elo', () => {
  const stats = historyStats([
    entry('win', 900),
    entry('loss', 1200),
    entry('loss', 1100),
  ])
  expect(stats.winRate).toBe(33)
  expect(stats.best).toBe(1200)
})
