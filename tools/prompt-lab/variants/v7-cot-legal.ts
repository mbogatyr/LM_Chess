import { parseFinalLineSan } from './v4-cot'
import type { PromptVariant } from './types'

// Round-2 campaign variant (gemma-4-12b): combines round 1's two strongest
// signals — v1's legal-move list (94.7% legality) and v4's brief reasoning
// (equal match rate without a list). Slow like v4; promoted only if the
// screen shows a real accuracy gain.
const SYSTEM =
  'You are a strong chess grandmaster. You will be given a chess position ' +
  'and the list of all legal moves. Think briefly — candidate moves, ' +
  'tactics, threats — in at most 80 words. Then write your final chosen ' +
  'move ALONE on the last line, exactly as it appears in the list.'

export const v7CotLegal: PromptVariant = {
  name: 'v7-cot-legal',
  description: 'Legal-move list + brief reasoning, move on the last line',
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
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn.`,
      },
    ],
  }),
  parse: parseFinalLineSan,
  sampling: { temperature: 0, maxTokens: 512 },
}
