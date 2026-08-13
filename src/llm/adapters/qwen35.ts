import type { GameState, MoveInput } from '../../engine/types'
import { parseSanCandidates } from './genericFen'
import { toFen, toLegalSan, toPgn, toSanMoveChain } from './encoding'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'
import { parseFirstSan } from './parseSan'

// qwen/qwen3.5-9b, tuned from the Prompt Lab campaign
// (docs/prompt-lab/2026-08-11-qwen3.5-9b-campaign.md). Winner: v6-pgn-completion
// — a raw-completion continuation of a GM game's PGN movetext — beats every
// chat-style prompt on this model (10.7% match / 74.8% legal at n=600, vs
// the app's current baseline 3.3%/33.0%). But v6 never looks at
// `ctx.correction`, and at temperature 0 a production retry that resent the
// same prompt would reproduce the same illegal move every time — its ~25%
// illegal rate would land in the random fallback on every single miss.
//
// So this adapter is TWO-STAGE, mixing the campaign's two different
// winners for two different jobs:
//   - Attempt 1 (`ctx.correction` absent): the measured *match-rate* winner,
//     v6-pgn-completion — raw completion, first-mentioned-first SAN parse.
//   - Retries (`ctx.correction` present): the measured *legality* king,
//     v8-karpov-legal (98.7% legal at n=600) — a legal-move-list chat
//     prompt, parsed with the generic candidate extractor. Once a
//     correction is needed, legality — not raw match rate — is the only
//     thing that matters, and v8 is what the campaign measured for that.
//
// NOTE on ELO: attempt 1 is a raw-completion prompt (GM PGN headers, not a
// chat system message) — there is no persona slot to carry the app's ELO
// setting, so it is not expressible there and is intentionally omitted
// rather than force-fit. The retry stage IS a chat request, so — mirroring
// gemma4.ts's established precedent for the identical noise-level-persona
// situation (the campaign found persona wording moves legality only within
// noise: v1 generic-GM 99.3% vs v8-karpov 100.0% at screen n=150) — it
// keeps the app's ELO-persona line instead of v8's Karpov flavor text, so
// the user's opponent-strength setting stays meaningful on the retry path
// too.
//
// qwen3.5-9b is a reasoning model: with the app's max_tokens budget, every
// completion token goes to reasoning and `content` comes back empty unless
// `reasoningEffort: 'none'` is set — this adapter's sampling MUST carry it.

const sideName = (turn: GameState['turn']): string =>
  turn === 'w' ? 'White' : 'Black'

// --- Attempt 1: v6-pgn-completion (transplanted from
// tools/prompt-lab/variants/v6-pgn-completion.ts) ---------------------------

const HEADERS =
  '[Event "World Chess Championship"]\n' +
  '[White "Kasparov, Garry"]\n' +
  '[Black "Karpov, Anatoly"]\n' +
  '[WhiteElo "2800"]\n' +
  '[BlackElo "2780"]\n' +
  '[Result "*"]\n\n'

function firstAttemptPrompt(ctx: MoveContext): string {
  const movetext = toPgn(ctx.state)
  const fullmove = Number(ctx.state.fen.split(' ')[5])
  // White to move: append the next move number so the model completes it.
  const lead =
    ctx.state.turn === 'w' ? `${movetext ? ' ' : ''}${fullmove}.` : ''
  return HEADERS + movetext + lead
}

// --- Retry: v8-karpov-legal's legal-list structure (transplanted from
// tools/prompt-lab/variants/v8-karpov-legal.ts), but with gemma4.ts's
// ELO-persona system line in place of v8's Karpov flavor text — see the
// NOTE on ELO above. -------------------------------------------------------

const retrySystem = (elo: number, turn: GameState['turn']): string =>
  `You are a chess engine playing the ${sideName(turn)} pieces at ` +
  `approximately ${elo} Elo strength. You will be given a chess position ` +
  `and the list of all legal moves. Choose the best move. Reply with ` +
  `ONLY that move in Standard Algebraic Notation, exactly as it appears ` +
  `in the list. No explanation, no commentary — just the single move.`

function retryUserMessage(ctx: MoveContext): string {
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

export const qwen35Adapter: ModelAdapter = {
  name: 'qwen3.5-two-stage',
  matches: (modelId: string) => modelId.includes('qwen3.5'),
  buildRequest: (ctx: MoveContext): ModelRequest =>
    ctx.correction
      ? {
          kind: 'chat',
          messages: [
            { role: 'system', content: retrySystem(ctx.elo, ctx.state.turn) },
            { role: 'user', content: retryUserMessage(ctx) },
          ],
        }
      : { kind: 'completion', prompt: firstAttemptPrompt(ctx) },
  parseMoves: (reply: string, ctx: MoveContext): MoveInput[] =>
    ctx.correction ? parseSanCandidates(reply) : parseFirstSan(reply),
  sampling: { temperature: 0, maxTokens: 64, reasoningEffort: 'none' },
}
