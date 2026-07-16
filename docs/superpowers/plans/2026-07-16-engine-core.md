# Chess Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/engine` — an immutable, fully unit-tested chess.js wrapper that owns all rules/state (legal moves, make move, check/checkmate/stalemate/draw detection, FEN, SAN, board matrix).

**Architecture:** A pure functional facade. `chess.js`'s mutable `Chess` instance is a private implementation detail; the module exposes an immutable `GameState` snapshot plus pure functions `newGame` / `move` / `legalMoves`. Each call rebuilds a `Chess` internally by replaying the stored SAN history from the base FEN (never from the current FEN alone) so that threefold-repetition detection survives. No React, no network.

**Tech Stack:** TypeScript 5 (strict), `chess.js` (new runtime dependency), Vitest.

## Global Constraints

- **Frontend-only, no backend, no secrets.** `chess.js` is client-side; nothing here touches the network. (spec: "Frontend-only, no backend, no secrets")
- **Rules owned by the library, never the LLM.** This module is that boundary; the `Chess` instance never escapes it. (spec: "Chess rules are owned by a library")
- **`src/engine` depends on `chess.js` only** — no React, no `fetch`, no imports from `ui/` or `llm/`. (spec: "Files & boundaries")
- **`chess.js` goes in `dependencies`, not `devDependencies`** (it ships in the app; CI uses `npm ci`). (spec: "Files & boundaries")
- **Prettier style: no semicolons, single quotes, trailing commas, 80-col.** Run `npm run format` before every commit. (CLAUDE.md)
- **TypeScript strict is on.** No `any` without a justifying comment. (CLAUDE.md)
- **`npm run typecheck` is `tsc -b`** (composite project references) — do not change it to `--noEmit`. (CLAUDE.md)
- **chess.js v1.x `Chess#move()` THROWS on an illegal/unparseable move** (it does not return `null`). Our `move()` must catch and normalise to `null`. (implementation note)
- **Board matrix orientation: `board[rank][file]`, rank 8 = row 0, file `a` = col 0** — identical to the existing `START_POSITION` in `ui/game/chessDemo.ts`. `chess.js` `.board()` already returns this orientation. (spec: "Board matrix orientation")

---

### Task 1: Dependency, types, `newGame` + snapshot

**Files:**
- Modify: `package.json` / `package-lock.json` (via `npm install chess.js`)
- Delete: `src/engine/.gitkeep`
- Create: `src/engine/types.ts`
- Create: `src/engine/game.ts`
- Test: `src/engine/game.test.ts`

**Interfaces:**
- Consumes: `chess.js` (`Chess` class).
- Produces (relied on by all later tasks):
  - Types `Color`, `PieceType`, `Square`, `SquareName`, `PromotionPiece`, `MoveInput`, `LegalMove`, `GameResult`, `DrawReason`, `GameStatus`, `GameState` (exact shapes below).
  - `newGame(fen?: string): GameState`
  - Private `hydrate(state: GameState): Chess` and `snapshot(chess: Chess, initialFen: string): GameState` (not exported, but Tasks 2–3 call `snapshot`/`hydrate` from within `game.ts`).

- [ ] **Step 1: Install chess.js**

```bash
npm install chess.js
```

Expected: `chess.js` appears under `"dependencies"` in `package.json`; `package-lock.json` updated.

- [ ] **Step 2: Remove the engine placeholder**

```bash
git rm src/engine/.gitkeep
```

- [ ] **Step 3: Write `src/engine/types.ts`**

```ts
// Canonical chess domain types. src/engine is the single source of truth for
// game state; ui/ and llm/ import these rather than re-declaring them.

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

// One board square: an occupied square carries a piece, an empty square is null.
export type Square = { color: Color; type: PieceType } | null

// Algebraic square name, e.g. 'e4'.
export type SquareName = string

// A move to apply: either coordinates (what the board produces from clicks) or
// a SAN string (what the LLM emits), e.g. 'Nf3', 'e4', 'O-O', 'exd8=Q'.
export type MoveInput =
  | { from: SquareName; to: SquareName; promotion?: PromotionPiece }
  | string

export type LegalMove = {
  from: SquareName
  to: SquareName
  san: string
  promotion?: PromotionPiece
}

export type GameResult = 'white' | 'black' | 'draw' | 'ongoing'

export type DrawReason =
  | 'stalemate'
  | 'fifty-move'
  | 'threefold'
  | 'insufficient-material'
  | null

export type GameStatus = {
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  isGameOver: boolean
  result: GameResult
  drawReason: DrawReason
}

export type GameState = {
  initialFen: string // base position (start, or a custom FEN passed to newGame)
  fen: string // current position
  turn: Color
  board: Square[][] // rank 8 first, file a first — ready for Board.tsx
  history: string[] // SAN of each move played, in order
  lastMove: { from: SquareName; to: SquareName; san: string } | null
  status: GameStatus
}
```

