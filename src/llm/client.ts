import { normalizeBaseUrl } from './url'
import { isChatModel, LMModel, LMStudioError } from './types'

type RawModel = {
  id: string
  type: string
  state: string
  quantization?: string
  max_context_length?: number
  capabilities?: string[]
}

function mapModel(raw: RawModel): LMModel {
  return {
    id: raw.id,
    type: raw.type,
    state: raw.state,
    quantization: raw.quantization,
    maxContextLength: raw.max_context_length,
    capabilities: raw.capabilities,
  }
}

export async function listModels(baseUrl: string): Promise<LMModel[]> {
  const base = normalizeBaseUrl(baseUrl)
  let response: Response
  try {
    response = await fetch(`${base}/api/v0/models`)
  } catch {
    throw new LMStudioError(
      'network',
      `Can't reach LM Studio at ${base}. Check the URL and that CORS is enabled in LM Studio.`,
    )
  }
  if (!response.ok) {
    throw new LMStudioError(
      'http',
      `LM Studio returned HTTP ${response.status} for the model list.`,
    )
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new LMStudioError('parse', 'LM Studio returned an invalid response.')
  }
  const data = (body as { data?: unknown })?.data
  if (!Array.isArray(data)) {
    throw new LMStudioError('parse', 'LM Studio returned an invalid response.')
  }
  const chatModels = (data as RawModel[]).map(mapModel).filter(isChatModel)
  if (chatModels.length === 0) {
    throw new LMStudioError(
      'empty',
      'No chat-capable models are available on this server.',
    )
  }
  return chatModels
}

export async function loadModel(baseUrl: string, id: string): Promise<void> {
  const base = normalizeBaseUrl(baseUrl)
  let response: Response
  try {
    response = await fetch(`${base}/api/v0/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: id,
        messages: [{ role: 'user', content: ' ' }],
        max_tokens: 1,
      }),
    })
  } catch {
    throw new LMStudioError(
      'network',
      `Can't reach LM Studio at ${base}. Check the URL and that CORS is enabled in LM Studio.`,
    )
  }
  if (!response.ok) {
    throw new LMStudioError(
      'http',
      `LM Studio failed to load "${id}" (HTTP ${response.status}).`,
    )
  }
}
