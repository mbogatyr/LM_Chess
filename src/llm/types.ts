export type LMModelType = 'llm' | 'vlm' | 'embeddings' | (string & {})
export type LMModelState = 'loaded' | 'not-loaded' | 'loading' | (string & {})

export type LMModel = {
  id: string
  type: LMModelType
  state: LMModelState
  quantization?: string
  maxContextLength?: number
  capabilities?: string[]
}

export type LMErrorKind = 'network' | 'http' | 'parse' | 'empty'

export class LMStudioError extends Error {
  kind: LMErrorKind
  constructor(kind: LMErrorKind, message: string) {
    super(message)
    this.name = 'LMStudioError'
    this.kind = kind
  }
}

export const CHAT_MODEL_TYPES = ['llm', 'vlm'] as const

export function isChatModel(model: LMModel): boolean {
  return (CHAT_MODEL_TYPES as readonly string[]).includes(model.type)
}
