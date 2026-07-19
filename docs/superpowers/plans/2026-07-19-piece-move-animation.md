# Piece Move Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the moving piece slide from its source square to its destination instead of teleporting, for both the human's and the model's moves.

**Architecture:** A FLIP (First-Last-Invert-Play) applied to the piece already rendered on `lastMove.to`, reusing the existing `.piece` CSS `transition: transform 0.28s`. Pure geometry helpers compute the invert transform from a measured cell size; a `useLayoutEffect` hook fires the FLIP once per new `lastMove`.

**Tech Stack:** React 18 + TypeScript (strict), Vitest + @testing-library/react (jsdom).

## Global Constraints

- Frontend-only; no new dependencies. No CSS changes (reuse the existing `.piece` transition).
- TypeScript strict — no `any` without a justifying comment.
- Prettier: no semicolons, single quotes, trailing commas, 80-col. Run `npm run format` before committing; CI also checks Markdown.
- Tests live next to source (`*.test.ts[x]`), Vitest `globals: true`, jsdom.
- Local quality gate (mirrors CI), run before finishing: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`. `typecheck` is `tsc -b` (not `--noEmit`).
- Conventional commits; end commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Spec: `docs/superpowers/specs/2026-07-19-piece-move-animation-design.md`.

---

### Task 1: Pure geometry helpers (`moveDelta`, `invertTransform`)

**Files:**

- Create: `src/ui/game/slideAnimation.ts`
- Test: `src/ui/game/slideAnimation.test.ts`

**Interfaces:**

- Consumes: `nameToRC` from `src/ui/game/chessDemo.ts` (`(name: string) => [number, number]`, row = `8 - rank` so rank-8 is row 0; col = file index a→0), `SquareName` from `src/engine/types`.
- Produces:
  - `moveDelta(from: SquareName, to: SquareName): { dCol: number; dRow: number }` — `dCol = toCol - fromCol`, `dRow = toRow - fromRow`.
  - `invertTransform(from: SquareName, to: SquareName, cell: number): string` — the CSS transform that places the mover back on its `from` square: `translate(${-dCol*cell}px, ${-dRow*cell}px)`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/slideAnimation.test.ts`:

```ts
import { expect, test } from 'vitest'
import { moveDelta, invertTransform } from './slideAnimation'

test('moveDelta counts columns and rank-8-first rows (to - from)', () => {
  expect(moveDelta('e2', 'e4')).toEqual({ dCol: 0, dRow: -2 })
  expect(moveDelta('a1', 'h1')).toEqual({ dCol: 7, dRow: 0 })
  expect(moveDelta('b1', 'c3')).toEqual({ dCol: 1, dRow: -2 })
  expect(moveDelta('e1', 'g1')).toEqual({ dCol: 2, dRow: 0 }) // castling king
})

test('invertTransform offsets the mover back onto its from square', () => {
  // e2→e4: dRow -2, so the invert pushes it +2 cells down (back to e2).
  expect(invertTransform('e2', 'e4', 80)).toBe('translate(0px, 160px)')
  // a1→h1: dCol +7, invert pushes it 7 cells left.
  expect(invertTransform('a1', 'h1', 80)).toBe('translate(-560px, 0px)')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/slideAnimation.test.ts`
Expected: FAIL — `slideAnimation.ts` does not exist / exports not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/game/slideAnimation.ts`:

```ts
import type { SquareName } from '../../engine/types'
import { nameToRC } from './chessDemo'

// Delta from `from` to `to` in board columns/rows. Board rows are rank-8-first,
// so a White pawn e2→e4 moves "up" two rows → dRow = -2.
export function moveDelta(
  from: SquareName,
  to: SquareName,
): { dCol: number; dRow: number } {
  const [fromR, fromC] = nameToRC(from)
  const [toR, toC] = nameToRC(to)
  return { dCol: toC - fromC, dRow: toR - fromR }
}

