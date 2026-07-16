# Design: Chess engine core (`src/engine`, chess.js wrapper) — Sub-project A

Date: 2026-07-16

## Context

Everything built so far is presentational or infrastructure: the LM Studio
connection engine (`src/llm`, `useConnection`), the onboarding wizard, and the
Nocturne design-system port (shell, static game screen, History screen) are all
in place, but `src/engine/` is still an empty `.gitkeep` placeholder. There is
**no real chess logic** — `ui/game/` renders a fixed start position from
`ui/game/chessDemo.ts`, and `ui/history/` shows hardcoded demo matches.

Bringing real gameplay in is a large track that does not fit a single spec. It
was decomposed (and the decomposition approved) into four sub-projects, built in
this order:

- **A — Engine core (`src/engine`)** ← _this spec._ chess.js wrapper: legal
  moves, make move, check/checkmate/stalemate/draw detection, FEN, SAN, whose
  turn, game-over reason. Pure logic, no React, no network, fully unit-testable.
- **B — Interactive human play.** Wire `ui/game` to the engine: click
  select→move, legal-move highlighting from the engine, real move list, turn
  indicator, game-over state. Board becomes live (human can move both sides; no
  LLM yet). Depends on A.
- **C — LLM opponent.** New chat-completion function in `src/llm` + a
  move-selection layer that prompts the model for a move, **validates it against
  the engine's legal moves and retries on illegal/unparseable output**, and has
  the model play Black. This is where "the LLM selects and explains, the library
  adjudicates" comes alive. Depends on A, B.
- **D — (later) Real history + persistence.** Finished game → History entry
  (replacing demo data), real hints from the live position, clocks. Depends on
  A, B, C.

Each sub-project gets its own spec → plan → implementation cycle. This spec
covers **A only**.

## Hard product constraints this honours

- **Chess rules are owned by a library, never by the LLM.** This module is that
  ownership boundary: `chess.js` adjudicates legality, check/mate/draw. The LLM
  (sub-project C) will only _select_ a move from the legal set this module
  reports.
- **Frontend-only, no backend, no secrets.** `chess.js` is a client-side
  library; nothing here touches the network.

## Approach (chosen during brainstorming)

- **Immutable functional facade.** `src/engine` exposes an own immutable
  `GameState` type plus pure functions (`newGame`, `move`, `legalMoves`). The
  `chess.js` `Chess` instance is a private implementation detail that never
  escapes the module. This is the best fit for React (a `GameState` snapshot is
  a render input; a new move yields a new reference) and for testing (pure
  functions, no shared mutable state).
- **Both move formats.** `move()` accepts either a coordinate object
  `{ from, to, promotion? }` (what the board in B produces from clicks) or a SAN
  string (what the LLM in C typically emits). Both consumers are already known,
  so supporting both here avoids an awkward conversion shim later.
- **The engine owns the board matrix and the base types.** `GameState` carries a
  ready-to-render `board: Square[][]`; `Color` / `PieceType` / `Square` become
  canonical in `src/engine` and existing `ui/game` code imports them from there.
  The engine is the single source of game state — `ui/` never parses FEN.

## Module: `src/engine`

### Files & boundaries

- `src/engine/types.ts` — canonical domain types (see API below).
- `src/engine/game.ts` — the immutable facade: `newGame`, `move`, `legalMoves`,
  plus a private `hydrate` helper.
- `src/engine/game.test.ts` — Vitest unit tests (pure, no network, no React).

Dependencies: **`chess.js` only.** No React, no `fetch`, no imports from `ui/`
or `llm/`. The `Chess` instance never leaves the module.

`chess.js` is a **new runtime dependency** (`dependencies`, not `devDependencies`
— it ships in the app). Add it via `npm install chess.js` so `package.json` and
`package-lock.json` are updated together (CI uses `npm ci`).

### Public API

