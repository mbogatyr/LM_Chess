import type { ChatMessage } from '../chat'
import type { GameState, LegalMove, MoveInput } from '../../engine/types'

export type { ChatMessage }

// Transport is a property of the adapter: a chat request OR a raw prompt.
export type ModelRequest =
  | { kind: 'chat'; messages: ChatMessage[] }
  | { kind: 'completion'; prompt: string }

export type MoveContext = {
  state: GameState
  elo: number
  legal: LegalMove[]
  correction?: { badReply: string; reason: string }
}

export type ModelAdapter = {
  name: string
  matches: (modelId: string) => boolean
  buildRequest: (ctx: MoveContext) => ModelRequest
  parseMoves: (reply: string, ctx: MoveContext) => MoveInput[]
  sampling?: {
    temperature?: number
    maxTokens?: number
    reasoningEffort?: string
  }
}