- [ ] **Step 4: Write the failing test for `newGame`**

Create `src/engine/game.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { newGame } from './game'

describe('newGame', () => {
  test('starts a fresh game in the standard position', () => {
    const state = newGame()
    expect(state.turn).toBe('w')
    expect(state.history).toEqual([])
    expect(state.lastMove).toBeNull()
    expect(state.status.isGameOver).toBe(false)
    expect(state.status.isCheck).toBe(false)
    expect(state.status.result).toBe('ongoing')
    expect(state.status.drawReason).toBeNull()
  })

  test('board is rank-8-first, file-a-first with the start position', () => {
    const { board } = newGame()
    // row 0 = rank 8 = black back rank
    expect(board[0][0]).toEqual({ color: 'b', type: 'r' })
    expect(board[0][4]).toEqual({ color: 'b', type: 'k' })
    // row 1 = rank 7 = black pawns
    expect(board[1][0]).toEqual({ color: 'b', type: 'p' })
    // rows 2..5 empty
    expect(board[3][3]).toBeNull()
    // row 6 = rank 2 = white pawns; row 7 = rank 1 = white back rank
    expect(board[6][0]).toEqual({ color: 'w', type: 'p' })
    expect(board[7][4]).toEqual({ color: 'w', type: 'k' })
  })

  test('accepts a custom starting FEN', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
    const state = newGame(fen)
    expect(state.initialFen).toBe(fen)
    expect(state.fen).toBe(fen)
    expect(state.turn).toBe('w')
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run src/engine/game.test.ts`
Expected: FAIL — `newGame` is not exported from `./game` (module has no such export).

- [ ] **Step 6: Implement `src/engine/game.ts`**

```ts
import { Chess } from 'chess.js'
import type {
  Color,
  DrawReason,
  GameResult,
  GameState,
  GameStatus,
  Square,
} from './types'

// Rebuild a mutable Chess from an immutable snapshot by replaying the SAN
// history from the base position. Replaying (rather than `new Chess(state.fen)`)
// is required so chess.js retains the full position history and can detect
// threefold repetition — a single FEN does not encode it.
function hydrate(state: GameState): Chess {
  const chess = new Chess(state.initialFen)
  for (const san of state.history) chess.move(san)
  return chess
}

function mapBoard(chess: Chess): Square[][] {
  return chess.board().map((row) =>
    row.map((cell) => (cell ? { color: cell.color, type: cell.type } : null)),
  )
}

function computeStatus(chess: Chess): GameStatus {
  const isCheckmate = chess.isCheckmate()
  const isStalemate = chess.isStalemate()
  const isDraw = chess.isDraw()
  const isGameOver = chess.isGameOver()

  let result: GameResult = 'ongoing'
  if (isCheckmate) {
    // The side to move has been mated, so the other side won.
    result = chess.turn() === 'w' ? 'black' : 'white'
  } else if (isDraw) {
    result = 'draw'
  }

  let drawReason: DrawReason = null
  if (isDraw) {
    if (isStalemate) drawReason = 'stalemate'
    else if (chess.isThreefoldRepetition()) drawReason = 'threefold'
    else if (chess.isInsufficientMaterial()) drawReason = 'insufficient-material'
    else drawReason = 'fifty-move'
  }

  return {
    isCheck: chess.inCheck(),
    isCheckmate,
    isStalemate,
    isDraw,
    isGameOver,
    result,
    drawReason,
  }
}

// Build an immutable snapshot from a hydrated Chess instance.
function snapshot(chess: Chess, initialFen: string): GameState {
  const verbose = chess.history({ verbose: true })
  const last = verbose.at(-1)
  return {
    initialFen,
    fen: chess.fen(),
    turn: chess.turn() as Color,
    board: mapBoard(chess),
    history: chess.history(),
    lastMove: last
      ? { from: last.from, to: last.to, san: last.san }
      : null,
    status: computeStatus(chess),
  }
}

export function newGame(fen?: string): GameState {
  const chess = fen ? new Chess(fen) : new Chess()
  return snapshot(chess, fen ?? chess.fen())
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/engine/game.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Format, then commit**

```bash
npm run format
git add package.json package-lock.json src/engine/types.ts src/engine/game.ts src/engine/game.test.ts
git commit -m "feat(engine): chess.js wrapper foundation — types, newGame, snapshot"
```

---

### Task 2: `legalMoves`

**Files:**
- Modify: `src/engine/game.ts`
- Test: `src/engine/game.test.ts`

**Interfaces:**
- Consumes: `hydrate`, `newGame`, `GameState`, `LegalMove` from Task 1.
- Produces: `legalMoves(state: GameState, from?: SquareName): LegalMove[]` — with no `from`, every legal move; with `from`, only moves originating on that square. Empty array when the game is over or the square has no legal moves.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/game.test.ts`:

