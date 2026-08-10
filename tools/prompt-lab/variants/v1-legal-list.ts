import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

const SYSTEM =
  'You are a strong chess grandmaster. You will be given a chess position ' +
  'and the list of all legal moves. Choose the best move. Reply with ONLY ' +
  'that move in Standard Algebraic Notation, exactly as it appears in the ' +
  'list. No explanation.'

export const v1LegalList: PromptVariant = {
  name: 'v1-legal-list',
  description: 'Legal-move list included; model picks from it',
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
          `Legal moves: ${ctx.legal.map((m) => m.san).join(' ')}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn. Your move:`,
      },
    ],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
