import { legalMoves, move, newGame } from '../../src/engine/game'
import type { GameState, PromotionPiece } from '../../src/engine/types'
import { chatCompletion, completion } from '../../src/llm/chat'
import type { ModelRequest } from '../../src/llm/adapters/types'
import { cacheKey, ResponseCache } from './cache'
import type { PositionRecord } from './positions'
import type { PositionContext, PromptVariant } from './variants/types'

export type Outcome = 'match' | 'legal' | 'illegal' | 'unparseable'

export type PositionResult = {
  index: number
  fen: string
  historySan: string[]
  expectedSan: string
  modelSan: string | null
  outcome: Outcome
  reply: string
  latencyMs: number
  cached: boolean
}

export type EvalRun = {
  model: string
  variant: string
  description: string
  n: number
  results: PositionResult[]
}

export type Transport = (
  model: string,
  request: ModelRequest,
  sampling: {
    temperature: number
    maxTokens: number
    reasoningEffort?: string
  },
) => Promise<string>

export function rebuildContext(record: PositionRecord): PositionContext {
  let state: GameState = newGame()
  for (const san of record.historySan) {
    const next = move(state, san)
    if (!next) {
      throw new Error(
        `Benchmark corrupt: cannot replay "${san}" toward ${record.fen}`,
      )
    }
    state = next
  }
  if (state.fen !== record.fen) {
    throw new Error(`Benchmark corrupt: replay mismatch for ${record.fen}`)
  }
  return { state, legal: legalMoves(state) }
}

const UCI_SHAPE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i

export function classify(
  ctx: PositionContext,
  expectedSan: string,
  candidates: string[],
): { outcome: Outcome; modelSan: string | null } {
  if (candidates.length === 0) {
    return { outcome: 'unparseable', modelSan: null }
  }
  for (const c of candidates) {
    const uci = UCI_SHAPE.exec(c)
    const input = uci
      ? {
          from: uci[1].toLowerCase(),
          to: uci[2].toLowerCase(),
          ...(uci[3]
            ? { promotion: uci[3].toLowerCase() as PromotionPiece }
            : {}),
        }
      : c
    const next = move(ctx.state, input)
    if (next?.lastMove) {
      return {
        outcome: next.lastMove.san === expectedSan ? 'match' : 'legal',
        modelSan: next.lastMove.san,
      }
    }
  }
  return { outcome: 'illegal', modelSan: null }
}

export async function runEval(opts: {
  model: string
  variant: PromptVariant
  positions: PositionRecord[]
  n: number
  transport: Transport
  cache: ResponseCache
  reasoningEffort?: string
  onProgress?: (done: number, total: number, matches: number) => void
}): Promise<EvalRun> {
  const slice = opts.positions.slice(0, opts.n)
  const results: PositionResult[] = []
  let matches = 0
  const sampling = {
    ...opts.variant.sampling,
    ...(opts.reasoningEffort !== undefined
      ? { reasoningEffort: opts.reasoningEffort }
      : {}),
  }
  for (let i = 0; i < slice.length; i++) {
    const record = slice[i]
    const ctx = rebuildContext(record)
    const request = opts.variant.buildRequest(ctx)
    const key = cacheKey(opts.model, request, sampling)
    const hit = opts.cache.get(key)
    let reply: string
    let latencyMs: number
    let cached: boolean
    if (hit) {
      ;({ reply, latencyMs } = hit)
      cached = true
    } else {
      const t0 = Date.now()
      reply = await opts.transport(opts.model, request, sampling)
      latencyMs = Date.now() - t0
      cached = false
      opts.cache.put(key, { reply, latencyMs })
    }
    const { outcome, modelSan } = classify(
      ctx,
      record.expectedSan,
      opts.variant.parse(reply),
    )
    if (outcome === 'match') matches++
    results.push({
      index: i,
      fen: record.fen,
      historySan: record.historySan,
      expectedSan: record.expectedSan,
      modelSan,
      outcome,
      reply,
      latencyMs,
      cached,
    })
    opts.onProgress?.(i + 1, slice.length, matches)
  }
  return {
    model: opts.model,
    variant: opts.variant.name,
    description: opts.variant.description,
    n: slice.length,
    results,
  }
}

export function makeLmStudioTransport(
  baseUrl: string,
  timeoutMs = 60_000,
  retries = 3,
): Transport {
  return async (model, request, sampling) => {
    let lastError: unknown
    for (let attempt = 0; attempt < retries; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
      }
      const signal = AbortSignal.timeout(timeoutMs)
      try {
        if (request.kind === 'chat') {
          return await chatCompletion(baseUrl, {
            model,
            messages: request.messages,
            temperature: sampling.temperature,
            maxTokens: sampling.maxTokens,
            reasoningEffort: sampling.reasoningEffort,
            signal,
          })
        }
        return await completion(baseUrl, {
          model,
          prompt: request.prompt,
          temperature: sampling.temperature,
          maxTokens: sampling.maxTokens,
          reasoningEffort: sampling.reasoningEffort,
          signal,
        })
      } catch (e) {
        lastError = e
      }
    }
    throw lastError
  }
}
