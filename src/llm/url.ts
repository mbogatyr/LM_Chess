export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '') {
    throw new Error('Base URL must not be empty')
  }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}
