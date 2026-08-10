import type { GameState, LegalMove } from '../../../src/engine/types'
import type { ModelRequest } from '../../../src/llm/adapters/types'

export type PositionContext = { state: GameState; legal: LegalMove[] }

export type PromptVariant = {
  name: string
  description: string
  buildRequest(ctx: PositionContext): ModelRequest
  parse(reply: string): string[]
  sampling: { temperature: number; maxTokens: number }
}
