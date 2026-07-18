// Real hints: ask the connected model for one best move + a one-sentence idea,
// validate the move against the engine, retry with correction, and error
// (never a random fallback) if no legal move comes back. Pure of React/UI.
import { chatCompletion } from './chat'
import { parseSanCandidates } from './adapters/genericFen'
import { toFen, toSanMoveChain } from './adapters/encoding'
import { move } from '../engine/game'
import type { GameState, PieceType, SquareName } from '../engine/types'

export const MAX_HINT_ATTEMPTS = 3
const TEMPERATURE = 0.4
// Generous budget: reasoning models (e.g. gemma-4-e4b) spend most of their
// output on hidden reasoning and only then emit the "Move:/Idea:" answer in
// `content`. A small cap leaves `content` empty (the whole budget goes to
// reasoning), so the hint never parses. Give room to finish thinking AND answer.
const MAX_TOKENS = 512
const IDEA_MAX = 240

export type Hint = {
  san: string
  from: SquareName
  to: SquareName
  pieceType: PieceType
  idea: string
}

export class HintUnavailableError extends Error {
  constructor(message = 'No legal hint could be generated') {
    super(message)
    this.name = 'HintUnavailableError'
  }
}

export type GetHintParams = {
  baseUrl: string
  model: string
  state: GameState
  elo: number
  signal?: AbortSignal
}

export type GetHintDeps = { chat?: typeof chatCompletion }

const sideName = (turn: GameState['turn']): string =>
  turn === 'w' ? 'White' : 'Black'

// Board is rank-8-first, file-a-first (see engine/types GameState.board).
function pieceTypeAt(state: GameState, sq: SquareName): PieceType | null {
  const file = sq.charCodeAt(0) - 97 // 'a' -> 0
  const rank = 8 - Number(sq[1]) // '8' -> 0
  const cell = state.board[rank]?.[file]
  return cell ? cell.type : null
}

function systemPrompt(elo: number, turn: GameState['turn']): string {
  return (
    `You are a chess coach helping the ${sideName(turn)} player at ` +
    `approximately ${elo} Elo. Recommend the single best move and explain the ` +
    `idea in ONE short sentence. Answer with EXACTLY two lines:\n` +
    `Move: <the move in Standard Algebraic Notation, e.g. Nf3>\n` +
    `Idea: <one short sentence>`
  )
}

function userPrompt(state: GameState, correction?: string): string {
  const moves = toSanMoveChain(state)
  const history = moves.length > 0 ? `Moves so far: ${moves}\n` : ''
  return (
    `${history}Position (FEN): ${toFen(state)}\n` +
    `It is ${sideName(state.turn)}'s turn.${correction ?? ''}`
  )
}

function extractIdea(reply: string): string {
  const m = reply.match(/idea\s*:\s*(.+)/i)
  return (m ? m[1] : '').trim().slice(0, IDEA_MAX)
}

export async function getHint(
  params: GetHintParams,
  deps: GetHintDeps = {},
): Promise<Hint> {
  const { baseUrl, model, state, elo, signal } = params
  const chat = deps.chat ?? chatCompletion

  let correction: string | undefined
  for (let attempt = 0; attempt < MAX_HINT_ATTEMPTS; attempt++) {
    // LMStudioError from the transport propagates — a connection failure is
    // the caller's concern, not something we mask with a made-up hint.
    const reply = await chat(baseUrl, {
      model,
      messages: [
        { role: 'system', content: systemPrompt(elo, state.turn) },
        { role: 'user', content: userPrompt(state, correction) },
      ],
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      signal,
    })
    for (const candidate of parseSanCandidates(reply)) {
      const next = move(state, candidate)
      if (next && next.lastMove) {
        const pieceType = pieceTypeAt(state, next.lastMove.from)
        // from came from a legal move, so a piece is always present.
        if (pieceType) {
          return {
            san: next.lastMove.san,
            from: next.lastMove.from,
            to: next.lastMove.to,
            pieceType,
            idea: extractIdea(reply),
          }
        }
      }
    }
    correction =
      `\nYour previous reply was not a legal move here. Reply with a single ` +
      `legal move in SAN on the "Move:" line.`
  }
  throw new HintUnavailableError()
}
