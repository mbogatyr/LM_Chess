import type { PromptVariant } from './types'
import { v0Baseline } from './v0-baseline'

export const ALL_VARIANTS: PromptVariant[] = [v0Baseline]

export function getVariants(names?: string[]): PromptVariant[] {
  if (!names || names.length === 0) return ALL_VARIANTS
  return names.map((n) => {
    const v = ALL_VARIANTS.find((x) => x.name === n)
    if (!v) {
      throw new Error(
        `Unknown variant "${n}". Known: ${ALL_VARIANTS.map((x) => x.name).join(', ')}`,
      )
    }
    return v
  })
}