```ts
import { legalMoves } from './game'

describe('legalMoves', () => {
  test('lists all 20 legal moves in the start position', () => {
    expect(legalMoves(newGame())).toHaveLength(20)
  })

  test('lists moves from a single square', () => {
    const dests = legalMoves(newGame(), 'e2')
      .map((m) => m.to)
      .sort()
    expect(dests).toEqual(['e3', 'e4'])
  })

  test('returns an empty array for a square with no legal moves', () => {
    expect(legalMoves(newGame(), 'e4')).toEqual([])
  })

  test('returns an empty array when the game is over', () => {
    // A finished game (stalemate: black king a8, white king c7, queen b6,
    // black to move has no legal move). Game over ⇒ no legal moves.
    const fen = 'k7/2K5/1Q6/8/8/8/8/8 b - - 0 1'
    expect(legalMoves(newGame(fen))).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/game.test.ts`
Expected: FAIL — `legalMoves` is not exported.

- [ ] **Step 3: Implement `legalMoves`**

Add to `src/engine/game.ts` (import `LegalMove` and `SquareName` in the existing `import type` block):

```ts
export function legalMoves(
  state: GameState,
  from?: SquareName,
): LegalMove[] {
  const chess = hydrate(state)
  const moves = from
    ? chess.moves({ square: from as never, verbose: true })
    : chess.moves({ verbose: true })
  return moves.map((m) => ({
    from: m.from,
    to: m.to,
    san: m.san,
    ...(m.promotion ? { promotion: m.promotion } : {}),
  }))
}
```

Note: `chess.moves({ square })` types the square as chess.js's own `Square` union; `as never` bridges our `SquareName` (string) to it without leaking the chess.js type into our public API. An out-of-range square yields `[]`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/game.test.ts`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Format, then commit**

```bash
npm run format
git add src/engine/game.ts src/engine/game.test.ts
git commit -m "feat(engine): legalMoves (all moves or per-square)"
```

---

### Task 3: `move` (coordinates + SAN, rejection, immutability, promotion)

**Files:**
- Modify: `src/engine/game.ts`
- Test: `src/engine/game.test.ts`

**Interfaces:**
- Consumes: `hydrate`, `snapshot`, `newGame`, `GameState`, `MoveInput` from Task 1.
- Produces: `move(state: GameState, m: MoveInput): GameState | null` — a new `GameState` with the move applied, or `null` if the move is illegal/unparseable. Never throws on a rejected move, never mutates `state`. Played SAN is at `result.lastMove.san` and appended to `result.history`.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/game.test.ts`:

```ts
import { move } from './game'

