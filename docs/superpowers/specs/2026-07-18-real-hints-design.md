# Sub-project D₂ — Real hints (HintConsole)

Date: 2026-07-18
Status: Design (approved by user, pending spec review)

## Context

The real-gameplay track (A→B→C→D) reached D₁ (real history + persistence + clocks,
merged). Sub-project **D** was decomposed into **D₁** (done) and **D₂** (real hints +
a commentary-model adapter). This cycle delivers **real hints only**. The
**commentary-model adapter** (`chess-gemma-commentary`) remains deferred to its own
later cycle — it is a distinct concern (it _comments on_ a played move rather than
_suggesting_ one).

Unlike D₁, this cycle **does involve the LLM** — a hint is an LLM-generated move
recommendation. But it reuses the existing `src/llm` transport (`chatCompletion`) and
the engine's legality judgment; it adds no per-model adapter registry.

### What exists today (relevant surfaces)

- `src/ui/game/HintConsole.tsx` — presentational, currently **inert**: `GameScreen`
  renders it with `level={0}` and `disabled`, and it reads a fixed demo `HINT`
  (e2→e4, three prose levels) from `src/ui/game/chessDemo.ts`.
- `src/ui/game/chessDemo.ts` — exports `HintLevel` (`0 | 1 | 2 | 3`), the demo `HINT`
  object, `HINT_LEGAL`, plus board helpers (`sqName`, `nameToRC`, `FILES`,
  `START_POSITION`) used elsewhere.
- The three hint levels (from the Nocturne prototype, already in i18n): **L1
  «Фигура» / "Piece"** (which piece), **L2 «Идея» / "Idea"** (the tactic), **L3 «Ход»
  / "Move"** (where exactly). Button copy keys `hint1_t/s`…`hint3_t/s` and
  `hint_empty` already exist.
- `src/llm/selectMove.ts` + `src/llm/adapters/` — the move-selection engine: build a
  request, call a transport, parse SAN candidates, validate against the engine's legal
  set, retry with correction, random-legal fallback. `parseSanCandidates` is exported
  from `src/llm/adapters/genericFen.ts`. `LMStudioError` (from `src/llm/chat.ts`)
  signals a connection/transport failure.
- `src/ui/game/Board.tsx` — renders squares and applies state classes (`sel`, `last`,
  `check`, `legal`) by matching the square name against props.
- `src/styles/app.css` — already ships prototype hint CSS: `.sq.hint1` (pulsing
  outline) and `.sq.hint-target` (subtle outline), plus an unused `.arrows` overlay.
- `useGame` exposes `state`, `thinking`, `connectionError`, `outcome`. Human plays
  White; the model plays Black. Hints are requested only on the **human's turn**.

## Decisions (from brainstorming)

1. **Scope:** real hints only. The commentary adapter stays deferred.
2. **Hint model:** one LLM call recommends **one** best move + a one-sentence idea; the
   three level buttons **progressively reveal that single recommendation**. Refresh
   re-rolls (a new recommendation).
3. **Level content:** **L1** = the piece _type_ to move (no square — keeps a clean
   L1→L3 gradation); **L2** = the model's one-sentence idea; **L3** = the exact move
   (`from → to`) **plus a board highlight** of the from/to squares.
4. **Board highlight (L3):** reuse the existing `.sq.hint1` (from) / `.sq.hint-target`
   (to) CSS via a new optional `Board` prop. No arrow overlay (YAGNI).
5. **Failure handling:** on connection failure or no legal move after N attempts, show
   an **error in the panel**; refresh retries. **Never** show a random move as a hint
   (unlike `selectMove`, which must keep the game moving). When the model is
   disconnected / it isn't the human's live turn, the level buttons are disabled.
6. **Model:** reuse the connected opponent model (same `baseUrl`/`model`). No separate
   hint model, no per-model hint adapter.
7. **Clock:** requesting a hint does **not** pause White's clock — it's the human's own
   time.

## Architecture

Three separated concerns, mirroring the codebase's existing boundaries:

- **LLM hint generation** — `src/llm/hint.ts` (`getHint`, pure of React/UI).
- **Hint UI state/lifecycle** — `src/ui/game/useHint.ts` (a focused hook).
- **Presentation** — `HintConsole` (panel) + `Board` (L3 highlight), wired by
  `GameScreen`.

The engine remains the sole authority on legality: a hint's move is validated against
`legalMoves(state)` exactly as `selectMove` validates the model's move.

### 1. LLM — `src/llm/hint.ts`

