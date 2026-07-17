import { expect, test } from 'vitest'
import { newGame, move } from '../../engine/game'
import { legalMoves } from '../../engine/game'
import { toFen, toSanMoveChain, toPgn, toLegalSan } from './encoding'

function after(sans: string[]) {
  let s = newGame()
  for (const san of sans) {
    const next = move(s, san)
    if (!next) throw new Error(`illegal in fixture: ${san}`)
    s = next
  }
  return s
}

test('toFen returns the current FEN', () => {
  const s = after(['e4'])
  expect(toFen(s)).toBe(s.fen)
})

test('toSanMoveChain joins the SAN history with spaces', () => {
  const s = after(['e4', 'd5', 'exd5'])
  expect(toSanMoveChain(s)).toBe('e4 d5 exd5')
})

test('toSanMoveChain is empty at the start', () => {
  expect(toSanMoveChain(newGame())).toBe('')
})

test('toPgn numbers full moves', () => {
  const s = after(['e4', 'd5', 'exd5'])
  expect(toPgn(s)).toBe('1. e4 d5 2. exd5')
})

test('toLegalSan joins legal-move SANs', () => {
  const s = newGame()
  const out = toLegalSan(legalMoves(s))
  expect(out.split(' ')).toContain('e4')
  expect(out.split(' ')).toContain('Nf3')
})
