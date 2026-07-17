# LLM opponent — design (sub-project C)

Status: **approved for planning** · Date: 2026-07-17 · Track: real gameplay (chess.js), sub-project **C**

## 1. Goal & scope

Bring the game screen to life by having a **local LM Studio model play Black** against the
human (White). This realises the product's core principle — **the LLM _selects_ a move, the
library (`chess.js`, via `src/engine`) _judges_ legality** — and never the other way around.

In scope (C):

- A **chat/completion transport** in `src/llm` (currently only `listModels` + `loadModel` exist).
- A **universal, per-model abstraction layer** (`ModelAdapter`) that decides _how a position is
  encoded_ for a given model and _how its reply is parsed_ back into a move — injected by which
  model is selected, with a **generic default** for unknown models.
- A **move-selection engine** (`selectMove`) built on that abstraction: validate against the
  engine, retry on illegal/unparseable, fall back to a random legal move.
- **Orchestration** in `useGame`: after the human's White move, request Black's move; show
  "thinking"; auto-retry + banner on connection failure.
- Small **presentation** touches on the game screen.

Explicitly **out of scope** (deferred, mostly to sub-project D):

- Real hints / explanations — `HintConsole` stays **inert** (its `disabled` prop remains).
- A **commentary adapter** for models like `chess-gemma-commentary` (a different interface; see §9).
- Real move clocks, persistence, finished-game → History wiring (all sub-project D).
- Any specialised move-selection adapter beyond the generic default (added per-model later; see §9).
- Choosing sides / playing Black as the human (C is fixed: human White, model Black).

## 2. Layering (unchanged principle)

Three responsibilities stay separate and one-directional:

- `src/engine/` — **rules/state** (lowest layer; no React, no LLM). Untouched by C.
- `src/llm/` — **model I/O + move selection**. May import `engine` (to validate moves and encode
  positions). This is where C's new code mostly lives.
- `src/ui/` — **presentation + orchestration**. Imports both.

`llm` depending on `engine` is intended (the move-selection layer validates the model's move
against `engine.legalMoves`); `engine` never depends on `llm` or `ui`.

## 3. The abstraction: `ModelAdapter` (heart of C)

Different chess models want the current position in radically different shapes (a **FEN board
snapshot**, a **SAN/UCI move chain**, a **PGN**, sometimes **with the legal-move list included**),
use different **transports** (chat messages vs a raw prompt completion), and emit their move in
different ways (a single SAN token, a UCI coordinate string, or a whole predicted sequence). The
adapter is the single seam that absorbs all of this.

```ts
// src/llm/adapters/types.ts
import type { GameState, LegalMove, MoveInput } from '../../engine/types'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Transport is a property of the adapter: a chat request OR a raw prompt completion.
export type ModelRequest =
  | { kind: 'chat'; messages: ChatMessage[] }
  | { kind: 'completion'; prompt: string }

export type MoveContext = {
  state: GameState
  elo: number
  legal: LegalMove[] // precomputed (also needed for fallback); adapter decides whether to expose it to the model
  correction?: { badReply: string; reason: string } // present on a retry attempt
}

export type ModelAdapter = {
  name: string
  matches: (modelId: string) => boolean // which model id(s) this adapter claims
  buildRequest: (ctx: MoveContext) => ModelRequest // HOW the position is encoded + transport
  parseMoves: (reply: string, ctx: MoveContext) => MoveInput[] // HOW the reply becomes ordered candidate moves
  sampling?: { temperature?: number; maxTokens?: number } // per-model tuning
}
```

Why each field:

- **`buildRequest`** owns the entire request. It can emit chat `messages` (generic default) or a
  raw `completion` prompt (for Alpaca/completion-style finetunes). It reads `ctx.state` and the
  `encoding` helpers (§4) to render FEN, a move chain, PGN, etc. — and `ctx.legal` if the model
  was trained to receive legal moves. On a retry, `ctx.correction` lets the adapter phrase the
  "that move was illegal, try again" message in its own format.
