import { gemma4Adapter } from './gemma4'
import { qwen35Adapter } from './qwen35'
import { qwen25Adapter } from './qwen25'
import { chessLmAdapter } from './chessLm'
import { genericFenAdapter } from './genericFen'
import type { ModelAdapter } from './types'

// Specialised adapters are registered here as they are written, most
// specific first. The generic default is NOT in this list — it is only
// reached via the `?? defaultAdapter` fallback, so its `matches: () =>
// true` never swallows a specific model.
const ADAPTERS: ModelAdapter[] = [
  gemma4Adapter,
  qwen35Adapter,
  qwen25Adapter,
  chessLmAdapter,
]

export const defaultAdapter: ModelAdapter = genericFenAdapter

export function resolveAdapter(modelId: string): ModelAdapter {
  return ADAPTERS.find((a) => a.matches(modelId)) ?? defaultAdapter
}

export type {
  ModelAdapter,
  ModelRequest,
  MoveContext,
  ChatMessage,
} from './types'
