import type { PromptVariant } from './types'

const UCI_RE = /\b([a-hA-H][1-8][a-hA-H][1-8][qrbnQRBN]?)\b/g

// Last-mentioned first, like parseSanCandidates: chatty replies often discard
// early candidates and finish with the chosen move.
export function parseUciCandidates(reply: string): string[] {
  const tokens = [...reply.matchAll(UCI_RE)].map((m) => m[1].toLowerCase())
  const out: string[] = []
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!out.includes(tokens[i])) out.push(tokens[i])
  }
  return out
}

const SYSTEM =
  'You are a strong chess grandmaster. Reply with ONLY your move in UCI ' +
  'coordinate notation: from-square then to-square, e.g. e2e4, g8f6, e7e8q. ' +
  'No explanation.'

export const v2Uci: PromptVariant = {
  name: 'v2-uci',
  description: 'Answer in UCI coordinates instead of SAN',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          `Position (FEN): ${ctx.state.fen}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn. Your move:`,
      },
    ],
  }),
  parse: parseUciCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
