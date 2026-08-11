import type { PromptVariant } from './types'
import { v0Baseline } from './v0-baseline'
import { v1LegalList } from './v1-legal-list'
import { v2Uci } from './v2-uci'
import { v3Board } from './v3-board'
import { v4Cot } from './v4-cot'
import { v5Fewshot } from './v5-fewshot'
import { v6PgnCompletion } from './v6-pgn-completion'
import { v7CotLegal } from './v7-cot-legal'
import { v8KarpovLegal } from './v8-karpov-legal'

export const ALL_VARIANTS: PromptVariant[] = [
  v0Baseline,
  v1LegalList,
  v2Uci,
  v3Board,
  v4Cot,
  v5Fewshot,
  v6PgnCompletion,
  v7CotLegal,
  v8KarpovLegal,
]

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
