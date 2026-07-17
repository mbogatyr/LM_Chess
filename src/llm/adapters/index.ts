import { genericFenAdapter } from './genericFen'
import type { ModelAdapter } from './types'

// Specialised adapters are registered here as they are written. The generic
// default is NOT in this list — it is only reached via the `?? defaultAdapter`
// fallback, so its `matches: () => true` never swallows a specific model.
const ADAPTERS: ModelAdapter[] = []

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
