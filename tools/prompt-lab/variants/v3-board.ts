import { Chess } from 'chess.js'
import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

const SYSTEM =
  'You are a strong chess grandmaster. Reply with ONLY your move in ' +
  'Standard Algebraic Notation (SAN), for example: Nf3, e5, O-O, exd8=Q. ' +
  'No explanation.'

export const v3Board: PromptVariant = {
  name: 'v3-board',
  description: 'ASCII board diagram + FEN',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          `Current board (uppercase = White, lowercase = Black):\n` +
          `${new Chess(ctx.state.fen).ascii()}\n` +
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          `Position (FEN): ${ctx.state.fen}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn. Your move:`,
      },
    ],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
