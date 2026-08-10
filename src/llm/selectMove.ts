import { chatCompletion, completion } from './chat'
import { resolveAdapter } from './adapters'
import type { ModelAdapter } from './adapters/types'
import { legalMoves, move } from '../engine/game'
import type { GameState } from '../engine/types'

// Total model calls before falling back: the first request plus up to two
// correction re-requests. (Distinct from useGame's connection retryDelays.)
export const MAX_MOVE_ATTEMPTS = 3
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 64

export type MoveSelection = {
  nextState: GameState
  san: string
  source: 'model' | 'fallback'
}

export type SelectMoveParams = {
  baseUrl: string
  model: string
  state: GameState
  elo: number
  signal?: AbortSignal
}

export type SelectMoveDeps = {
  adapter?: ModelAdapter
  chat?: typeof chatCompletion
  complete?: typeof completion
  rng?: () => number
}

export async function selectMove(
  params: SelectMoveParams,
  deps: SelectMoveDeps = {},
): Promise<MoveSelection> {
  const { baseUrl, model, state, elo, signal } = params
  const chat = deps.chat ?? chatCompletion
  const complete = deps.complete ?? completion
  const rng = deps.rng ?? Math.random
  const adapter = deps.adapter ?? resolveAdapter(model)
  const legal = legalMoves(state)
  // Defensive: callers (useGame) only invoke this on a non-terminal Black
  // turn, so there is always a legal move. Guard the seam anyway — an empty
  // set would otherwise make the random fallback read `undefined.from`.
  if (legal.length === 0) {
    throw new Error('selectMove called on a position with no legal moves')
  }

  let correction: { badReply: string; reason: string } | undefined
  for (let attempt = 0; attempt < MAX_MOVE_ATTEMPTS; attempt++) {
    const ctx = { state, elo, legal, correction }
    const request = adapter.buildRequest(ctx)
    const temperature = adapter.sampling?.temperature ?? DEFAULT_TEMPERATURE
    const maxTokens = adapter.sampling?.maxTokens ?? DEFAULT_MAX_TOKENS
    const reasoningEffort = adapter.sampling?.reasoningEffort

    // LMStudioError from the transport propagates — a connection failure is
    // the orchestrator's concern, not something we mask with a random move.
    const reply =
      request.kind === 'chat'
        ? await chat(baseUrl, {
            model,
            messages: request.messages,
            temperature,
            maxTokens,
            reasoningEffort,
            signal,
          })
        : await complete(baseUrl, {
            model,
            prompt: request.prompt,
            temperature,
            maxTokens,
            reasoningEffort,
            signal,
          })

    for (const candidate of adapter.parseMoves(reply, ctx)) {
      const next = move(state, candidate)
      if (next) {
        return {
          nextState: next,
          san: next.lastMove?.san ?? '',
          source: 'model',
        }
      }
    }
    correction = { badReply: reply, reason: 'illegal or unparseable move' }
  }

  // Fallback: a uniformly-random legal move so the game never stalls.
  const pick = legal[Math.floor(rng() * legal.length)]
  const next = move(state, {
    from: pick.from,
    to: pick.to,
    ...(pick.promotion ? { promotion: pick.promotion } : {}),
  })
  // `next` is guaranteed non-null: `pick` came from `legalMoves(state)`.
  return { nextState: next as GameState, san: pick.san, source: 'fallback' }
}
