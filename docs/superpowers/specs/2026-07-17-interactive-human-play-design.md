# Design: Interactive human play (wire `ui/game` to the engine) — Sub-project B

Date: 2026-07-17

## Context

Sub-project A (`src/engine`, merged in PR #6) delivered a pure, immutable
chess.js wrapper: `newGame` / `move(state, m) → GameState | null` /
`legalMoves(state, from?)`, with an engine-owned board matrix and a full
game-status taxonomy. It is rules/state only — no React, no UI.

The game screen (`src/ui/game/`) is still **static presentational demo**: the
`Board` renders a fixed start position and canned teaching hints from
`chessDemo.ts`; `MoveList` shows an empty placeholder; the status line says
"your move"; clocks are frozen. Nothing is actually playable.

This is sub-project **B** of the real-gameplay track (A→B→C→D). B makes the
board **actually playable** by a human in **hotseat** mode (one human moving
both sides, turn alternating), driven by the engine. No LLM yet — that is
sub-project C.

Decisions taken during brainstorming:

- **Hotseat**: the human moves whichever side is to move. Lets a full game be
  played and exercises the whole engine loop end-to-end before C.
- **Click-to-move only** ("select → move"). Drag input is deferred (it needs
  pointer math and layout, which jsdom can't exercise).
- **Promotion via a mini-picker** (Q/R/B/N) — full rules incl. underpromotion,
  appropriate for a teaching app.
- **The teaching `HintConsole` stays visible but inert** (buttons disabled,
  "soon"). Real hints need the LLM (C/D); the board drops its demo-hint overlay.
- **A working "New Game" (restart)** control; "Offer draw" / "Resign" stay
  disabled (they need an opponent / negotiation — C).

## Existing assets this reuses

The Nocturne CSS already ships every interaction class B needs (verified in
`src/styles/app.css`): `.sq.sel` (selected), `.sq.last` (last-move squares),
`.sq.check::after` (king in check), `.sq.legal` + `.sq .marker.dot` /
`.marker.ring` (legal target: dot = quiet move, ring = capture),
`.status` / `.status.theirs` / `.turn-dot` (side-to-move indicator), and
`.moves table` / `.moves .mv.cur` (move list with current-move highlight). The
prototype's interaction model is `docs/design-reference/gambit-local/app/board.js`
(select → highlight legal → click target; tracks `selected` / `legal` / `last`).

**B adds new CSS in exactly one place: a small `.promo` block for the
promotion picker.** Everything else reuses the classes above.

## Architecture

```
GameScreen (owns useGame(); derives view-model; lays out the screen)
├── PlayerStrip ×2      (active follows state.turn; clocks frozen)
├── Board               (presentational, interactive — real selection/legal/last/check)
├── PromotionPicker     (shown only when a promotion is pending)
├── HintConsole         (inert: disabled, empty readout)
└── MoveList            (real SAN history + New Game)
```

`src/engine` stays untouched. Data flows one way: `useGame` holds the engine
`GameState`; `GameScreen` derives a small view-model and passes explicit props
down; components call back up (`onSquareClick`, `choosePromotion`, `onNewGame`).

### `src/ui/game/useGame.ts` — the single owner of game state

A thin React wrapper over the immutable engine. In-memory only — **no
persistence** (persisting a game is sub-project D).

```ts
import type { GameState, SquareName, PromotionPiece } from '../../engine/types'

export type LegalTarget = { to: SquareName; capture: boolean }
export type PendingPromotion = { from: SquareName; to: SquareName } | null

export type UseGame = {
  state: GameState
  selected: SquareName | null
  legalTargets: LegalTarget[] // legal moves from `selected` (empty if none selected)
  pendingPromotion: PendingPromotion
  onSquareClick: (sq: SquareName) => void
  choosePromotion: (p: PromotionPiece) => void
  cancelPromotion: () => void
  newGame: () => void
}

export function useGame(): UseGame
```

- `state` initialised from `newGame()`. `selected` / `pendingPromotion` are
  React state; `legalTargets` is derived from `legalMoves(state, selected)`.
- **`capture`** for each target: `move.san.includes('x')` (covers captures and
  en passant) → `ring`; otherwise `dot`.
- **`onSquareClick(sq)`** (ported from `board.js`):
  1. If `state.status.isGameOver` → ignore.
  2. If there is a `selected` piece and `sq` is one of its legal targets:
     - If the move `selected → sq` has promotion variants (any legal move with
       `from === selected && to === sq && promotion` set) → set
       `pendingPromotion = { from: selected, to: sq }` and return (do **not**
       move yet).
     - Else apply `move(state, { from: selected, to: sq })`; on non-null result
       adopt the new state and clear `selected`.
  3. Else if `sq` holds a piece of `state.turn` → `selected = sq` (recompute
     `legalTargets`).
  4. Else → clear `selected`.
- **`choosePromotion(p)`**: with `pendingPromotion` set, apply
  `move(state, { from, to, promotion: p })`; adopt new state, clear
  `pendingPromotion` and `selected`. (The engine's `move` returning `null` here
  would be a bug, not a user path — B does not special-case it beyond leaving
  state unchanged.)
- **`cancelPromotion()`**: clear `pendingPromotion` (keep `selected`).
- **`newGame()`**: reset `state = newGame()`, clear `selected` and
  `pendingPromotion`.

Because the engine is immutable, adopting a new `GameState` reference is the
only mutation; React re-renders naturally. Undo is not needed (immutability
would make it free later, but no UI calls for it in B).

### `src/ui/game/Board.tsx` — refactor to interactive presentational

The board stops rendering the demo-hint overlay (`hint1` / `hint-target` and the
`Arrow` component are removed) and renders **real** interaction state. New props:

```ts
board: Square[][]
selected: SquareName | null
legalTargets: LegalTarget[]
lastMove: { from: SquareName; to: SquareName } | null
checkSquare: SquareName | null
onSquareClick: (sq: SquareName) => void
boardStyle: BoardStyle
pieceStyle: PieceStyle
```

Per square (`board[r][c]`, `sqName(r,c)`):

- base `sq` + `light`/`dark` (unchanged parity), coord labels (unchanged).
- `sel` when `sqName === selected`.
- `last` when `lastMove` and `sqName` is its `from` or `to`.
- `check` when `sqName === checkSquare`.
- if `sqName` is in `legalTargets`: add `legal`, and render
  `<span className="marker ring" />` when that target's `capture` is true, else
  `<span className="marker dot" />`.
- the piece (from `board[r][c]`) via `Piece`, unchanged.
- `onClick` → `onSquareClick(sqName)`; `data-sq={sqName}` retained.

The whole board is one click surface; `GameScreen` computes `checkSquare` (scan
`board` for `{ color: state.turn, type: 'k' }` when `state.status.isCheck`, else
`null`).

### `src/ui/game/PromotionPicker.tsx` — new

Rendered by `GameScreen` only when `pendingPromotion !== null`. A small overlay
(`.promo`, absolutely positioned over the board) with four buttons showing the
piece glyphs (reusing `Piece` / `PIECE_SVGS`) in the color of `state.turn`, in
order Queen, Rook, Bishop, Knight. Props:

```ts
color: Color
onChoose: (p: PromotionPiece) => void
onCancel: () => void
```

Clicking a button → `onChoose(p)`. Clicking the backdrop or pressing `Escape` →
`onCancel()`. This is the one component that needs **new CSS** (`.promo` overlay

- button row in `app.css`).

### `src/ui/game/MoveList.tsx` — real history + New Game

- Render `history: string[]` as numbered rows: move number (1-based full move),
  white SAN (`history[2i]`), black SAN (`history[2i+1]` or empty). The last
  played ply's cell carries `.mv.cur`. Empty history → the existing "Make the
  first move" placeholder row.
- Panel header keeps "Offer draw" / "Resign" **disabled**; add a working
  **New Game** button (`onNewGame`).
- Props: `history: string[]`, `onNewGame: () => void`.

### `src/ui/game/HintConsole.tsx` — inert

Add a `disabled?: boolean` prop. When `disabled`: the three level buttons and
the refresh button are `disabled`, and the readout always shows the empty state
(`hint_empty`), regardless of `level`. `GameScreen` passes `disabled` and a
fixed `level={0}`. The component and its tests stay in the repo (real hints
return as an LLM feature in C/D).

### `src/ui/game/PlayerStrip.tsx` — unchanged component, wired by turn

No code change. `GameScreen` passes `active={state.turn === 'w'}` to the bottom
("you"/White) strip and `active={state.turn === 'b'}` to the top
("opponent"/Black) strip. Clocks stay the frozen `"10:00"` string.

### `src/ui/game/GameScreen.tsx` — integration

Owns `useGame()`. Removes the `hintLevel` state and cycle logic. Derives:

- `checkSquare` (as above).
- the status-line text + `.theirs` flag from `state.status` and `state.turn`.

Lays out PlayerStrips (active by turn), Board (interactive), PromotionPicker
(conditional), inert HintConsole, MoveList (real history + New Game). Its public
props are **unchanged** (`opponentName`, `elo`, `boardStyle`, `pieceStyle`), so
`App.tsx` needs no change.

### Status-line text mapping

Reusing `.status` / `.status.theirs` / `.turn-dot`:

- ongoing → `t('turn_w')` / `t('turn_b')`; add `.theirs` when Black to move;
  when `status.isCheck`, append `t('st_check')` ("— check").
- checkmate → `t('st_mate_w')` / `t('st_mate_b')` chosen by the winning side
  (`status.result` is `'white'` / `'black'`).
- draw → `t('st_draw')` with the reason from `status.drawReason`
  (`dr_stalemate` / `dr_fifty` / `dr_threefold` / `dr_material`).

## i18n additions (RU/EN, in `src/ui/app/i18n.tsx`)

| key            | RU                     | EN                     |
| -------------- | ---------------------- | ---------------------- |
| `newgame`      | Новая партия           | New game               |
| `turn_w`       | Ход белых              | White to move          |
| `turn_b`       | Ход чёрных             | Black to move          |
| `st_check`     | шах                    | check                  |
| `st_mate_w`    | Мат — победа белых     | Checkmate — White wins |
| `st_mate_b`    | Мат — победа чёрных    | Checkmate — Black wins |
| `st_draw`      | Ничья                  | Draw                   |
| `dr_stalemate` | пат                    | stalemate              |
| `dr_fifty`     | правило 50 ходов       | fifty-move rule        |
| `dr_threefold` | троекратное повторение | threefold repetition   |
| `dr_material`  | недостаток материала   | insufficient material  |

(Exact composition, e.g. "Ничья — пат", is done in `GameScreen` by concatenating
`st_draw` + reason; the picker/promotion needs no new copy beyond piece glyphs.)

## Testing strategy (Vitest + RTL, jsdom, no network)

- **`useGame`** (behaviour via `renderHook`): selecting a piece populates
  `legalTargets`; clicking a legal target applies the move and flips `turn`;
  clicking an enemy/empty square does not select; a promotion target sets
  `pendingPromotion` without moving, and `choosePromotion` completes it and adds
  the SAN to `state.history`; `newGame` resets; once `state.status.isGameOver`,
  further clicks are ignored. Capture vs quiet `legalTargets.capture` is correct
  (a position with a capture yields `capture: true`).
- **`Board`**: renders 64 `.sq`; the `selected` square has `.sel`; each
  `legalTargets` square has `.legal` and a `.marker.dot` (quiet) or `.marker.ring`
  (capture); both `lastMove` squares have `.last`; the `checkSquare` has `.check`;
  clicking a square calls `onSquareClick` with its name. No `.hint1`/`.arrows`
  anywhere.
- **`PromotionPicker`**: renders four choices; clicking Rook calls
  `onChoose('r')`; pressing Escape calls `onCancel`; renders in the given color.
- **`MoveList`**: a history of several SAN renders numbered pairs with `.mv.cur`
  on the last ply; empty history shows the placeholder; New Game button calls
  `onNewGame`; Offer draw / Resign are disabled.
- **`GameScreen`** (integration): playing `1. e4 e5` by clicking squares updates
  the board (pieces move), the move list (`e4`, `e5`), the status line
  (White→Black to move) and the active player strip; a Fool's-Mate click
  sequence ends with the checkmate status; New Game clears back to the start.
- **`HintConsole`**: with `disabled`, level buttons and refresh are disabled and
  the readout is the empty state.
- Existing engine / llm / onboarding / history tests stay green; `App.tsx`
  untouched.
- **Live browser verification** (the board is now real): play a game by clicking
  — legal highlights, captures (ring), last-move, check, promotion picker,
  checkmate/draw status, New Game — verified in the preview. LM Studio is not
  required (the engine is local); onboarding still routes to the game screen.

## Module boundaries

- `src/ui/game` depends on `src/engine` (rules) and `src/ui/app` (i18n) only —
  the correct direction. `src/engine` is not modified and gains no UI awareness.
- No `src/llm` coupling anywhere in B.
- New CSS is confined to one `.promo` block in `src/styles/app.css`.

## Out of scope (B)

- LLM opponent, chat-completion, real move suggestions (hint panel stays inert)
  — sub-project C.
- Real clocks (frozen), persisting a game across reloads, writing a finished
  game into History — sub-project D.
- Drag-and-drop input, board flip / choosing a color, "Resign" / "Offer draw"
  behaviour, move takeback/undo UI.