- **`parseMoves`** returns an **ordered `MoveInput[]`** — SAN strings _or_ coordinate objects
  `{ from, to, promotion? }`. This is what makes the output side universal: SAN models, UCI /
  coordinate models, and models that emit a whole move _sequence_ (return the sequence split into
  candidates, first legal wins) are all expressible. `MoveInput` is exactly what `engine.move`
  already accepts.
- **`sampling`** carries per-model knobs (e.g. a completion model that should stop after ~16
  tokens). Falls back to `selectMove` defaults (§6) when absent.

### Registry + dependency injection

```ts
// src/llm/adapters/index.ts
import { genericFenAdapter } from './genericFen'

const ADAPTERS: ModelAdapter[] = [
  // specialised adapters registered here as they are written (see §9) — none in C
]

export const defaultAdapter: ModelAdapter = genericFenAdapter

export function resolveAdapter(modelId: string): ModelAdapter {
  return ADAPTERS.find((a) => a.matches(modelId)) ?? defaultAdapter
}
```

`resolveAdapter` is the injector: `selectMove` receives the resolved adapter (or one injected
directly in tests) and depends only on the `ModelAdapter` interface, never on a concrete model.

## 4. `src/llm/adapters/encoding.ts` — reusable position encoders

Pure helpers so adapters don't re-derive position formats:

- `toFen(state): string` — current FEN (`state.fen`).
- `toSanMoveChain(state): string` — space-joined SAN history (`state.history`).
- `toPgn(state): string` — numbered PGN move text from the SAN history.
- `toUciMoveChain(state): string` — UCI (`e2e4`, `e7e8q`) chain, derived by replaying history
  through the engine.
- `toLegalSan(legal): string` — space-joined SAN of the legal moves (for models trained with a
  legal-move list, e.g. chessLM).

Only the ones the shipped `genericFen` adapter needs are strictly required in C; the rest are part
of the universal core so future adapters compose them without touching the engine. All are unit-
tested from known positions.

## 5. `src/llm/chat.ts` — transports (new file)

Two thin `fetch` wrappers over LM Studio's native API family (matching the existing
`/api/v0/...` calls in `client.ts`), both non-streaming, both mapping failures to the existing
`LMStudioError` taxonomy (`network` / `http` / `parse`):

- `chatCompletion(baseUrl, req): Promise<string>` → `POST /api/v0/chat/completions`.
  `req: { model, messages: ChatMessage[], temperature?, maxTokens?, signal? }`. Returns the
  assistant message content.
- `completion(baseUrl, req): Promise<string>` → `POST /api/v0/completions`.
  `req: { model, prompt: string, temperature?, maxTokens?, signal? }`. Returns the completion text.

`signal` (an `AbortSignal`) supports cancellation (New Game / unmount mid-request). `client.ts`
is **not** extended — its responsibility is model discovery/loading; chat/completion is a distinct
concern in its own file.

Tests mock `fetch` (as in `client.listModels.test.ts` / `client.loadModel.test.ts`): success
returns content; network error, non-OK HTTP, and invalid JSON each throw the right `LMStudioError`.
`completion` is tested even though no C-shipped adapter uses it yet — it is core universal
infrastructure that future completion-style adapters (§9) rely on with zero core changes.

## 6. `src/llm/selectMove.ts` — generic move-selection engine

Pure orchestration around the resolved adapter. No React.

```ts
export type MoveSelection = {
  nextState: GameState
  san: string
  source: 'model' | 'fallback'
}

export async function selectMove(
  params: {
    baseUrl: string
    model: string
    state: GameState
    elo: number
    signal?: AbortSignal
  },
  deps?: {
    adapter?: ModelAdapter
    chat?: typeof chatCompletion
    complete?: typeof completion
    rng?: () => number
  },
): Promise<MoveSelection>
```

Algorithm:

