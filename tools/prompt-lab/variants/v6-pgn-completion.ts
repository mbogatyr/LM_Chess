import { toPgn } from '../../../src/llm/adapters/encoding'
import type { PromptVariant } from './types'

const SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g

// First-mentioned first: a completion continues the movetext, so the first
// token IS the move (later tokens are the model continuing the game).
export function parseFirstSan(reply: string): string[] {
  const out: string[] = []
  for (const m of reply.matchAll(SAN_RE)) {
    if (!out.includes(m[0])) out.push(m[0])
  }
  return out
}

const HEADERS =
  '[Event "World Chess Championship"]\n' +
  '[White "Kasparov, Garry"]\n' +
  '[Black "Karpov, Anatoly"]\n' +
  '[WhiteElo "2800"]\n' +
  '[BlackElo "2780"]\n' +
  '[Result "*"]\n\n'

export const v6PgnCompletion: PromptVariant = {
  name: 'v6-pgn-completion',
  description: 'Raw completion: continue the PGN movetext of a GM game',
  buildRequest: (ctx) => {
    const movetext = toPgn(ctx.state)
    const fullmove = Number(ctx.state.fen.split(' ')[5])
    // White to move: append the next move number so the model completes it.
    const lead =
      ctx.state.turn === 'w' ? `${movetext ? ' ' : ''}${fullmove}.` : ''
    return { kind: 'completion', prompt: HEADERS + movetext + lead }
  },
  parse: parseFirstSan,
  sampling: { temperature: 0, maxTokens: 12 },
}
