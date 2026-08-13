# chessLM Adapter — Design

**Date:** 2026-08-13
**Status:** Approved
**Scope:** A new `ModelAdapter` for `ippity/chessLM-0.01-llama-3.1-8b` (LM Studio model id `chesslm-0.01-llama-3.1-8b`), plus extraction of the shared first-mentioned-first SAN parser.

## Background

The user has `chessLM-0.01-llama-3.1-8b` — a chess-finetuned Llama 3.1 8B — loaded in LM Studio. Its HuggingFace model card documents the exact training/prompt format, so unlike gemma4 and qwen3.5 there is nothing to discover with a Prompt Lab campaign: the prompt is fixed by the finetune. Decision (2026-08-13, with the user): implement the adapter straight from the documented format, no campaign.

Documented format (Alpaca-style, raw completion — the model has no chat template):

```
Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
Given the moves so far in a chess game, predict the subsequent moves until the end of the game.

### Input:
Moves so far: <space-separated SAN move history>
Legal moves: <space-separated legal moves in SAN>

### Response:
```

The model replies with SAN moves continuing the game (it is trained to predict "the subsequent moves until the end of the game", so the first SAN token is the move for the current position). The card uses `max_new_tokens=16` and notes the model "deteriorates after about 20 moves" and lacks positional awareness.

## Design

### New file: `src/llm/adapters/chessLm.ts`

Exports `chessLmAdapter: ModelAdapter`.

- **name:** `chesslm-alpaca`
- **matches:** `(modelId) => modelId.toLowerCase().includes('chesslm')` — covers the LM Studio id `chesslm-0.01-llama-3.1-8b` and future versions.
- **buildRequest:** always `{ kind: 'completion', prompt }` (never chat — the finetune is on raw Alpaca text; LM Studio's chat endpoint would wrap it in a Llama chat template the model was not trained on, including on retries). The prompt is the documented Alpaca format verbatim:
  - `Moves so far:` from `toSanMoveChain(ctx.state)` (space-separated SAN history; empty history leaves the value empty — defensive only, since the model plays Black and always has history).
  - `Legal moves:` from `toLegalSan(ctx.legal)`.
  - The prompt ends with `### Response:\n` — the trailing newline matches the model card.
- **Correction/retry:** stay in the native Alpaca format. When `ctx.correction` is present, append one line to the `### Input:` section:
  `Note: "<badReply>" was not a legal move. Choose one move from the legal moves list.`
  (badReply is truncated to a sane length so a rambling reply does not blow up the prompt.)
- **parseMoves:** first-mentioned-first SAN extraction — the shared `parseFirstSan` (see below). The engine (`selectMove`) validates each candidate in order, so later SAN tokens from the model's game continuation serve as backup candidates.
- **sampling:** `{ temperature: 0, maxTokens: 32 }`. No `reasoningEffort` — not a reasoning model. `maxTokens: 32` doubles the card's 16 to leave headroom for the continuation the parser mines for candidates.
- **ELO:** intentionally omitted — the Alpaca format has no persona slot (same precedent as qwen35's attempt-1 PGN completion). Documented in a code comment.

### Refactor: shared `parseFirstSan`

`parseFirstSan` and its `SAN_RE` regexp currently live in `qwen35.ts`. Move them to `src/llm/adapters/parseSan.ts` (new file, one responsibility: SAN extraction from completion-style replies); `qwen35.ts` and `chessLm.ts` both import from there. Behavior unchanged: all SAN-shaped tokens in order of first mention, deduplicated.

### Registration

`index.ts`: add `chessLmAdapter` to the `ADAPTERS` list (order among specific adapters does not matter — the match predicates are disjoint).

## Testing (TDD)

Mirrors `qwen35.test.ts` / `gemma4.test.ts` style — behavior via the adapter's public surface:

- `chessLm.test.ts`:
  - matching: positive (`chesslm-0.01-llama-3.1-8b`, case variants), negative (`qwen3.5`, `gemma-4`, generic ids).
  - buildRequest: kind is `completion`; exact prompt text with a mid-game position (history + legal moves rendered); empty-history rendering; correction appended when `ctx.correction` present, absent otherwise; badReply truncation.
  - parseMoves: first move first, deduplication, garbage reply → empty list.
  - sampling values: `temperature 0`, `maxTokens 32`, no `reasoningEffort`.
- `parseSan.test.ts`: the extracted parser's cases (moved/adapted from the qwen35 suite where they covered `parseFirstSan`).
- `index.test.ts`: `resolveAdapter('chesslm-0.01-llama-3.1-8b')` returns the chessLM adapter; existing resolutions unchanged.
- No network in unit tests — the adapter is pure (build/parse), transports untouched.

## Risks / limitations

- Prompt-tail fidelity matters for a finetune: keep the `### Response:` terminator and newlines exactly as documented.
- Known model weakness ("deteriorates after ~20 moves") is not mitigated here — the engine's legality gate, correction retries, and random-legal fallback already bound the damage.
- No measured match/legality metrics (no campaign, by decision). If play quality disappoints, a follow-up eval (`npm run prompt-lab -- eval`) can quantify it against the generic baseline.

## Out of scope

- Prompt Lab campaign / report in `docs/prompt-lab/`.
- Any UI changes — the adapter is picked up automatically by `resolveAdapter` when the user selects the model in onboarding.