```ts
type Color = 'w' | 'b'
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
type Square = { color: Color; type: PieceType } | null // rank 8 first, file a first
type SquareName = string // 'e4'
type PromotionPiece = 'q' | 'r' | 'b' | 'n'

type MoveInput =
  | { from: SquareName; to: SquareName; promotion?: PromotionPiece }
  | string // SAN, e.g. 'Nf3', 'e4', 'O-O', 'exd8=Q'

type LegalMove = {
  from: SquareName
  to: SquareName
  san: string
  promotion?: PromotionPiece
}

type GameResult = 'white' | 'black' | 'draw' | 'ongoing'
type DrawReason =
  | 'stalemate'
  | 'fifty-move'
  | 'threefold'
  | 'insufficient-material'
  | null

type GameStatus = {
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean // any draw type
  isGameOver: boolean
  result: GameResult
  drawReason: DrawReason
}

type GameState = {
  initialFen: string // base position (start, or a custom FEN passed to newGame)
  fen: string // current position
  turn: Color
  board: Square[][] // rank 8 first, file a first — ready for Board.tsx, no parsing
  history: string[] // SAN of each move played, in order
  lastMove: { from: SquareName; to: SquareName; san: string } | null
  status: GameStatus
}

function newGame(fen?: string): GameState
function move(state: GameState, m: MoveInput): GameState | null
function legalMoves(state: GameState, from?: SquareName): LegalMove[]
```

Semantics:

- **`newGame(fen?)`** — a fresh game from the standard start position, or from a
  custom FEN. `initialFen` is set to that base; `history` is empty; `lastMove` is
  `null`; `status` is computed for the position.
- **`move(state, m)`** — returns a **new** `GameState` with the move applied, or
  **`null`** if the move is illegal or unparseable (covers both a coordinate move
  with no matching legal move and an unparseable/illegal SAN string). It never
  throws on a rejected move and never mutates `state`. The played move's SAN is
  available as `newState.lastMove.san` and appended to `newState.history`.
- **`legalMoves(state, from?)`** — with no `from`, every legal move in the
  position; with `from`, only moves originating on that square (used by B for
  destination-square highlighting). Empty array when the game is over or the
  square has no legal moves.

**Rejection contract:** `move()` returns `null` on rejection rather than
throwing. This gives sub-project C a trivial retry signal (`if (!next) retry`)
and sub-project B a clean "reject the click" branch, without try/catch in
consumers.

### Key implementation decision: reconstruct by replaying history

`GameState` is a plain, serialisable snapshot — it holds no live `Chess`
instance. Each call rebuilds one internally via a private
`hydrate(state): Chess`:

```
hydrate(state) = new Chess(state.initialFen), then replay state.history in order
```

**Why replay instead of `new Chess(state.fen)`:** a single FEN does **not**
capture the full sequence of visited positions, so **threefold-repetition
detection is lost** if the instance is reconstructed from `fen` alone. The
50-move counter, en passant target, and castling rights _are_ encoded in the
FEN, but repetition is not. Replaying `history` from `initialFen` reproduces the
exact internal position history chess.js needs for `isThreefoldRepetition()`.
This is O(n) per call / O(n²) per game, which is negligible at chess move counts
(a few hundred plies at most).

`move()` therefore: `hydrate(state)` → attempt the move (chess.js `.move()`
returns `null`/throws on illegal — normalise both to our `null`) → on success
read the new `fen`, `turn`, `board`, updated `history` (old history + new SAN),
`lastMove`, and recompute `status`, returning a new `GameState`.

`status` is computed once at state-construction time and stored in the snapshot
(it is a field, not a function), mapping chess.js predicates:

- `isCheck` ← `inCheck()`
- `isCheckmate` ← `isCheckmate()`
- `isStalemate` ← `isStalemate()`
- `isDraw` ← `isDraw()` (true for stalemate, fifty-move, threefold, insufficient
  material)
- `isGameOver` ← `isGameOver()`
- `result` ← `'white'`/`'black'` when checkmate (side that delivered mate),
  `'draw'` when any draw, else `'ongoing'`
- `drawReason` ← `'stalemate'` | `'threefold'` (`isThreefoldRepetition()`) |
  `'insufficient-material'` (`isInsufficientMaterial()`) | `'fifty-move'` (draw
  that is none of the above) | `null` when not a draw

### Board matrix orientation