1. `legal = legalMoves(state)`. Resolve `adapter = deps.adapter ?? resolveAdapter(model)`.
2. Attempt loop of up to `MAX_MOVE_RETRIES` (= 3) **total model calls** (i.e. the first request
   plus up to two correction re-requests) before giving up and falling back:
   a. Build `ctx` (with `correction` set from the previous bad reply on attempts ≥ 2).
   b. `req = adapter.buildRequest(ctx)`; dispatch by `req.kind` to `chatCompletion` /
   `completion`, passing `adapter.sampling` merged over defaults (`MODEL_TEMPERATURE ≈ 0.7`,
   `MAX_TOKENS ≈ 64`) and the `signal`.
   c. `candidates = adapter.parseMoves(reply, ctx)`. For each candidate in order, try
   `move(state, candidate)`; the first non-`null` result wins → return `{ nextState, san, source: 'model' }`.
   d. If none is legal, record the reply as `correction.badReply` and loop.
3. After the retries are exhausted, pick a uniformly-random move from `legal` (using `deps.rng`),
   apply it, and return `{ ..., source: 'fallback' }`.

**Connection failures are not swallowed.** If `chatCompletion` / `completion` throws
`LMStudioError` (network/http/parse/timeout), `selectMove` lets it propagate — that is the
orchestrator's concern (§7), distinct from "the model played an illegal move" (always resolved to
a legal move here).

Tests inject a fake `adapter` and/or fake `chat`/`complete` + fixed `rng`; no network, no React:
legal on first try; illegal → correction → legal (assert `correction` reached the adapter);
all illegal → random fallback (`source: 'fallback'`, move is legal); a `parseMoves` that yields
multiple candidates picks the first legal one; prose reply handled by the generic adapter's parser;
`chat`/`complete` throwing `LMStudioError` propagates out.

## 7. `src/ui/game/useGame.ts` — orchestrating the model's turn

**Semantics change from B:** the human plays **White only**; the model plays **Black**. The
hotseat behaviour (human moving both sides) is removed.

- New signature: `useGame(opts: { baseUrl: string; model: string; elo: number; selectMoveFn?: typeof selectMove })`.
  `selectMoveFn` is an injection seam for tests (defaults to the real `selectMove`).
- New state: `thinking: boolean`, `connectionError: string | null`. Existing
  `selected` / `legalTargets` / `pendingPromotion` unchanged.
- **Human move** (`onSquareClick`): unchanged select→move logic, but gated — ignored while
  `thinking`, while `connectionError` is set, or when it is Black's turn. Promotion picker stays
  White-only (the human's choice); Black's promotions arrive inside the model's move (e.g. SAN
  `e1=Q` or a coordinate `MoveInput` with `promotion`) and are applied by the engine directly.
- **Model turn** is driven by an effect keyed on `state.fen`: when it is Black's turn, the game is
  not over, and there is no outstanding `connectionError`, run `runModelTurn`:
  1. `thinking = true`; call `selectMoveFn({ baseUrl, model, state, elo, signal })`.
  2. On success, apply `nextState` (guarded against stale results — see below); `thinking = false`.
  3. On `LMStudioError`, **auto-retry** a small number of times (2) with backoff (≈ 400 ms, 800 ms;
     the delay is injectable for tests). If still failing, set `connectionError` to the error
     message and `thinking = false`.
- `retryModelTurn()` clears `connectionError` and re-triggers the effect (manual banner action).
- **Cancellation & races:** an `AbortController` in a ref is passed as `signal`; a generation
  counter (a ref incremented by `newGame()` and on unmount) tags each run so results from an
  aborted/stale generation are ignored before `setState`. `newGame()` aborts any in-flight request,
  resets to the start position (White to move, human starts), and clears `thinking` /
  `connectionError` / selection / pending promotion.

## 8. Presentation (`src/ui/game`, thin) + `App.tsx`

- **`GameScreen`** forwards `thinking`, `connectionError`, `retryModelTurn` from `useGame` and:
  - Opponent `PlayerStrip` is `active` while `thinking`.
  - Status line while `thinking`: reuse the existing `theirsub` string ("Модель думает…" /
    "The model is thinking…") as the small text.
  - When a `fallback` move was just played, show a subtle one-line note (auto-clears on the next
    human move) — new key `fallback_move`.
  - The board is non-interactive while `thinking` / `connectionError` (already gated in `useGame`;
    optional subtle dim).
