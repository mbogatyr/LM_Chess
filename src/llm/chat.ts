import { normalizeBaseUrl } from './url'
import { LMStudioError } from './types'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatRequest = {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  reasoningEffort?: string
  signal?: AbortSignal
}

export type CompletionRequest = {
  model: string
  prompt: string
  temperature?: number
  maxTokens?: number
  reasoningEffort?: string
  signal?: AbortSignal
}

async function postJson(
  url: string,
  base: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
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
      `LM Studio returned HTTP ${response.status}.`,
    )
  }
  try {
    return await response.json()
  } catch {
    throw new LMStudioError('parse', 'LM Studio returned an invalid response.')
  }
}

function sampling(req: {
  temperature?: number
  maxTokens?: number
  reasoningEffort?: string
}): Record<string, number | string> {
  return {
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
    ...(req.reasoningEffort !== undefined
      ? { reasoning_effort: req.reasoningEffort }
      : {}),
  }
}

export async function chatCompletion(
  baseUrl: string,
  req: ChatRequest,
): Promise<string> {
  const base = normalizeBaseUrl(baseUrl)
  const body = await postJson(
    `${base}/api/v0/chat/completions`,
    base,
    { model: req.model, messages: req.messages, ...sampling(req) },
    req.signal,
  )
  const content = (body as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new LMStudioError('parse', 'LM Studio returned no message content.')
  }
  return content
}

export async function completion(
  baseUrl: string,
  req: CompletionRequest,
): Promise<string> {
  const base = normalizeBaseUrl(baseUrl)
  const body = await postJson(
    `${base}/api/v0/completions`,
    base,
    { model: req.model, prompt: req.prompt, ...sampling(req) },
    req.signal,
  )
  const text = (body as { choices?: { text?: unknown }[] })?.choices?.[0]?.text
  if (typeof text !== 'string') {
    throw new LMStudioError('parse', 'LM Studio returned no completion text.')
  }
  return text
}
