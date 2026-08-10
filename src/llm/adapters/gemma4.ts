import type { GameState, MoveInput } from '../../engine/types'
import { parseSanCandidates } from './genericFen'
import { toFen, toLegalSan, toSanMoveChain } from './encoding'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'

// google/gemma-4-12b, tuned from the Prompt Lab campaign
// (docs/prompt-lab/2026-08-11-gemma-4-12b-campaign.md). Winner: v1-legal-list
// — give the model the legal-move list and have it pick from it — which
// took legality from 60.5% to 94.7% (n=600) at a slight match-rate gain
// (9.8% vs 7.8%). The campaign's persona wording only moved match within
// noise (v8-karpov-legal 8.7% vs v1 9.3% at n=150), so the app's ELO
// persona (a real product feature — the user picks opponent strength) is
// kept here instead of the campaign's generic grandmaster line; the
// measured wins — the legal-move list and reasoning off — are preserved.
//
// gemma-4 is a reasoning model: with the app's max_tokens budget, every
// completion token goes to reasoning and `content` comes back empty unless
// `reasoningEffort: 'none'` is set (see the campaign doc's Discovery
// section) — this adapter's sampling MUST carry it.
const sideName = (turn: GameState['turn']): string =>
  turn === 'w' ? 'White' : 'Black'

const system = (elo: number, turn: GameState['turn']): string =>
  `You are a chess engine playing the ${sideName(turn)} pieces at ` +
  `approximately ${elo} Elo strength. You will be given a chess position ` +
  `and the list of all legal moves. Choose the best move. Reply with ` +
  `ONLY that move in Standard Algebraic Notation, exactly as it appears ` +
  `in the list. No explanation, no commentary — just the single move.`

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
    `Legal moves: ${toLegalSan(ctx.legal)}\n` +
    `It is ${sideName(ctx.state.turn)}'s turn. Your move:${correction}`
  )
}

export const gemma4Adapter: ModelAdapter = {
  name: 'gemma-4-legal-list',
  matches: (modelId: string) => modelId.includes('gemma-4'),
  buildRequest: (ctx: MoveContext): ModelRequest => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: system(ctx.elo, ctx.state.turn) },
      { role: 'user', content: userMessage(ctx) },
    ],
  }),
  parseMoves: (reply: string): MoveInput[] => parseSanCandidates(reply),
  sampling: { temperature: 0, maxTokens: 64, reasoningEffort: 'none' },
}
