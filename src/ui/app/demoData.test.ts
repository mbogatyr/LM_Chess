import { expect, test } from 'vitest'
import { ELO_BANDS, eloBand } from './demoData'

test('eloBand returns the first band whose max covers the rating', () => {
  expect(eloBand(600).en[0]).toBe('Beginner')
  expect(eloBand(1000).en[0]).toBe('Steady')
})

test('eloBand clamps to the top band above the highest max', () => {
  expect(eloBand(9999)).toBe(ELO_BANDS[ELO_BANDS.length - 1])
})
