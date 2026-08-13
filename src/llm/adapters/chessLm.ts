import { toLegalSan, toSanMoveChain } from './encoding'
import { parseFirstSan } from './parseSan'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'

// ippity/chessLM-0.01-llama-3.1-8b — a Llama 3.1 8B finetuned on
// Alpaca-style chess prompts (see the HuggingFace model card, quoted
// verbatim in docs/superpowers/specs/2026-08-13-chesslm-adapter-design.md).
// The finetune fixes the prompt format, so this adapter reproduces it
// exactly: raw completion (the model has no chat template — LM Studio's
// chat endpoint would wrap the text in a Llama template it was never
// trained on), SAN move history plus the legal-move list, response
// terminator `### Response:\n`. Retries stay in the same format with a
// one-line correction note appended to the input section.
//
// NOTE on ELO: the Alpaca format has no persona slot, so the app's ELO
// setting is not expressible here and is intentionally omitted (same
// precedent as qwen35's attempt-1 PGN completion).
//
// The model is trained to predict "the subsequent moves until the end of
// the game", so the first SAN token of the reply is the move for the
// current position — parseFirstSan's first-mentioned-first order matches,
// and later tokens serve as engine-validated backup candidates.

const ALPACA_PREAMBLE =
  'Below is an instruction that describes a task, paired with an input ' +
  'that provides further context. Write a response that appropriately ' +
  'completes the request.\n\n' +
  '### Instruction:\n' +
  'Given the moves so far in a chess game, predict the subsequent moves ' +
  'until the end of the game.\n\n' +
  '### Input:\n'

const BAD_REPLY_MAX = 80

const truncate = (s: string): string => {
  const collapsed = s.replace(/\s+/g, ' ')
  return collapsed.length > BAD_REPLY_MAX
    ? `${collapsed.slice(0, BAD_REPLY_MAX)}…`
    : collapsed
}

function buildPrompt(ctx: MoveContext): string {
  const correction = ctx.correction
    ? `\nNote: "${truncate(ctx.correction.badReply)}" was not a legal ` +
      `move. Choose one move from the legal moves list.`
    : ''
  return (
    ALPACA_PREAMBLE +
    `Moves so far: ${toSanMoveChain(ctx.state)}\n` +
    `Legal moves: ${toLegalSan(ctx.legal)}${correction}\n\n` +
    '### Response:\n'
  )
}

export const chessLmAdapter: ModelAdapter = {
  name: 'chesslm-alpaca',
  matches: (modelId: string) => modelId.toLowerCase().includes('chesslm'),
  buildRequest: (ctx: MoveContext): ModelRequest => ({
    kind: 'completion',
    prompt: buildPrompt(ctx),
  }),
  parseMoves: (reply: string) => parseFirstSan(reply),
  // The model card generates with max_new_tokens=16; 32 leaves headroom
  // for the game continuation the parser mines for backup candidates.
  // Not a reasoning model — no reasoningEffort needed.
  sampling: { temperature: 0, maxTokens: 32 },
}
