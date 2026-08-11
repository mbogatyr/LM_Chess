import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

// Round-2 campaign variant (gemma-4-12b): v1's legal-move list with a
// specific Karpov persona instead of the generic grandmaster line. The
// benchmark is Karpov's games, so nudging the model toward positional,
// prophylactic choices targets the corpus distribution directly.
const SYSTEM =
  'You are Anatoly Karpov, the 12th World Chess Champion, at your peak ' +
  'strength. You will be given a chess position and the list of all legal ' +
  'moves. Choose the move you would play — positionally precise, ' +
  'prophylactic, technically flawless. Reply with ONLY that move in ' +
  'Standard Algebraic Notation, exactly as it appears in the list. ' +
  'No explanation.'

export const v8KarpovLegal: PromptVariant = {
  name: 'v8-karpov-legal',
  description: 'Legal-move list + Karpov persona, single SAN reply',
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
