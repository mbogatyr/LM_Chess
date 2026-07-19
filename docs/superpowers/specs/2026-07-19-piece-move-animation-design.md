# Piece move animation (sliding pieces) — design

**Date:** 2026-07-19
**Status:** approved — full track (spec → plan → subagent-driven implementation)

## Problem

When a move is played the board re-renders straight off the new `state.board`
matrix, so pieces **teleport**: the piece vanishes from its source square and
reappears on the destination with no motion. We want the moving piece to
**slide** across the board from its old square to the new one, for both the
human's and the model's moves.

## Decision (scope)

**v1 animates the single primary piece** named by `state.lastMove` (`from` →
`to`). Confirmed during brainstorm:

- The captured piece (if any) **disappears instantly** — no fade.
- Castling animates the **king** slide only; the rook teleports.
- Promotion shows the **promoted** piece already on `to`, sliding in from `from`.
- Both the human's and the model's moves animate identically.

Deliberately out of v1 (possible later refinements): fading captured pieces,
sliding the castling rook, easing the promotion piece-swap.

## Approach — FLIP on the existing transition

`.piece` already carries `transition: transform 0.28s cubic-bezier(0.2,0.8,0.2,1)`
and `will-change: transform` (from drag support), so no CSS changes are needed.
On each new `lastMove`, run the FLIP (First-Last-Invert-Play) on the piece now
rendered on the `to` square:

1. **Measure the cell size** from the live board: `cell = boardEl.clientWidth / 8`.
2. **Invert** — set, with `transition: none`, an initial transform that puts the
   piece back on its `from` square:
   `translate((fromCol − toCol)·cell, (fromRow − toRow)·cell)`.
3. **Force reflow** (`boardEl.getBoundingClientRect()` or reading `offsetWidth`)
   so the browser paints the inverted position without a transition.
4. **Play** — clear the inline `transition` and `transform`; the piece slides
   home via the existing 0.28s CSS transition.

Why pixel offsets from a measured cell (not `%`): `.piece` is `inset: 15%` of
its square, so a `translate` percentage is relative to the piece box (70 % of a
cell), not the cell — measuring `clientWidth/8` is exact and robust to the
board's responsive size (`width: min(48vh, 500px)`).

### Reduced motion

If `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, skip the
animation entirely (the piece stays put on `to` — instant, as today).

### Guards

Animate only when:

- `lastMove` actually **changed** to a new move since the last render (track the
  previous `lastMove` by identity / `from+to+san`), **not** on mount and **not**
  on New Game (where `lastMove` becomes `null`).
- The `to` square currently holds a piece element (defensive).

## Components (one responsibility each)

### `src/ui/game/slideAnimation.ts`

- `moveDelta(from: SquareName, to: SquareName): { dCol: number; dRow: number }`
  — pure; `dCol = toCol − fromCol`, `dRow = toRow − fromRow` via
  `nameToRC`. (Board rows are rank-8-first, so e2→e4 gives `dRow = -2`.) **Unit
  tested.**
- `animateSlide(boardEl: HTMLElement, move: { from; to }): void` — thin
  imperative FLIP runner using `moveDelta` + the measured cell size. Finds the
  mover via `boardEl.querySelector('[data-sq="${to}"] .piece')`; no-ops if the
  element is missing, the board has zero width, or reduced motion is preferred.
  Verified live (imperative DOM/animation, not meaningfully unit-testable in
  jsdom).

### `src/ui/game/usePieceSlide.ts`

`usePieceSlide(boardRef: RefObject<HTMLElement>, lastMove): void` — a
`useLayoutEffect` that fires `animateSlide` once per new `lastMove` (guarded as
above). Runs before paint so the inverted position is never shown as a flash.

### `src/ui/game/Board.tsx`

- Add a `ref` on the `.board` div.
- Call `usePieceSlide(boardRef, lastMove)`.
- No change to the rendered markup or the 64-cell mapping.

### CSS

No changes — the FLIP reuses the existing `.piece` transition.

## Data flow

`useGame` → `GameScreen` passes `state.lastMove` into `Board` (already does).
`Board` renders the new matrix (piece already on `to`) and, in the same commit,
`usePieceSlide` inverts+plays the mover so it visually starts on `from` and
slides to `to`.

## Testing

- **`slideAnimation.test.ts`** — `moveDelta` for representative moves:
  `e2→e4 → {dCol:0,dRow:-2}`, `a1→h1 → {dCol:7,dRow:0}`, `b1→c3 →
{dCol:1,dRow:-2}`, `e1→g1 (castling king) → {dCol:2,dRow:0}`.
- **`Board.test.tsx`** — existing rendering tests stay green; add one asserting
  the board mounts and a `lastMove` change does not throw (jsdom has no layout,
  so `animateSlide` no-ops safely).
- The actual slide (both human and model moves, reduced-motion off) is
  **verified live** in the browser.

## Out of scope

- Capture fade-out, castling-rook slide, promotion swap easing.
- Drag-to-move (separate existing/again-future concern).
- Configurable duration/easing (reuse the existing 0.28s).

## Follow-up docs

After implementation: note piece-move animation as done in `CLAUDE.md`, the
backlog, and memory.