`board` is `Square[][]` indexed `board[rank][file]` with **rank 8 as row 0 and
file `a` as column 0** — identical to the existing `START_POSITION` in
`ui/game/chessDemo.ts`, so `Board.tsx` renders it unchanged. chess.js `.board()`
already returns this orientation (rank 8 first); map its
`{ type, color, square }` cells to our `{ color, type }` (and `null` for empty).

### Type migration (within A, no behaviour change)

`Color` / `PieceType` / `Square` currently live in `ui/game/pieceSvgs.ts` and
are re-declared in `ui/game/chessDemo.ts`. Make `src/engine/types.ts` the
canonical definition and have `ui/game/pieceSvgs.ts`, `ui/game/chessDemo.ts`, and
`ui/game/Board.tsx` import them from `src/engine`. This is an **import-only
change with no runtime effect** — `chessDemo` and the static board keep working
exactly as before (sub-project B replaces them). All existing tests stay green.
This introduces a `ui/game → engine` dependency, which is the correct direction
(presentation depends on rules, never the reverse).

## Testing strategy (Vitest, pure functions, no network)

`src/engine/game.test.ts` asserts observable behaviour:

- **Start position:** `newGame()` → `turn: 'w'`, `status.isGameOver: false`;
  `board` deep-equals the current `START_POSITION` matrix.
- **Legal moves:** `legalMoves(newGame())` has length 20;
  `legalMoves(newGame(), 'e2')` yields exactly `e3` and `e4`.
- **Making moves:** a coordinate move `{ from: 'e2', to: 'e4' }` and the SAN
  `'e4'` produce equivalent resulting states (`fen`, `turn`, `history`);
  `lastMove.san` is `'e4'`.
- **Rejection:** an illegal coordinate move (`{ from: 'e2', to: 'e5' }`) → `null`;
  a garbage SAN (`'Zz9'`) → `null`; the input `state` is unchanged either way.
- **Checkmate:** a short mating line (e.g. Fool's Mate) → `isCheckmate: true`,
  `isGameOver: true`, `result` = the mating side.
- **Stalemate:** a known stalemate FEN via `newGame(fen)` → `isStalemate: true`,
  `isDraw: true`, `result: 'draw'`, `drawReason: 'stalemate'`.
- **Insufficient material:** a K-vs-K FEN → `isDraw: true`,
  `drawReason: 'insufficient-material'`.
- **Fifty-move:** a FEN with the halfmove clock at the draw threshold, plus the
  move that trips it → `isDraw: true`, `drawReason: 'fifty-move'`.
- **Threefold repetition:** replay a knight-shuffle that repeats the position
  three times → `isDraw: true`, `drawReason: 'threefold'`. This test
  specifically validates the replay-hydration approach (it would fail if state
  were rebuilt from `fen` alone).
- **Promotion:** a pawn move to the last rank with `promotion: 'q'` (coordinate
  form) and the SAN form (`'e8=Q'`) both succeed and place a queen.
- **Immutability:** after `move(state, …)`, the original `state.fen` and
  `state.history` are unchanged, and the returned state is a different reference.

Existing `src/llm`, connection, onboarding, and `ui/game` / `ui/history` tests
stay green (the type migration must not break them). No live model or network is
used anywhere in A.

## Error handling

- Illegal / unparseable moves are a normal, expected outcome, surfaced as `null`
  from `move()` — not exceptions.
- A malformed custom FEN passed to `newGame(fen)` is the one place chess.js may
  throw on construction. `newGame` is only called by us with either no argument
  (start) or a valid FEN (tests / future features); we do not add defensive
  parsing for arbitrary user FEN input in A, since there is no UI path that
  supplies one. (If B/D ever accept user-entered FEN, validation belongs there.)

## Out of scope (A)

- Board interactivity: clicks, selection, legal-move highlighting UI, drag —
  sub-project B.
- Any React: no `useGame` hook, no components. A is pure functions only.
- LLM: chat-completion client, move-selection/validation loop, model play —
  sub-project C.
- Real hints from the live position, clocks, and persisting finished games to
  History — sub-project D.
- Undo/takeback as an engine method: not needed — immutability gives the UI
  free undo by retaining previous `GameState` references.
- Opening names, ELO enforcement, evaluation/scoring — not part of rules
  adjudication.
