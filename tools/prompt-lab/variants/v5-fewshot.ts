import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

const SYSTEM =
  'You are a strong chess grandmaster. Given a chess position, reply with ' +
  'ONLY the best move in Standard Algebraic Notation (SAN). No explanation.'

const EXAMPLE_1_FEN =
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'
const EXAMPLE_2_FEN =
  'rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3'

const example = (fen: string, turn: string): string =>
  `Position (FEN): ${fen}\nIt is ${turn}'s turn. Your move:`

export const v5Fewshot: PromptVariant = {
  name: 'v5-fewshot',
  description: 'Two worked position→move examples before the real question',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: example(EXAMPLE_1_FEN, 'Black') },
      { role: 'assistant', content: 'a6' },
      { role: 'user', content: example(EXAMPLE_2_FEN, 'White') },
      { role: 'assistant', content: 'cxd5' },
      {
        role: 'user',
        content:
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          example(ctx.state.fen, ctx.state.turn === 'w' ? 'White' : 'Black'),
      },
    ],
  }),
  parse: parseSanCandidates,
  sampling: { temperature: 0, maxTokens: 64 },
}
