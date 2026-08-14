import type { GameState, MoveInput } from '../../engine/types'
import { parseSanCandidates } from './genericFen'
import { toFen, toLegalSan, toSanMoveChain } from './encoding'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'

// qwen2.5-7b-instruct, tuned from the Prompt Lab campaign
// (docs/prompt-lab/2026-08-14-qwen2.5-7b-campaign.md).
//
// The race's nominal winner was v7-cot-legal (6.3% match at n=600), but
// this adapter ships the runner-up v1-legal-list (5.2%) deliberately:
// the 1.1 pp gap is smaller than the standard error of the difference
// (±1.0/±0.9 → ≈1.3 pp, under 1σ), while v7 costs 2.8× the latency
// (2482 ms vs 887 ms) AND is *less* legal (93.3% vs 95.5%) — and every
// illegal move buys another full request as a correction retry. With the
// app's live 10:00 clock ticking during the model's turn, that trade is
// backwards. See the campaign doc's "Why the runner-up ships".
//
// Against the app's old generic prompt this is not a close call:
// 5.2%/95.5% legal vs the baseline's 1.5%/21.2% at n=600 — without an
// adapter, four of five replies from this model are illegal and the game
// degrades to the random fallback.
//
// Note the divergence from qwen35.ts: v6-pgn-completion, the outright
// winner there, scores 2.7%/53.3% here. Same vendor, opposite optimum —
// which is why `matches` on both adapters is written to be strictly
// disjoint (see qwen25.test.ts).
//
// Unlike gemma4.ts and qwen35.ts, this model is NOT a reasoning model:
// `content` comes back populated and `reasoning_content` empty, verified
// live before the campaign. `reasoningEffort` is therefore deliberately
// absent from `sampling` rather than forgotten.
const sideName = (turn: GameState['turn']): string =>
  turn === 'w' ? 'White' : 'Black'

// The campaign measured the generic "strong grandmaster" persona; the
// app's ELO persona is substituted here on gemma4.ts's established
// precedent, since persona wording moved the result only within noise
// (v1 5.3% vs v8-karpov-legal 5.3% at screen n=150 — identical) and the
// ELO setting is a real product feature the user controls.
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
      `single legal move in SAN, copied exactly from the list above.`
    : ''
  return (
    `${history}Position (FEN): ${toFen(ctx.state)}\n` +
    `Legal moves: ${toLegalSan(ctx.legal)}\n` +
    `It is ${sideName(ctx.state.turn)}'s turn. Your move:${correction}`
  )
}

export const qwen25Adapter: ModelAdapter = {
  name: 'qwen2.5-legal-list',
  matches: (modelId: string) => modelId.includes('qwen2.5'),
  buildRequest: (ctx: MoveContext): ModelRequest => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: system(ctx.elo, ctx.state.turn) },
      { role: 'user', content: userMessage(ctx) },
    ],
  }),
  parseMoves: (reply: string): MoveInput[] => parseSanCandidates(reply),
  sampling: { temperature: 0, maxTokens: 64 },
}
