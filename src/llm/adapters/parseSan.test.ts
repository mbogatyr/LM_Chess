import { expect, test } from 'vitest'
import { parseFirstSan } from './parseSan'

test('returns SAN tokens in order of first mention', () => {
  expect(parseFirstSan(' Nf3 Nc6 3. Bb5')).toEqual(['Nf3', 'Nc6', 'Bb5'])
})

test('deduplicates repeated moves', () => {
  expect(parseFirstSan('e4 e4 e5')).toEqual(['e4', 'e5'])
})

test('recognises castling, captures, promotion, check and mate suffixes', () => {
  expect(parseFirstSan('O-O-O')).toContain('O-O-O')
  expect(parseFirstSan('Qxd5+')).toContain('Qxd5+')
  expect(parseFirstSan('e8=Q#')).toContain('e8=Q#')
})

test('returns an empty list for a reply with no SAN-shaped tokens', () => {
  expect(parseFirstSan('I resign!')).toEqual([])
})