describe('move', () => {
  test('applies a coordinate move and records SAN + history', () => {
    const next = move(newGame(), { from: 'e2', to: 'e4' })
    expect(next).not.toBeNull()
    expect(next!.turn).toBe('b')
    expect(next!.history).toEqual(['e4'])
    expect(next!.lastMove).toEqual({ from: 'e2', to: 'e4', san: 'e4' })
  })

  test('applies a SAN move equivalently to the coordinate form', () => {
    const byCoord = move(newGame(), { from: 'e2', to: 'e4' })
    const bySan = move(newGame(), 'e4')
    expect(bySan).not.toBeNull()
    expect(bySan!.fen).toBe(byCoord!.fen)
    expect(bySan!.history).toEqual(['e4'])
  })

  test('returns null for an illegal coordinate move', () => {
    expect(move(newGame(), { from: 'e2', to: 'e5' })).toBeNull()
  })

  test('returns null for an unparseable SAN string', () => {
    expect(move(newGame(), 'Zz9')).toBeNull()
  })

  test('does not mutate the input state', () => {
    const state = newGame()
    const fenBefore = state.fen
    const historyLenBefore = state.history.length
    const next = move(state, 'e4')
    expect(state.fen).toBe(fenBefore)
    expect(state.history).toHaveLength(historyLenBefore)
    expect(next).not.toBe(state)
  })

  test('handles promotion in both coordinate and SAN form', () => {
    const fen = '8/4P3/8/8/8/8/8/4k1K1 w - - 0 1'
    const byCoord = move(newGame(fen), { from: 'e7', to: 'e8', promotion: 'q' })
    expect(byCoord).not.toBeNull()
    expect(byCoord!.board[0][4]).toEqual({ color: 'w', type: 'q' })

    const bySan = move(newGame(fen), 'e8=Q')
    expect(bySan).not.toBeNull()
    expect(bySan!.board[0][4]).toEqual({ color: 'w', type: 'q' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/game.test.ts`
Expected: FAIL — `move` is not exported.

- [ ] **Step 3: Implement `move`**

Add to `src/engine/game.ts` (add `MoveInput` to the existing `import type` block):

```ts
export function move(state: GameState, m: MoveInput): GameState | null {
  const chess = hydrate(state)
  try {
    // chess.js v1.x throws on an illegal/unparseable move.
    const applied = chess.move(m as never)
    if (!applied) return null
  } catch {
    return null
  }
  return snapshot(chess, state.initialFen)
}
```

Note: `m as never` accepts both our `{ from, to, promotion? }` object and a SAN string against chess.js's overloaded `move()` signature without widening our public `MoveInput` type. The `if (!applied)` guard is defensive for any chess.js build that returns `null` instead of throwing.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/game.test.ts`
Expected: PASS (Tasks 1–3 tests).

- [ ] **Step 5: Format, then commit**

```bash
npm run format
git add src/engine/game.ts src/engine/game.test.ts
git commit -m "feat(engine): move — coord + SAN, null on rejection, immutable"
```

---

### Task 4: Game-over taxonomy (checkmate, stalemate, insufficient material, fifty-move, threefold)

**Files:**
- Modify: `src/engine/game.ts` only if a test reveals a `computeStatus` bug (implementation was written in Task 1).
- Test: `src/engine/game.test.ts`

**Interfaces:**
- Consumes: `newGame`, `move` from Tasks 1 & 3; `GameState.status` (`GameStatus`).
- Produces: no new exports — this task locks down the `status` mapping, and specifically validates the history-replay hydration via the threefold case.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/game.test.ts`:

```ts
describe('game-over detection', () => {
  test('checkmate reports the mating side as the result', () => {
    // Fool's Mate: 1. f3 e5 2. g4 Qh4#
    let s = newGame()
    s = move(s, 'f3')!
    s = move(s, 'e5')!
    s = move(s, 'g4')!
    s = move(s, 'Qh4#')!
    expect(s.status.isCheckmate).toBe(true)
    expect(s.status.isGameOver).toBe(true)
    expect(s.status.result).toBe('black')
    expect(s.status.drawReason).toBeNull()
  })

  test('stalemate is a draw with reason stalemate', () => {
    // Classic stalemate: black king a8, white king c7, white queen b6, black to move.
    const s = newGame('k7/2K5/1Q6/8/8/8/8/8 b - - 0 1')
    expect(s.status.isStalemate).toBe(true)
    expect(s.status.isDraw).toBe(true)
    expect(s.status.result).toBe('draw')
    expect(s.status.drawReason).toBe('stalemate')
  })

  test('king vs king is an insufficient-material draw', () => {
    const s = newGame('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(s.status.isDraw).toBe(true)
    expect(s.status.drawReason).toBe('insufficient-material')
  })

  test('fifty-move rule is a draw with reason fifty-move', () => {
    // Halfmove clock at 99; a non-pawn, non-capture move trips it to 100.
    const s = move(newGame('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'), 'Ra2')!
    expect(s.status.isDraw).toBe(true)
    expect(s.status.drawReason).toBe('fifty-move')
  })

  test('threefold repetition is detected across replayed history', () => {
    // Shuffle knights back to the start position twice.
    let s = newGame()
    for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) {
      s = move(s, san)!
    }
    expect(s.status.isDraw).toBe(true)
    expect(s.status.drawReason).toBe('threefold')
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/engine/game.test.ts`
Expected: PASS. `computeStatus` from Task 1 already implements this mapping; the threefold case passes only because `hydrate` replays history. If any test fails (e.g. a FEN typo or a chess.js predicate name), fix `computeStatus` / the FEN inline until green.

- [ ] **Step 3: Commit**

```bash
npm run format
git add src/engine/game.test.ts src/engine/game.ts
git commit -m "test(engine): game-over taxonomy incl. threefold via history replay"
```

---

### Task 5: Migrate `Color` / `PieceType` / `Square` to be engine-canonical

**Files:**
- Modify: `src/ui/game/pieceSvgs.ts:1-2`
- Modify: `src/ui/game/chessDemo.ts:1-3`

**Interfaces:**
- Consumes: `Color`, `PieceType`, `Square` from `src/engine/types` (Task 1).
- Produces: no new runtime behaviour. This is an **import-only refactor** — `src/engine/types` becomes the single definition; `ui/game` re-exports for existing importers. Its "test" is the existing suite staying green.

- [ ] **Step 1: Point `pieceSvgs.ts` at the engine types**

Replace lines 1–2 of `src/ui/game/pieceSvgs.ts`:

```ts
export type Color = 'w' | 'b'
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
```

with:

```ts
import type { Color, PieceType } from '../../engine/types'
export type { Color, PieceType }
```

(Keep line 3 `export type PieceSvg = ...` and everything below unchanged. The `Record<PieceType, PieceSvg>` on line 7 keeps working; the re-export keeps `import ... from './pieceSvgs'` sites — e.g. `Piece.tsx` — working.)

- [ ] **Step 2: Point `chessDemo.ts` at the engine types**

In `src/ui/game/chessDemo.ts`, replace line 1:

```ts
import type { Color, PieceType } from './pieceSvgs'
```

with:

```ts
import type { PieceType, Square } from '../../engine/types'
```

and delete line 3:

```ts
export type Square = { color: Color; type: PieceType } | null
```

replacing it with a re-export so any importer of `Square` from `chessDemo` still resolves:

```ts
export type { Square } from '../../engine/types'
```

(`Color` is no longer referenced directly in `chessDemo.ts` after the `Square` definition is removed; `PieceType` is still used in the `parseFEN` cast on line ~22. If `tsc` reports `Color` as unused, drop it from the import — the previous step keeps it exported from `pieceSvgs`.)

- [ ] **Step 3: Run the full unit suite to prove no behaviour changed**

Run: `npm test`
Expected: PASS — all existing `ui/game` tests (Board, Piece, GameScreen, etc.) and the new engine tests are green. No test was added or removed in this task.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: no errors (the engine types are structurally identical to the previous local ones, so all sites still type-check).

- [ ] **Step 5: Format, then commit**

```bash
npm run format
git add src/ui/game/pieceSvgs.ts src/ui/game/chessDemo.ts
git commit -m "refactor(engine): make Color/PieceType/Square engine-canonical"
```

---

### Task 6: Full quality gate + docs

**Files:**
- Modify: `CLAUDE.md` (engine no longer a placeholder)

**Interfaces:** none.

- [ ] **Step 1: Run the exact CI gate locally**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: every stage green. Fix anything that fails before proceeding.

- [ ] **Step 2: Update `CLAUDE.md` project structure**

In the `## Project structure` block, change the `engine/` line from:

```
  engine/   # chess.js wrapper (rules/state) — NOT YET BUILT, still a .gitkeep placeholder
```

to:

```
  engine/   # chess.js wrapper (rules/state) — DONE: types.ts, game.ts (newGame/move/legalMoves) (+ tests)
```

And in the paragraph below the structure block, update the sentence beginning "`engine/` is still a placeholder — no chess.js, no real gameplay yet." to reflect that the engine core now exists but `ui/game` / `ui/history` are still on demo data (sub-projects B/C/D wire them up). Keep the three-layer separation guidance intact.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: engine core built — update CLAUDE.md project structure"
```

---

## Notes for the implementer

- **Run one test file** while iterating with `npx vitest run src/engine/game.test.ts`; run the **whole suite** with `npm test` before the Task 5 and Task 6 gates.
- The `describe`/`import` blocks in later tasks append to the single `src/engine/game.test.ts`. It is fine to hoist all `import { … } from './game'` lines to the top of the file as you go, rather than repeating imports mid-file — just keep the tests grouped by `describe`.
- Do **not** add an `undo` function, opening names, evaluation, or any React — those are out of scope for sub-project A (see spec "Out of scope").
- If `chess.js` predicate names differ in the installed version (this plan targets v1.x: `inCheck`, `isCheckmate`, `isStalemate`, `isDraw`, `isThreefoldRepetition`, `isInsufficientMaterial`, `isGameOver`, `board`, `moves`, `history`, `fen`, `turn`, `move`), consult the installed `chess.js` types and adjust `computeStatus` accordingly — the mapping is the only place that touches them.