- **Error banner** in the side column: message + a "retry" button wired to `retryModelTurn`. New
  i18n keys (RU/EN): `conn_lost` ("Модель недоступна" / "Model unavailable"),
  `retry_move` ("Повторить ход" / "Retry move"), and `fallback_move`
  ("Модель не нашла ход — сыгран случайный" / "Model found no move — a random one was played").
- **`App.tsx`** passes `baseUrl={conn.state.baseUrl}` and `model={conn.state.activeModel}` (plus
  the existing `elo`) to `GameScreen`. If `model` is absent (should not happen via normal
  onboarding), the screen treats it as a configuration error rather than calling the model.
- `HintConsole` remains rendered with `disabled` (inert) — unchanged.

## 9. How the two real example models map onto the abstraction (validation, not built in C)

These confirm the interface is sufficient; **neither adapter is written in C** (per the agreed
scope), but the layer is ready for them with no core changes.

- **`ippity/chessLM-0.01-llama-3.1-8b`** (a _playing_ model, Llama 3.1 8B, GGUF, ~1300–1700 ELO):
  Alpaca **completion** transport (`### Instruction / ### Input / ### Response:`); input is a
  **SAN move chain + the legal-move list**; output is a **predicted sequence** of SAN moves.
  Its future adapter: `buildRequest` → `{ kind: 'completion', prompt: <alpaca with toSanMoveChain +
toLegalSan> }`, `sampling.maxTokens ≈ 16`, `parseMoves` → split the sequence into ordered SAN
  candidates. Note this legitimately uses a legal-move list and a completion transport — the
  opposite of the generic default's FEN-only chat contract. That divergence is exactly why the
  abstraction exists; "FEN-only, no legal list" is the **generic default's** contract only.
- **`NAKSTStudio/chess-gemma-commentary`** (a _commentary_ model, Gemma 3 270M + LoRA): takes FEN +
  the _already-played_ move + centipawn eval and returns **prose commentary + predicted ELO + a
  move classification**. It does **not** select a move, so it does not fit `ModelAdapter` at all —
  it belongs to a future **`CommentaryAdapter`** interface serving hints/teaching (sub-project D),
  not C.

## 10. Constants

`MAX_MOVE_RETRIES = 3` · `MODEL_TEMPERATURE ≈ 0.7` · `MAX_TOKENS ≈ 64` (generic default) ·
request timeout ≈ 60 s (local models are slow; a timeout maps to a `network` `LMStudioError`) ·
connection auto-retry = 2 attempts with ≈ 400/800 ms backoff.

## 11. Rejected alternative

Putting prompt construction + the model call + retries + state transitions **inside `useGame`**.
Rejected: it mixes model I/O into the UI layer and is barely unit-testable. The chosen split keeps
a pure, adapter-driven `selectMove` in `llm/` and leaves `useGame` owning only the async lifecycle
(effects, thinking/error state, cancellation).

## 12. Testing summary

- `chat.ts` — mock `fetch`; success + each `LMStudioError` kind, for both `chatCompletion` and
  `completion`.
- `encoding.ts` — pure encoders from known positions.
- `adapters/genericFen.ts` — `buildRequest` shape (chat, FEN, persona from `eloBand`, correction on
  retry) and `parseMoves` (SAN token, prose-wrapped move, unparseable → empty).
- `selectMove.ts` — injected fake adapter + fake transport + fixed `rng`; the scenarios in §6.
- `useGame` — injected `selectMoveFn`: model turn triggers after the White move and Black moves;
  `thinking` toggles; `connectionError` set after auto-retries exhaust; `retryModelTurn` recovers;
  `newGame` aborts and ignores stale results. Existing B hotseat tests are updated for
  "human plays White only".
- The infra smoke test (`App.test.tsx`) stays green.

## 13. Definition of done

`npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` all green;
a human can play a full game as White against a locally-served model as Black end-to-end
(verified live against LM Studio); illegal/unparseable model replies recover via retry→fallback
without stalling; a mid-game connection drop shows the banner and recovers on retry.