// The CSS transform that visually places the mover back on its `from` square,
// given the pixel size of one board cell.
export function invertTransform(
  from: SquareName,
  to: SquareName,
  cell: number,
): string {
  const { dCol, dRow } = moveDelta(from, to)
  return `translate(${-dCol * cell}px, ${-dRow * cell}px)`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/game/slideAnimation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/slideAnimation.ts src/ui/game/slideAnimation.test.ts
git commit -m "feat: pure geometry helpers for piece slide (moveDelta, invertTransform)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: FLIP runner (`animateSlide`)

**Files:**

- Modify: `src/ui/game/slideAnimation.ts`
- Test: `src/ui/game/slideAnimation.test.ts`

**Interfaces:**

- Consumes: `invertTransform` (Task 1).
- Produces: `animateSlide(boardEl: HTMLElement, move: { from: SquareName; to: SquareName }): void` — measures the cell size (`boardEl.clientWidth / 8`), finds the mover via `boardEl.querySelector('[data-sq="${to}"] .piece')`, applies the invert transform without a transition, forces a reflow, then clears the inline transform/transition so the existing CSS transition plays. No-ops when reduced motion is preferred, the board has zero width, or the mover is missing.

- [ ] **Step 1: Write the failing test**

Append to `src/ui/game/slideAnimation.test.ts`:

```ts
import { animateSlide } from './slideAnimation'

function boardWith(toSquare: string, width: number): HTMLElement {
  const board = document.createElement('div')
  board.innerHTML = `<div data-sq="${toSquare}"><span class="piece"></span></div>`
  Object.defineProperty(board, 'clientWidth', {
    value: width,
    configurable: true,
  })
  return board
}

test('animateSlide no-ops safely when the board has no size', () => {
  const board = boardWith('e4', 0)
  const piece = board.querySelector('.piece') as HTMLElement
  expect(() => animateSlide(board, { from: 'e2', to: 'e4' })).not.toThrow()
  expect(piece.style.transform).toBe('') // untouched
})

test('animateSlide no-ops when the mover is missing', () => {
  const board = boardWith('e4', 640)
  expect(() => animateSlide(board, { from: 'd2', to: 'd4' })).not.toThrow()
})

test('animateSlide touches the mover then clears it (FLIP leaves no inline transform)', () => {
  const board = boardWith('e4', 640)
  const piece = board.querySelector('.piece') as HTMLElement
  const seen: string[] = []
  // Record every transform the FLIP assigns during the call.
  let current = ''
  Object.defineProperty(piece.style, 'transform', {
    get: () => current,
    set: (v: string) => {
      current = v
      seen.push(v)
    },
    configurable: true,
  })
  animateSlide(board, { from: 'e2', to: 'e4' })
  // Inverted first (cell = 640/8 = 80, dRow -2 → +160px), then cleared.
  expect(seen).toContain('translate(0px, 160px)')
  expect(seen[seen.length - 1]).toBe('')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/slideAnimation.test.ts`
Expected: FAIL — `animateSlide` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ui/game/slideAnimation.ts`:

```ts
// FLIP the piece now on `move.to` so it visually starts on `move.from` and
// slides home via the existing `.piece` CSS transition. Imperative and
// verified live; guarded to a safe no-op in the untestable cases.
export function animateSlide(
  boardEl: HTMLElement,
  move: { from: SquareName; to: SquareName },
): void {
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) return

  const cell = boardEl.clientWidth / 8
  if (!cell) return

  const mover = boardEl.querySelector<HTMLElement>(
    `[data-sq="${move.to}"] .piece`,
  )
  if (!mover) return

  // Invert: jump the mover back onto its `from` square, with no transition.
  mover.style.transition = 'none'
  mover.style.transform = invertTransform(move.from, move.to, cell)
  // Commit the inverted position so it becomes the transition's start value.
  void mover.offsetWidth
  // Play: restore the CSS transition + home position; the browser slides it.
  mover.style.transition = ''
  mover.style.transform = ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/game/slideAnimation.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/slideAnimation.ts src/ui/game/slideAnimation.test.ts
git commit -m "feat: animateSlide FLIP runner for piece moves

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `usePieceSlide` hook + wire into `Board`

**Files:**

- Create: `src/ui/game/usePieceSlide.ts`
- Modify: `src/ui/game/Board.tsx`
- Modify: `src/ui/game/GameScreen.tsx:117-121`
- Test: `src/ui/game/Board.test.tsx:51` (update the `lastMove` prop), plus a new no-throw test.

**Interfaces:**

- Consumes: `animateSlide` (Task 2); the engine `lastMove` shape `{ from: SquareName; to: SquareName; san: string } | null`.
- Produces: `usePieceSlide(boardRef: RefObject<HTMLElement | null>, lastMove: { from: SquareName; to: SquareName; san: string } | null): void` — a `useLayoutEffect` that calls `animateSlide` once per **new** `lastMove` object (keyed on object identity), never on the first render.

Key correctness note: `GameScreen` must pass `state.lastMove` **directly** (a stable reference that only changes when a move is played) rather than building a fresh `{ from, to }` object each render — otherwise the identity key would fire on every re-render (e.g. clock ticks).

- [ ] **Step 1: Write the failing test**

`src/ui/game/Board.test.tsx` already spreads a shared `base` props object and passes `board={newGame().board}` per test. Append this no-throw test (keep existing tests):

```ts
test('a lastMove change does not throw (slide animation wiring)', () => {
  const { rerender } = render(
    <Board {...base} board={newGame().board} lastMove={null} />,
  )
  expect(() =>
    rerender(
      <Board
        {...base}
        board={newGame().board}
        lastMove={{ from: 'e2', to: 'e4', san: 'e4' }}
      />,
    ),
  ).not.toThrow()
})
```

Also, in the existing test **"highlights last move squares and the checked king"**, update its `lastMove` prop to include `san` (the widened type requires it):

```tsx
      lastMove={{ from: 'e2', to: 'e4', san: 'e4' }}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/Board.test.tsx`
Expected: FAIL — TypeScript/prop error: `lastMove` does not accept `san` yet (its type is `{ from; to } | null`).

- [ ] **Step 3: Create the hook**

Create `src/ui/game/usePieceSlide.ts`:

```ts
import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { SquareName } from '../../engine/types'
import { animateSlide } from './slideAnimation'

type LastMove = { from: SquareName; to: SquareName; san: string } | null

// Slide the piece that just moved. Fires once per new `lastMove` object
// (identity-keyed, so re-renders such as clock ticks don't re-trigger it) and
// never on the first render.
export function usePieceSlide(
  boardRef: RefObject<HTMLElement | null>,
  lastMove: LastMove,
): void {
  const prev = useRef<LastMove>(null)
  const mounted = useRef(false)

  useLayoutEffect(() => {
    if (
      mounted.current &&
      lastMove &&
      lastMove !== prev.current &&
      boardRef.current
    ) {
      animateSlide(boardRef.current, lastMove)
    }
    mounted.current = true
    prev.current = lastMove
  }, [lastMove, boardRef])
}
```

- [ ] **Step 4: Widen `Board`'s `lastMove` type, add the ref + hook**

In `src/ui/game/Board.tsx`:

Change the import line to include `useRef`:

```ts
import { useRef } from 'react'
```

Change the `lastMove` prop type (in the props type block) from:

```ts
  lastMove: { from: SquareName; to: SquareName } | null
```

to:

```ts
  lastMove: { from: SquareName; to: SquareName; san: string } | null
```

Inside the component body, before the `return`, add:

```ts
const boardRef = useRef<HTMLDivElement>(null)
usePieceSlide(boardRef, lastMove)
```

And attach the ref to the board grid div — change:

```tsx
      <div className={`board board--${boardStyle}`}>
```

to:

```tsx
      <div className={`board board--${boardStyle}`} ref={boardRef}>
```

Add the hook import near the top:

```ts
import { usePieceSlide } from './usePieceSlide'
```

- [ ] **Step 5: Pass the stable `lastMove` object from `GameScreen`**

In `src/ui/game/GameScreen.tsx`, replace the `lastMove` prop (currently building a fresh object each render):

```tsx
            lastMove={
              state.lastMove
                ? { from: state.lastMove.from, to: state.lastMove.to }
                : null
            }
```

with the engine object passed directly:

```tsx
            lastMove={state.lastMove}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/ui/game/Board.test.tsx`
Expected: PASS — the new no-throw test and all existing `Board` tests.

- [ ] **Step 7: Full local quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green. If `format:check` complains, run `npm run format` and re-run.

- [ ] **Step 8: Commit**

```bash
git add src/ui/game/usePieceSlide.ts src/ui/game/Board.tsx src/ui/game/GameScreen.tsx src/ui/game/Board.test.tsx
git commit -m "feat: slide pieces on move (usePieceSlide wired into Board)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Live verification

**Files:** none (verification only).

- [ ] **Step 1: Run the dev server and play a move**

Start the dev server (via the preview tooling / `npm run dev`), connect to LM Studio, load a model, start a game, and play `e2→e4`.

- [ ] **Step 2: Confirm the human's piece slides**

Observe the White pawn **slide** from e2 to e4 (not teleport). Confirm via the browser (screenshot or reading the mover's transient inline `transform` during the ~0.28s window).

- [ ] **Step 3: Confirm the model's piece slides**

Wait for the model's reply and confirm its piece slides from its source to destination square too.

- [ ] **Step 4: Confirm New Game does not animate**

Click **New Game** and confirm the pieces reset instantly with no slide (guarded by `lastMove === null`).

- [ ] **Step 5 (optional): Confirm reduced motion**

With `prefers-reduced-motion: reduce` emulated, confirm moves are instant (no slide).

---

## Self-Review

**Spec coverage:**

- FLIP mechanism (measure cell, invert, reflow, play) → Task 2 `animateSlide`. ✓
- Pixel offsets from measured cell (not %) → Task 1 `invertTransform` + Task 2. ✓
- Reduced-motion skip → Task 2 guard. ✓
- Guards (only on new `lastMove`, not on mount, mover present) → Task 3 hook (identity key + `mounted` guard) + Task 2 (mover-present). ✓
- Both human and model moves animate → same `lastMove` path drives both (Task 3 + Task 4 verification). ✓
- No CSS changes → confirmed; no task touches CSS. ✓
- Testing: `moveDelta`/`invertTransform` unit-tested (Task 1), `animateSlide` guard-tested (Task 2), `Board` no-throw (Task 3), live slide (Task 4). ✓

**Placeholder scan:** none — every code step shows complete code.

**Type consistency:** `moveDelta` → `{ dCol, dRow }` used by `invertTransform` (Task 1) and referenced in Task 2; `animateSlide(boardEl, { from, to })` produced in Task 2, consumed in Task 3's hook; `usePieceSlide(boardRef, lastMove)` signature matches the `Board` wiring; the widened `lastMove` type `{ from; to; san } | null` is consistent across `Board`, `usePieceSlide`, and the `GameScreen` pass-through (`state.lastMove`).
