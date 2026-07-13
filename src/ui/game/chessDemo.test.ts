import { expect, test } from 'vitest'
import { START_POSITION, sqName, nameToRC, HINT, HINT_LEGAL } from './chessDemo'

test('sqName maps array indices to algebraic squares', () => {
  expect(sqName(0, 0)).toBe('a8')
  expect(sqName(7, 4)).toBe('e1')
  expect(sqName(6, 4)).toBe('e2')
})

test('nameToRC is the inverse of sqName', () => {
  expect(nameToRC('a8')).toEqual([0, 0])
  expect(nameToRC('e2')).toEqual([6, 4])
})

test('START_POSITION has the standard back ranks and pawns', () => {
  expect(START_POSITION[0][0]).toEqual({ color: 'b', type: 'r' })
  expect(START_POSITION[0][4]).toEqual({ color: 'b', type: 'k' })
  expect(START_POSITION[1][0]).toEqual({ color: 'b', type: 'p' })
  expect(START_POSITION[6][4]).toEqual({ color: 'w', type: 'p' })
  expect(START_POSITION[7][3]).toEqual({ color: 'w', type: 'q' })
  expect(START_POSITION[4][4]).toBeNull()
})

test('HINT points at the 1.e4 demo and exposes RU/EN text', () => {
  expect(HINT.piece).toBe('e2')
  expect(HINT.to).toBe('e4')
  expect(HINT.targets).toEqual(['e4', 'd4'])
  expect(HINT_LEGAL).toEqual(['e3', 'e4'])
  expect(HINT.ru.l3[0]).toBe('e2 → e4')
  expect(HINT.en.l1[0]).toBe('Move a centre pawn')
})
