// @vitest-environment node
import { ALL_VARIANTS, getVariants } from './index'

describe('variant registry', () => {
  it('has unique names', () => {
    const names = ALL_VARIANTS.map((v) => v.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('resolves by exact name and rejects unknowns', () => {
    expect(getVariants(['v0-baseline'])[0].name).toBe('v0-baseline')
    expect(() => getVariants(['nope'])).toThrow(/Unknown variant/)
  })

  it('defaults to the whole roster', () => {
    expect(getVariants()).toEqual(ALL_VARIANTS)
  })
})