```ts
export type Hint = {
  san: string // validated SAN, e.g. 'Nf3'
  from: SquareName
  to: SquareName
  pieceType: PieceType // for L1
  idea: string // model's one-sentence explanation, for L2
}

export class HintUnavailableError extends Error {} // no legal hint after retries

export type GetHintParams = {
  baseUrl: string
  model: string
  state: GameState
  elo: number
  signal?: AbortSignal
}
export type GetHintDeps = { chat?: typeof chatCompletion }

export function getHint(
  params: GetHintParams,
  deps?: GetHintDeps,
): Promise<Hint>
```

- **Prompt (chat):** system — "You are a chess coach for the side to move at
  approximately `<elo>` Elo. Recommend the single best move and explain the idea in ONE
  short sentence. Answer EXACTLY as two lines: `Move: <SAN>` then `Idea: <one
sentence>`." user — move history + FEN + whose turn (mirrors `genericFen`'s user
  message shape).
- **Parse:** run `parseSanCandidates` over the reply (reuse the export from
  `adapters/genericFen`); the **first candidate that is legal** in `state` wins →
  yields `san`/`from`/`to` (from the engine's matched `LegalMove`) and `pieceType`
  (the piece on `from`). `idea` = the text after `Idea:` (trimmed, length-capped;
  fallback to a generic localized-agnostic empty string that the UI replaces — see
  i18n note).
- **Retry:** up to `MAX_HINT_ATTEMPTS = 3`, re-requesting with a correction note when no
  candidate was legal (same pattern as `selectMove`).
- **Failure:** if no legal move after the attempts → `throw new HintUnavailableError`.
  `LMStudioError` from the transport **propagates** (connection failure is the caller's
  concern). **No random fallback.**
- `getHint` never imports from `ui`. `pieceType` comes from the engine board at `from`.

Note on `idea`: `getHint` returns whatever prose the model gave (possibly empty). It
does **not** localize — the UI supplies the L1 template and a fallback string when
`idea` is empty. The idea text itself is model output, shown verbatim (trimmed).

### 2. Hook — `src/ui/game/useHint.ts`

```ts
useHint(opts: {
  baseUrl: string
  model: string
  elo: number
  state: GameState
  enabled: boolean
  getHintFn?: typeof getHint // test seam
}): {
  level: HintLevel // 0 = nothing revealed
  hint: Hint | null
  loading: boolean
  errorKind: 'unavailable' | 'connection' | null
  hintMove: { from: SquareName; to: SquareName } | null // non-null only at level 3
  reveal: (lv: HintLevel) => void
  refresh: () => void
}
```

- `reveal(lv)`: if a hint already exists, just set the revealed `level = lv` (no
  fetch). If not, and not already loading, fetch one (async, `AbortController`); on
  success store the hint and set `level = lv`. `lv` is 1|2|3 (level 0 is the cleared
  state).
- `refresh()`: abort any in-flight request, clear the current hint, and fetch a new one
  (re-roll); keep the current revealed level (default to 1 if currently 0).
- **Clearing:** whenever `state.fen` changes **or** `enabled` becomes false, abort any
  in-flight request and reset (`hint = null`, `level = 0`, `errorKind = null`,
  `loading = false`). A generation ref (as in `useGame`) discards stale async results
  (New Game, the human moving, unmount).
- **Errors:** `HintUnavailableError` → `errorKind = 'unavailable'`; `LMStudioError`
  → `errorKind = 'connection'`. Any other error clears `loading` and rethrows
  (programmer error, not masked).
- `hintMove` = `level === 3 && hint ? { from, to } : null`.

The hook is UI-state, not i18n-aware: it exposes a discriminated `errorKind`
(`'unavailable' | 'connection'`) rather than a language string, and `HintConsole`
maps that kind to localized copy.

### 3. `HintConsole` — rewrite

- Drop the `chessDemo` `HINT` import. New props: `level`, `hint: Hint | null`,
  `loading: boolean`, `errorKind: 'unavailable' | 'connection' | null`,
  `onSelectLevel`, `onRefresh`, `disabled`.
- The level buttons (1/2/3) stay (existing `hint1_t/s`… copy); clicking one calls
  `onSelectLevel(lv)`; the refresh button calls `onRefresh`.
- Readout precedence: `disabled` or (`level === 0` and no error/loading) → `hint_empty`;
  `loading` → `hint_loading`; `errorKind` → `hint_error` (connection vs unavailable can
  share one message or differ — implementer picks, both keys provided); else the hint:
  - **L1:** title `hint1_t`; body = `hint_l1` template with the localized piece name
    (from `pieceType`).
  - **L2:** title `hint2_t`; body = `hint.idea` (verbatim; if empty, a fallback line).
  - **L3:** title `hint3_t`; body = `\`${hint.from} → ${hint.to}\``(+ the board
highlight comes from`Board`).

### 4. `Board` — new prop

Add optional `hintMove?: { from: SquareName; to: SquareName } | null`. Apply `.hint1`
to the `from` square and `.hint-target` to the `to` square (both already styled),
mirroring the existing `last`/`sel` class logic. When `hintMove` is null (levels 0–2),
no hint classes render.

### 5. `GameScreen` — wiring

- Compose `useHint` next to `useGame`. Compute
  `hintEnabled = state.turn === 'w' && !g.thinking && !g.outcome.over &&
!g.connectionError && !!model`.
- Render `HintConsole` with the real props (remove the hardcoded `disabled` / `level={0}`
  / no-op handlers). Pass `disabled={!hintEnabled}`.
- Pass `hintMove={hint.hintMove}` into `Board`.

### 6. i18n (`src/ui/app/i18n.tsx`)

- Reuse `hint1_t/s`…`hint3_t/s`, `hint_empty`.
- **Add** (RU + EN): six piece names in the form used by the L1 template
  (`hint_piece_p/n/b/r/q/k`), the L1 template `hint_l1` (e.g. «Подумайте о ходе
  {piece}» / "Consider moving your {piece}"), `hint_loading`, `hint_error`
  (unavailable), `hint_error_conn` (connection), and an empty-idea fallback
  (`hint_idea_empty`).
- Extend the i18n parity test to cover the new keys.

The L1 template composes `hint_l1` with `hint_piece_<type>`; keep the Russian piece
forms in the instrumental case so «ходе конём/слоном/ладьёй/ферзём/пешкой/королём»
reads correctly.

## Testing (TDD)

- **`hint.test.ts`** — parses `Move:`/`Idea:` and returns a `Hint`; the **first legal**
  candidate wins when the reply is chatty; illegal/unparseable → correction re-request
  → success; `HintUnavailableError` after `MAX_HINT_ATTEMPTS`; `LMStudioError`
  propagates; `pieceType`/`from`/`to` come from the engine's matched legal move.
  Transport mocked via the `chat` dep; never hits a real model.
- **`useHint.test.ts`** — first `reveal` fetches; switching level with a hint present
  does **not** refetch; `refresh` refetches; clears on `state.fen` change and on
  `enabled → false`; `hintMove` non-null only at level 3; a stale async result after a
  position change is discarded; `HintUnavailableError`/`LMStudioError` set the right
  `errorKind`. `getHintFn` seam mocked.
- **`HintConsole.test.tsx`** — empty / loading / error / L1 / L2 / L3 readouts; level and
  refresh callbacks fire; disabled state.
- **`Board.test.tsx`** — `hintMove` applies `hint1` to `from` and `hint-target` to `to`;
  absent when null.
- **`GameScreen.test.tsx`** — hint panel enabled only on White's live turn; disabled
  while the model thinks / after game over / on connection error; selecting L3
  highlights the board.
- **i18n parity** — new keys present in both languages.

Network is never hit; the LLM boundary is mocked via `getHintFn` / the `chat` dep.

## Files

**New**

- `src/llm/hint.ts` (+ `hint.test.ts`)
- `src/ui/game/useHint.ts` (+ `useHint.test.ts`)

**Modified**

- `src/ui/game/HintConsole.tsx` (+ test) — real props, readout states, no demo data
- `src/ui/game/Board.tsx` (+ test) — `hintMove` prop → hint1/hint-target classes
- `src/ui/game/GameScreen.tsx` (+ test) — compose `useHint`, wire panel + board
- `src/ui/app/i18n.tsx` — piece names, L1 template, loading/error/idea-fallback (+ parity test)
- `src/ui/game/chessDemo.ts` (+ test) — remove demo `HINT` / `HINT_LEGAL`; keep
  `HintLevel` and the board helpers

## Non-goals (this cycle)

- The commentary-model adapter (`chess-gemma-commentary`).
- A per-model hint adapter registry (single generic hint prompt only).
- An arrow overlay on the board (`.arrows`); the from/to outline is enough.
- Pausing the clock during a hint request.
- Persisting hints or counting hint usage.

## Accepted defaults

- Hints use the connected opponent model (no separate hint model).
- White's clock keeps running during a hint request.
- L1 reveals only the piece _type_, not its square (clean L1→L3 gradation).
- `MAX_HINT_ATTEMPTS = 3` (mirrors `selectMove`'s `MAX_MOVE_ATTEMPTS`).
