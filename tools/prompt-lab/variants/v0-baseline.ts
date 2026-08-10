import {
  genericFenAdapter,
  parseSanCandidates,
} from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

// The app's strongest ELO band tops out at 1600 (src/ui/app/demoData.ts), so
// the control measures the prompt the app actually sends at max strength.
export const BASELINE_ELO = 1600

export const v0Baseline: PromptVariant = {
  name: 'v0-baseline',
  description: 'Production genericFen prompt, unchanged (control)',
  buildRequest: (ctx) =>
    genericFenAdapter.buildRequest({
      state: ctx.state,
      elo: BASELINE_ELO,
      legal: ctx.legal,
    }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
