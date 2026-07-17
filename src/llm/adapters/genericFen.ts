import type { MoveInput } from '../../engine/types'
import { toFen, toSanMoveChain } from './encoding'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'

// The generic default: FEN-only, chat transport, no legal-move list (a
// deliberate product choice — an honest test of the model's own strength).
// ELO is expressed as a numeric persona only; the ui-owned band copy
// (ui/app/demoData) stays in the ui layer — llm must not import from ui.
const system = (elo: number): string =>
  `You are a chess engine playing the Black pieces at approximately ${elo} ` +
  `Elo strength. Reply with ONLY your move in Standard Algebraic Notation ` +
  `(SAN), for example: Nf3, e5, O-O, exd8=Q. No explanation, no commentary — ` +
  `just the single move.`

function userMessage(ctx: MoveContext): string {
  const moves = toSanMoveChain(ctx.state)
  const history = moves.length > 0 ? `Moves so far: ${moves}\n` : ''
  const correction = ctx.correction
    ? `\nYour previous reply "${ctx.correction.badReply}" was not a legal ` +
      `move in this position. Reply with a single legal move in SAN.`
    : ''
  return (
    `${history}Position (FEN): ${toFen(ctx.state)}\n` +
    `It is Black's turn. Your move:${correction}`
  )
}

const SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/

// Extract ordered candidate move tokens from a possibly-chatty reply. The
// engine is the ultimate judge; this only needs to surface likely tokens.
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
  const m = cleaned.match(SAN_RE)
  if (m) push(m[0])
  return candidates
}

export const genericFenAdapter: ModelAdapter = {
  name: 'generic-fen',
  matches: () => true,
  buildRequest: (ctx: MoveContext): ModelRequest => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: system(ctx.elo) },
      { role: 'user', content: userMessage(ctx) },
    ],
  }),
  parseMoves: (reply: string): MoveInput[] => parseSanCandidates(reply),
  sampling: { temperature: 0.7, maxTokens: 64 },
}
