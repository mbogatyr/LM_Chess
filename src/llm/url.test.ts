import { normalizeBaseUrl } from './url'

test('strips trailing slash', () => {
  expect(normalizeBaseUrl('http://localhost:1234/')).toBe(
    'http://localhost:1234',
  )
})

test('adds http scheme when missing', () => {
  expect(normalizeBaseUrl('localhost:1234')).toBe('http://localhost:1234')
})

test('trims surrounding whitespace', () => {
  expect(normalizeBaseUrl('  http://127.0.0.1:1234  ')).toBe(
    'http://127.0.0.1:1234',
  )
})

test('preserves an explicit https scheme', () => {
  expect(normalizeBaseUrl('https://example.com')).toBe('https://example.com')
})

test('throws on empty input', () => {
  expect(() => normalizeBaseUrl('   ')).toThrow()
})
