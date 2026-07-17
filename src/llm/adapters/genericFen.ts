import type { GameState, MoveInput } from '../../engine/types'
import { toFen, toSanMoveChain } from './encoding'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'

// The generic default: FEN-only, chat transport, no legal-move list (a
// deliberate product choice — an honest test of the model's own strength).
// ELO is expressed as a numeric persona only; the ui-owned band copy
// (ui/app/demoData) stays in the ui layer — llm must not import from ui.
const sideName = (turn: GameState['turn']): string =>
  turn === 'w' ? 'White' : 'Black'

const system = (elo: number, turn: GameState['turn']): string =>
  `You are a chess engine playing the ${sideName(turn)} pieces at ` +
  `approximately ${elo} Elo strength. Reply with ONLY your move in ` +
  `Standard Algebraic Notation (SAN), for example: Nf3, e5, O-O, exd8=Q. ` +
  `No explanation, no commentary — just the single move.`

function userMessage(ctx: MoveContext): string {
  const moves = toSanMoveChain(ctx.state)
  const history = moves.length > 0 ? `Moves so far: ${moves}\n` : ''
  const correction = ctx.correction
    ? `\nYour previous reply "${ctx.correction.badReply}" was not a legal ` +
      `move in this position (${ctx.correction.reason}). Reply with a ` +
      `single legal move in SAN.`
    : ''
  return (
    `${history}Position (FEN): ${toFen(ctx.state)}\n` +
    `It is ${sideName(ctx.state.turn)}'s turn. Your move:${correction}`
  )
}

const SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g

// Extract ordered candidate move tokens from a possibly-chatty reply. The
// engine is the ultimate judge; this only needs to surface likely tokens.
// The model's FINAL stated move is the most likely intended one (chatty
// replies often mention — then discard — earlier candidates first), so
// SAN-shaped tokens are collected in reverse (last-mentioned first).
export function parseSanCandidates(reply: string): string[] {
  const cleaned = reply.trim()
  const candidates: string[] = []
  const push = (raw: string | undefined) => {
    if (!raw) return
    const t = raw
      .trim()
      .replace(/^["'`*]+/, '')
      .replace(/["'`*.!,]+$/, '')
    if (t && !candidates.includes(t)) candidates.push(t)
  }
  push(cleaned)
  push(cleaned.split('\n')[0])
  push(cleaned.split(/\s+/)[0])
  const tokens = [...cleaned.matchAll(SAN_RE)].map((m) => m[0])
  for (let i = tokens.length - 1; i >= 0; i--) push(tokens[i])
  return candidates
}

export const genericFenAdapter: ModelAdapter = {
  name: 'generic-fen',
  matches: () => true,
  buildRequest: (ctx: MoveContext): ModelRequest => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: system(ctx.elo, ctx.state.turn) },
      { role: 'user', content: userMessage(ctx) },
    ],
  }),
  parseMoves: (reply: string): MoveInput[] => parseSanCandidates(reply),
  sampling: { temperature: 0.7, maxTokens: 64 },
}
