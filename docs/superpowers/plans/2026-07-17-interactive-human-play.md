# Interactive Human Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ui/game` actually playable in hotseat mode — click-to-move driven by the `src/engine` chess.js wrapper, with real legal-move highlighting, move list, turn/result status, check + last-move, a promotion picker, an inert hint panel, and New Game.

**Architecture:** A new `useGame` hook is the single owner of game state (a thin React wrapper over the immutable engine). `GameScreen` owns `useGame()`, derives a small view-model, and passes explicit props to presentational components (`Board`, `PromotionPicker`, `MoveList`, `HintConsole`, `PlayerStrip`). One-way data flow; `src/engine` is untouched; `App.tsx` is unchanged.

**Tech Stack:** React 18 + TypeScript 5 (strict), Vitest + @testing-library/react + user-event, existing Nocturne CSS.

## Global Constraints

- **`src/ui/game` depends on `src/engine` (rules) and `src/ui/app` (i18n) only** — no `src/llm` coupling; `src/engine` is not modified. (spec: "Module boundaries")
- **Hotseat, click-to-move only.** No drag input, no board flip, no color choice. (spec: "Decisions")
- **New CSS is confined to one `.promo` block** in `src/styles/app.css`; everything else reuses existing classes (`.sq.sel/.last/.check/.legal`, `.marker.dot/.ring`, `.status/.status.theirs/.turn-dot`, `.moves .mv.cur`). (spec: "Existing assets this reuses")
- **No game persistence** — `useGame` is in-memory; a fresh game on mount, `newGame()` resets. (spec: "useGame")
- **Capture marker rule:** a legal target is a capture (`ring`) iff its SAN includes `'x'`, else quiet (`dot`). (spec: "useGame")
- **"Offer draw" / "Resign" stay disabled**; only "New Game" is wired. (spec: "MoveList")
- **Prettier: no semicolons, single quotes, trailing commas, 80-col.** Run `npm run format` before every commit. (CLAUDE.md)
- **TypeScript strict; no `any` without a justifying comment.** (CLAUDE.md)
- **`npm run typecheck` is `tsc -b`** — do not change it. (CLAUDE.md)
- **i18n copy is bilingual RU/EN**, added to `STRINGS` in `src/ui/app/i18n.tsx` (both `ru` and `en`). The `newgame` key already exists. (spec: "i18n additions")

---

### Task 1: `useGame` hook — the single owner of game state

**Files:**

- Create: `src/ui/game/useGame.ts`
- Test: `src/ui/game/useGame.test.ts`

**Interfaces:**

- Consumes: `src/engine/game` (`newGame`, `move`, `legalMoves`), `src/engine/types` (`GameState`, `SquareName`, `PromotionPiece`, `Square`), and `nameToRC` from `./chessDemo`.
- Produces (used by Tasks 2, 3, 7):
  - `type LegalTarget = { to: SquareName; capture: boolean }`
  - `type PendingPromotion = { from: SquareName; to: SquareName } | null`
  - `type UseGame = { state: GameState; selected: SquareName | null; legalTargets: LegalTarget[]; pendingPromotion: PendingPromotion; onSquareClick: (sq: SquareName) => void; choosePromotion: (p: PromotionPiece) => void; cancelPromotion: () => void; newGame: () => void }`
  - `function useGame(): UseGame`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/game/useGame.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useGame } from './useGame'

test('selecting a pawn lists its legal targets', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBe('e2')
  const dests = result.current.legalTargets.map((t) => t.to).sort()
  expect(dests).toEqual(['e3', 'e4'])
  expect(result.current.legalTargets.every((t) => t.capture === false)).toBe(
    true,
  )
})

test('clicking a legal target plays the move and flips the turn', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  expect(result.current.state.turn).toBe('b')
  expect(result.current.state.history).toEqual(['e4'])
  expect(result.current.selected).toBeNull()
})

test('clicking an enemy piece does not select it', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e7')) // black pawn, white to move
  expect(result.current.selected).toBeNull()
  expect(result.current.legalTargets).toEqual([])
})

test('a capture target is flagged capture:true', () => {
  const { result } = renderHook(() => useGame())
  // 1. e4 d5 -> white e4 pawn can capture d5
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  act(() => result.current.onSquareClick('d7'))
  act(() => result.current.onSquareClick('d5'))
  act(() => result.current.onSquareClick('e4'))
  const cap = result.current.legalTargets.find((t) => t.to === 'd5')
  expect(cap?.capture).toBe(true)
})

test('newGame resets state, selection and pending promotion', () => {
  const { result } = renderHook(() => useGame())
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  act(() => result.current.newGame())
  expect(result.current.state.history).toEqual([])
  expect(result.current.selected).toBeNull()
  expect(result.current.pendingPromotion).toBeNull()
})

test('choosePromotion is a no-op when nothing is pending', () => {
  const { result } = renderHook(() => useGame())
  expect(result.current.pendingPromotion).toBeNull()
  act(() => result.current.choosePromotion('q'))
  expect(result.current.state.history).toEqual([])
})
```

Coverage note: `useGame()` starts from the standard position, so a pawn
promotion is many plies away and is not unit-tested at the hook level here. The
promotion path is covered where it is reachable and observable: the picker UI in
Task 3's `PromotionPicker` test, and the full pawn→picker→promote flow in Task
8's live browser verification. The hook's promotion-detection branch
(`toSq.some((m) => m.promotion)`) is a two-line guard over the engine's own
promotion moves; the test above pins its defensive no-op contract.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/game/useGame.test.ts`
Expected: FAIL — `useGame` is not exported from `./useGame`.

- [ ] **Step 3: Implement `src/ui/game/useGame.ts`**

```ts
import { useCallback, useMemo, useState } from 'react'
import { legalMoves, move, newGame as engineNewGame } from '../../engine/game'
import type { GameState, PromotionPiece, SquareName } from '../../engine/types'
import { nameToRC } from './chessDemo'

export type LegalTarget = { to: SquareName; capture: boolean }
export type PendingPromotion = { from: SquareName; to: SquareName } | null

export type UseGame = {
  state: GameState
  selected: SquareName | null
  legalTargets: LegalTarget[]
  pendingPromotion: PendingPromotion
  onSquareClick: (sq: SquareName) => void
  choosePromotion: (p: PromotionPiece) => void
  cancelPromotion: () => void
  newGame: () => void
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState>(() => engineNewGame())
  const [selected, setSelected] = useState<SquareName | null>(null)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion>(null)

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selected) return []
    return legalMoves(state, selected).map((m) => ({
      to: m.to,
      capture: m.san.includes('x'),
    }))
  }, [state, selected])

  const onSquareClick = useCallback(
    (sq: SquareName) => {
      if (state.status.isGameOver) return
      if (selected) {
        const toSq = legalMoves(state, selected).filter((m) => m.to === sq)
        if (toSq.length > 0) {
          if (toSq.some((m) => m.promotion)) {
            setPendingPromotion({ from: selected, to: sq })
            return
          }
          const next = move(state, { from: selected, to: sq })
          if (next) {
            setState(next)
            setSelected(null)
          }
          return
        }
      }
      const [r, c] = nameToRC(sq)
      const piece = state.board[r][c]
      setSelected(piece && piece.color === state.turn ? sq : null)
    },
    [state, selected],
  )

  const choosePromotion = useCallback(
    (p: PromotionPiece) => {
      if (!pendingPromotion) return
      const next = move(state, {
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: p,
      })
      if (next) setState(next)
      setPendingPromotion(null)
      setSelected(null)
    },
    [state, pendingPromotion],
  )

  const cancelPromotion = useCallback(() => setPendingPromotion(null), [])

  const newGame = useCallback(() => {
    setState(engineNewGame())
    setSelected(null)
    setPendingPromotion(null)
  }, [])

  return {
    state,
    selected,
    legalTargets,
    pendingPromotion,
    onSquareClick,
    choosePromotion,
    cancelPromotion,
    newGame,
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/game/useGame.test.ts`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/useGame.ts src/ui/game/useGame.test.ts
git commit -m "feat(game): useGame hook — hotseat state over the engine"
```

---

### Task 2: `Board` — refactor to interactive presentational

**Files:**

- Modify: `src/ui/game/Board.tsx` (full rewrite)
- Test: `src/ui/game/Board.test.tsx` (full rewrite)

**Interfaces:**

- Consumes: `LegalTarget` from `./useGame`; `Square`, `SquareName` from `../../engine/types`; `BoardStyle`, `PieceStyle` from `../app/appState`; `sqName`, `FILES` from `./chessDemo`; `Piece` from `./Piece`.
- Produces (used by Task 7): `Board` component with props
  `{ board: Square[][]; selected: SquareName | null; legalTargets: LegalTarget[]; lastMove: { from: SquareName; to: SquareName } | null; checkSquare: SquareName | null; onSquareClick: (sq: SquareName) => void; boardStyle: BoardStyle; pieceStyle: PieceStyle }`.

- [ ] **Step 1: Rewrite the test `src/ui/game/Board.test.tsx`**

```tsx
import { render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Board } from './Board'
import { newGame } from '../../engine/game'

const base = {
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
  selected: null,
  legalTargets: [],
  lastMove: null,
  checkSquare: null,
  onSquareClick: () => {},
}

test('renders 64 squares, 32 pieces and coord labels, no hint classes', () => {
  const { container } = render(<Board {...base} board={newGame().board} />)
  expect(container.querySelectorAll('.sq')).toHaveLength(64)
  expect(container.querySelectorAll('.piece')).toHaveLength(32)
  expect(container.querySelectorAll('.coord.rank')).toHaveLength(8)
  expect(container.querySelectorAll('.coord.file')).toHaveLength(8)
  expect(container.querySelector('.sq.hint1')).toBeNull()
  expect(container.querySelector('.arrows')).toBeNull()
})

test('marks the selected square and its legal targets (dot/ring)', () => {
  const { container } = render(
    <Board
      {...base}
      board={newGame().board}
      selected="e2"
      legalTargets={[
        { to: 'e3', capture: false },
        { to: 'd3', capture: true },
      ]}
    />,
  )
  expect(container.querySelector('.sq.sel')!.getAttribute('data-sq')).toBe('e2')
  const e3 = container.querySelector('[data-sq="e3"]')!
  const d3 = container.querySelector('[data-sq="d3"]')!
  expect(e3.classList.contains('legal')).toBe(true)
  expect(e3.querySelector('.marker.dot')).not.toBeNull()
  expect(d3.querySelector('.marker.ring')).not.toBeNull()
})

test('highlights last move squares and the checked king', () => {
  const { container } = render(
    <Board
      {...base}
      board={newGame().board}
      lastMove={{ from: 'e2', to: 'e4' }}
      checkSquare="e1"
    />,
  )
  expect(
    [...container.querySelectorAll('.sq.last')]
      .map((s) => s.getAttribute('data-sq'))
      .sort(),
  ).toEqual(['e2', 'e4'])
  expect(container.querySelector('.sq.check')!.getAttribute('data-sq')).toBe(
    'e1',
  )
})

test('clicking a square calls onSquareClick with its name', async () => {
  const onSquareClick = vi.fn()
  const { container } = render(
    <Board {...base} board={newGame().board} onSquareClick={onSquareClick} />,
  )
  ;(container.querySelector('[data-sq="e2"]') as HTMLElement).click()
  expect(onSquareClick).toHaveBeenCalledWith('e2')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/game/Board.test.tsx`
Expected: FAIL — the current `Board` props (`hintLevel`) don't match; new props/classes absent.

- [ ] **Step 3: Rewrite `src/ui/game/Board.tsx`**

```tsx
import type { Square, SquareName } from '../../engine/types'
import type { BoardStyle, PieceStyle } from '../app/appState'
import type { LegalTarget } from './useGame'
import { sqName, FILES } from './chessDemo'
import { Piece } from './Piece'

export function Board({
  board,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  onSquareClick,
  boardStyle,
  pieceStyle,
}: {
  board: Square[][]
  selected: SquareName | null
  legalTargets: LegalTarget[]
  lastMove: { from: SquareName; to: SquareName } | null
  checkSquare: SquareName | null
  onSquareClick: (sq: SquareName) => void
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
}) {
  return (
    <div className={`board-wrap pieces--${pieceStyle}`}>
      <div className={`board board--${boardStyle}`}>
        {board.flatMap((row, r) =>
          row.map((piece, c) => {
            const name = sqName(r, c)
            const light = (r + c) % 2 === 0
            const target = legalTargets.find((t) => t.to === name)
            const classes = ['sq', light ? 'light' : 'dark']
            if (name === selected) classes.push('sel')
            if (lastMove && (name === lastMove.from || name === lastMove.to))
              classes.push('last')
            if (name === checkSquare) classes.push('check')
            if (target) classes.push('legal')
            return (
              <div
                key={name}
                className={classes.join(' ')}
                data-sq={name}
                onClick={() => onSquareClick(name)}
              >
                {c === 0 && <span className="coord rank">{8 - r}</span>}
                {r === 7 && <span className="coord file">{FILES[c]}</span>}
                {target && (
                  <span
                    className={`marker ${target.capture ? 'ring' : 'dot'}`}
                  />
                )}
                {piece && <Piece color={piece.color} type={piece.type} />}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/game/Board.test.tsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/Board.tsx src/ui/game/Board.test.tsx
git commit -m "feat(game): interactive Board — selection, legal markers, last, check"
```

---

### Task 3: `PromotionPicker` component + `.promo` CSS

**Files:**

- Create: `src/ui/game/PromotionPicker.tsx`
- Modify: `src/styles/app.css` (append `.promo` block)
- Test: `src/ui/game/PromotionPicker.test.tsx`

**Interfaces:**

- Consumes: `Color`, `PromotionPiece` from `../../engine/types`; `Piece` from `./Piece`.
- Produces (used by Task 7): `PromotionPicker` with props
  `{ color: Color; onChoose: (p: PromotionPiece) => void; onCancel: () => void }`.

- [ ] **Step 1: Write the failing test `src/ui/game/PromotionPicker.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PromotionPicker } from './PromotionPicker'

test('renders four promotion choices in the given color', () => {
  const { container } = render(
    <PromotionPicker color="w" onChoose={() => {}} onCancel={() => {}} />,
  )
  expect(container.querySelectorAll('.promo-btn')).toHaveLength(4)
  expect(container.querySelectorAll('.piece.w')).toHaveLength(4)
})

test('clicking a choice calls onChoose with its piece letter', async () => {
  const onChoose = vi.fn()
  render(<PromotionPicker color="w" onChoose={onChoose} onCancel={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'r' }))
  expect(onChoose).toHaveBeenCalledWith('r')
})

test('Escape cancels', async () => {
  const onCancel = vi.fn()
  render(<PromotionPicker color="b" onChoose={() => {}} onCancel={onCancel} />)
  await userEvent.keyboard('{Escape}')
  expect(onCancel).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/game/PromotionPicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/game/PromotionPicker.tsx`**

```tsx
import { useEffect } from 'react'
import type { Color, PromotionPiece } from '../../engine/types'
import { Piece } from './Piece'

const CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n']

export function PromotionPicker({
  color,
  onChoose,
  onCancel,
}: {
  color: Color
  onChoose: (p: PromotionPiece) => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="promo" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="promo-row" onClick={(e) => e.stopPropagation()}>
        {CHOICES.map((p) => (
          <button
            key={p}
            type="button"
            className="promo-btn"
            aria-label={p}
            onClick={() => onChoose(p)}
          >
            <Piece color={color} type={p} />
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Append the `.promo` CSS block to `src/styles/app.css`**

Add at the end of the file:

```css
/* promotion picker (overlays the board; parent is position: relative) */
.promo {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-bg) 68%, transparent);
  border-radius: var(--radius-md);
}
.promo-row {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.promo-btn {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  background: var(--color-bg);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-sm);
  color: inherit;
  cursor: pointer;
}
.promo-btn .piece {
  width: 78%;
  height: 78%;
}
.promo-btn:hover {
  border-color: var(--color-accent);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/ui/game/PromotionPicker.test.tsx`
Expected: PASS. (CSS is not asserted in jsdom; visual sizing is confirmed at live verification in Task 8.)

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/ui/game/PromotionPicker.tsx src/ui/game/PromotionPicker.test.tsx src/styles/app.css
git commit -m "feat(game): promotion picker + .promo overlay styles"
```

---

### Task 4: `MoveList` — real SAN history + New Game

**Files:**

- Modify: `src/ui/game/MoveList.tsx` (full rewrite)
- Test: `src/ui/game/MoveList.test.tsx` (rewrite)

**Interfaces:**

- Consumes: `useI18n` from `../app/i18n` (keys `moves_h`, `newgame`, `offerdraw`, `resign` — all already exist).
- Produces (used by Task 7): `MoveList` with props `{ history: string[]; onNewGame: () => void }`.

- [ ] **Step 1: Rewrite the test `src/ui/game/MoveList.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MoveList } from './MoveList'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>

test('empty history shows the placeholder', () => {
  render(wrap(<MoveList history={[]} onNewGame={() => {}} />))
  expect(screen.getByText('Сделайте первый ход')).toBeInTheDocument()
})

test('renders numbered SAN pairs with .cur on the last ply', () => {
  const { container } = render(
    wrap(<MoveList history={['e4', 'e5', 'Nf3']} onNewGame={() => {}} />),
  )
  expect(screen.getByText('e4')).toBeInTheDocument()
  expect(screen.getByText('e5')).toBeInTheDocument()
  const cur = container.querySelectorAll('.mv.cur')
  expect(cur).toHaveLength(1)
  expect(cur[0].textContent).toBe('Nf3')
})

test('New Game is enabled and calls onNewGame; draw/resign disabled', async () => {
  const onNewGame = vi.fn()
  render(wrap(<MoveList history={['e4']} onNewGame={onNewGame} />))
  await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
  expect(onNewGame).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Ничья' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Сдаться' })).toBeDisabled()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/game/MoveList.test.tsx`
Expected: FAIL — `MoveList` takes no props today; New Game button absent.

- [ ] **Step 3: Rewrite `src/ui/game/MoveList.tsx`**

```tsx
import { useI18n } from '../app/i18n'

export function MoveList({
  history,
  onNewGame,
}: {
  history: string[]
  onNewGame: () => void
}) {
  const { t, lang } = useI18n()
  const empty = lang === 'ru' ? 'Сделайте первый ход' : 'Make the first move'
  const lastPly = history.length - 1
  const rows = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, wi: i, bi: i + 1 })
  }
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="phead">
        <h6>{t('moves_h')}</h6>
        <button type="button" className="btn btn-ghost" onClick={onNewGame}>
          {t('newgame')}
        </button>
        <button type="button" className="btn btn-ghost" disabled>
          {t('offerdraw')}
        </button>
        <button type="button" className="btn btn-secondary" disabled>
          {t('resign')}
        </button>
      </div>
      <div className="moves">
        <table>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="n">–</td>
                <td className="mv" colSpan={2} style={{ opacity: 0.5 }}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.n}>
                  <td className="n">{row.n}</td>
                  <td className={'mv' + (row.wi === lastPly ? ' cur' : '')}>
                    {history[row.wi]}
                  </td>
                  <td className={'mv' + (row.bi === lastPly ? ' cur' : '')}>
                    {history[row.bi] ?? ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/game/MoveList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/MoveList.tsx src/ui/game/MoveList.test.tsx
git commit -m "feat(game): MoveList renders real SAN history + New Game"
```

---

### Task 5: `HintConsole` — inert (`disabled`) mode

**Files:**

- Modify: `src/ui/game/HintConsole.tsx`
- Test: `src/ui/game/HintConsole.test.tsx` (append one test)

**Interfaces:**

- Produces (used by Task 7): `HintConsole` gains an optional `disabled?: boolean` prop. When `disabled`, the three level buttons and the refresh button are `disabled`, and the readout always shows the empty state.

- [ ] **Step 1: Append a failing test to `src/ui/game/HintConsole.test.tsx`**

```tsx
test('disabled: level buttons and refresh are disabled, readout is empty', () => {
  render(
    wrap(
      <HintConsole
        level={0}
        onSelect={() => {}}
        onRefresh={() => {}}
        disabled
      />,
    ),
  )
  screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled())
  expect(
    screen.getByText('Застряли? Выберите уровень подсказки.'),
  ).toBeInTheDocument()
})
```

(If the existing test file lacks the `wrap`/`render`/`screen` imports and `I18nProvider`, mirror the setup already present in the file — do not duplicate a second `wrap` if one exists.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/game/HintConsole.test.tsx`
Expected: FAIL — `disabled` prop has no effect; buttons are enabled.

- [ ] **Step 3: Add the `disabled` prop to `src/ui/game/HintConsole.tsx`**

Change the signature and the three interactive elements. New signature:

```tsx
export function HintConsole({
  level,
  onSelect,
  onRefresh,
  disabled,
}: {
  level: HintLevel
  onSelect: (lv: HintLevel) => void
  onRefresh: () => void
  disabled?: boolean
}) {
```

On the refresh `<button>` add `disabled={disabled}`. On each level `<button>` in the `.map` add `disabled={disabled}`. Change the readout condition from `level === 0 ?` to `level === 0 || disabled ?` so the empty readout shows whenever disabled.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/game/HintConsole.test.tsx`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/HintConsole.tsx src/ui/game/HintConsole.test.tsx
git commit -m "feat(game): HintConsole inert (disabled) mode"
```

---

### Task 6: i18n keys for status / result

**Files:**

- Modify: `src/ui/app/i18n.tsx` (add keys to both `ru` and `en` in `STRINGS`)

**Interfaces:**

- Produces (used by Task 7): new `TKey`s `turn_w`, `turn_b`, `st_check`, `st_mate_w`, `st_mate_b`, `st_draw`, `dr_stalemate`, `dr_fifty`, `dr_threefold`, `dr_material`.

- [ ] **Step 1: Add a failing test to `src/ui/app/i18n.test.tsx`**

Append:

```tsx
test('has the game status/result keys in both languages', () => {
  const keys = [
    'turn_w',
    'turn_b',
    'st_check',
    'st_mate_w',
    'st_mate_b',
    'st_draw',
    'dr_stalemate',
    'dr_fifty',
    'dr_threefold',
    'dr_material',
  ] as const
  keys.forEach((k) => {
    expect(STRINGS.ru[k]).toBeTruthy()
    expect(STRINGS.en[k]).toBeTruthy()
  })
})
```

(Ensure `STRINGS` is imported in the test file; add it to the existing import from `./i18n` if absent.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/app/i18n.test.tsx`
Expected: FAIL — keys missing (also a TS error until Step 3 lands; that is the failing state).

- [ ] **Step 3: Add the keys**

In `src/ui/app/i18n.tsx`, inside `STRINGS.ru`, after the existing `newgame: 'Новая партия',` line in the `// game` block, add:

```ts
    turn_w: 'Ход белых',
    turn_b: 'Ход чёрных',
    st_check: 'шах',
    st_mate_w: 'Мат — победа белых',
    st_mate_b: 'Мат — победа чёрных',
    st_draw: 'Ничья',
    dr_stalemate: 'пат',
    dr_fifty: 'правило 50 ходов',
    dr_threefold: 'троекратное повторение',
    dr_material: 'недостаток материала',
```

Inside `STRINGS.en`, after its `newgame: 'New game',` line, add:

```ts
    turn_w: 'White to move',
    turn_b: 'Black to move',
    st_check: 'check',
    st_mate_w: 'Checkmate — White wins',
    st_mate_b: 'Checkmate — Black wins',
    st_draw: 'Draw',
    dr_stalemate: 'stalemate',
    dr_fifty: 'fifty-move rule',
    dr_threefold: 'threefold repetition',
    dr_material: 'insufficient material',
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/app/i18n.test.tsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/app/i18n.tsx src/ui/app/i18n.test.tsx
git commit -m "feat(i18n): game status/result keys (turn/check/mate/draw)"
```

---

### Task 7: `GameScreen` — integration

**Files:**

- Modify: `src/ui/game/GameScreen.tsx` (rewrite the body; keep the public props)
- Test: `src/ui/game/GameScreen.test.tsx` (full rewrite)

**Interfaces:**

- Consumes: `useGame` (Task 1), `Board` (Task 2), `PromotionPicker` (Task 3), `MoveList` (Task 4), `HintConsole` disabled (Task 5), i18n keys (Task 6), `PlayerStrip` (unchanged), `useI18n`, `sqName` from `./chessDemo`, `Color`/`Square`/`SquareName` from `../../engine/types`.
- Produces: `GameScreen` with unchanged public props `{ opponentName: string; elo: number; boardStyle: BoardStyle; pieceStyle: PieceStyle }` (so `App.tsx` needs no change).

- [ ] **Step 1: Rewrite the test `src/ui/game/GameScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { GameScreen } from './GameScreen'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>
const props = {
  opponentName: 'gemma',
  elo: 1200,
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
}
const click = (c: HTMLElement, sq: string) =>
  (c.querySelector(`[data-sq="${sq}"]`) as HTMLElement).click()

test('shows players, frozen clocks and the white-to-move status', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  expect(screen.getByText('gemma')).toBeInTheDocument()
  expect(screen.getByText('Вы')).toBeInTheDocument()
  expect(container.querySelectorAll('.clock')).toHaveLength(2)
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Ход белых',
  )
})

test('playing e4 e5 updates board, move list, status and active strip', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  click(container, 'e2')
  click(container, 'e4')
  expect(container.querySelector('[data-sq="e4"] .piece')).not.toBeNull()
  expect(container.querySelector('[data-sq="e2"] .piece')).toBeNull()
  expect(screen.getByText('e4')).toBeInTheDocument()
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Ход чёрных',
  )
  expect(container.querySelector('.status.theirs')).not.toBeNull()
  click(container, 'e7')
  click(container, 'e5')
  expect(screen.getByText('e5')).toBeInTheDocument()
})

test('Fool’s Mate ends with the checkmate status', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  click(container, 'f2')
  click(container, 'f3')
  click(container, 'e7')
  click(container, 'e5')
  click(container, 'g2')
  click(container, 'g4')
  click(container, 'd8')
  click(container, 'h4')
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Мат — победа чёрных',
  )
})

test('the hint panel is inert', () => {
  render(wrap(<GameScreen {...props} />))
  const lvl1 = screen.getByRole('button', { name: /Фигура/ })
  expect(lvl1).toBeDisabled()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx`
Expected: FAIL — current `GameScreen` renders the static demo (hint-driven), not interactive play.

- [ ] **Step 3: Rewrite `src/ui/game/GameScreen.tsx`**

```tsx
import { useI18n, type TKey } from '../app/i18n'
import type { BoardStyle, PieceStyle } from '../app/appState'
import type { Color, GameState, Square, SquareName } from '../../engine/types'
import { sqName } from './chessDemo'
import { Board } from './Board'
import { HintConsole } from './HintConsole'
import { PlayerStrip } from './PlayerStrip'
import { MoveList } from './MoveList'
import { PromotionPicker } from './PromotionPicker'
import { useGame } from './useGame'

function findKing(board: Square[][], color: Color): SquareName | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === color && p.type === 'k') return sqName(r, c)
    }
  }
  return null
}

function statusView(
  state: GameState,
  t: (k: TKey) => string,
): { text: string; theirs: boolean } {
  const s = state.status
  if (s.isCheckmate) {
    return {
      text: s.result === 'white' ? t('st_mate_w') : t('st_mate_b'),
      theirs: false,
    }
  }
  if (s.isDraw) {
    const reason =
      s.drawReason === 'stalemate'
        ? t('dr_stalemate')
        : s.drawReason === 'fifty-move'
          ? t('dr_fifty')
          : s.drawReason === 'threefold'
            ? t('dr_threefold')
            : t('dr_material')
    return { text: `${t('st_draw')} — ${reason}`, theirs: false }
  }
  const base = state.turn === 'w' ? t('turn_w') : t('turn_b')
  return {
    text: s.isCheck ? `${base} — ${t('st_check')}` : base,
    theirs: state.turn === 'b',
  }
}

export function GameScreen({
  opponentName,
  elo,
  boardStyle,
  pieceStyle,
}: {
  opponentName: string
  elo: number
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
}) {
  const { t } = useI18n()
  const g = useGame()
  const { state } = g
  const checkSquare = state.status.isCheck
    ? findKing(state.board, state.turn)
    : null
  const status = statusView(state, t)

  return (
    <div className="game">
      <div className="board-col">
        <PlayerStrip
          variant="opp"
          name={opponentName}
          sub={`${t('opp')} · ELO ${elo}`}
          clock="10:00"
          active={state.turn === 'b'}
        />
        <div style={{ position: 'relative' }}>
          <Board
            board={state.board}
            selected={g.selected}
            legalTargets={g.legalTargets}
            lastMove={
              state.lastMove
                ? { from: state.lastMove.from, to: state.lastMove.to }
                : null
            }
            checkSquare={checkSquare}
            onSquareClick={g.onSquareClick}
            boardStyle={boardStyle}
            pieceStyle={pieceStyle}
          />
          {g.pendingPromotion && (
            <PromotionPicker
              color={state.turn}
              onChoose={g.choosePromotion}
              onCancel={g.cancelPromotion}
            />
          )}
        </div>
        <PlayerStrip
          variant="you"
          name={t('you')}
          sub={`ELO 1280 · ${t('yoursub')}`}
          clock="10:00"
          active={state.turn === 'w'}
        />
      </div>

      <div className="side-col">
        <div className={'status' + (status.theirs ? ' theirs' : '')}>
          <span className="turn-dot" />
          <span className="txt">
            <b>{status.text}</b>
            <small>{opponentName}</small>
          </span>
        </div>
        <HintConsole
          level={0}
          onSelect={() => {}}
          onRefresh={() => {}}
          disabled
        />
        <MoveList history={state.history} onNewGame={g.newGame} />
      </div>
    </div>
  )
}
```

Note: `statusView` is typed with the real `TKey` (imported from `../app/i18n`),
so every status key it passes to `t` is checked against the `STRINGS` union —
this only type-checks once Task 6 has added the keys. No casts, no `any`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx`
Expected: PASS (all four tests).

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/GameScreen.tsx src/ui/game/GameScreen.test.tsx
git commit -m "feat(game): wire GameScreen to useGame — playable hotseat"
```

---

### Task 8: Full quality gate, live verification, docs

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:** none.

- [ ] **Step 1: Run the exact CI gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green. Up to 2 pre-existing `react-refresh/only-export-components` lint WARNINGS (on i18n/appState provider files) are acceptable (lint exits 0). Fix any real failure before proceeding. Report the total test count.

- [ ] **Step 2: Live browser verification**

Start the dev server (`.claude/launch.json` / preview_start) and, in the preview:

1. Complete onboarding to reach the game screen (LM Studio not required for play — the engine is local; use any path that lands on `screen === 'game'`).
2. Click a white pawn → confirm legal-move dots appear; click a target → the piece moves, the move list shows the SAN, the status flips to "Ход чёрных", and the active player strip switches.
3. Make a capture → confirm the target shows a ring (not a dot) before the capture.
4. Reach a check → confirm the checked king's square shows the `.check` highlight and the status appends "— шах".
5. Drive a pawn to the last rank → confirm the promotion picker overlays the board with four correctly-colored pieces sized sensibly; pick one → the pawn promotes. (If the glyphs render too large/small, adjust `.promo-btn` sizing in `app.css` and re-verify.)
6. Reach checkmate (e.g. Fool's Mate) → status shows "Мат — победа чёрных"; further board clicks do nothing.
7. Click "Новая партия" → the board resets to the start position and the move list clears.
8. Toggle RU/EN → status text and the New Game button switch language.
   Capture a screenshot of a mid-game state (highlights + move list) as proof.

- [ ] **Step 3: Update `CLAUDE.md`**

- In the `## Project structure` block, update the `ui/game/` line to note it is now **interactive** (playable hotseat wired to the engine via `useGame`), e.g.:
  `game/       # interactive game screen — hotseat play wired to src/engine via useGame (Board, PromotionPicker, MoveList, PlayerStrip, HintConsole[inert])`
- In the paragraph below the structure block and in `## What's next`, update sub-project **B** from "Not built" to done, and note that `ui/game` is no longer demo-only (it is real hotseat play; the LLM opponent is C, real history/clocks/persistence is D). Keep the three-layer separation guidance intact.
- Add the B spec/plan to the design-docs list:
  `Sub-project B — interactive human play — spec: docs/superpowers/specs/2026-07-17-interactive-human-play-design.md, plan: docs/superpowers/plans/2026-07-17-interactive-human-play.md. DONE.`

- [ ] **Step 4: Re-run format:check and commit**

Run: `npm run format:check`
Expected: clean.

```bash
git add CLAUDE.md
git commit -m "docs: sub-project B done — interactive hotseat play"
```

---

## Notes for the implementer

- Iterate one test file at a time with `npx vitest run <path>`; run the whole suite with `npm test` before the Task 8 gate.
- `src/engine` is frozen — do not modify it. All game logic lives in `useGame`; components are presentational.
- The board squares are clickable `<div>`s (matching the prototype). In tests, drive clicks with the DOM `.click()` helper or `userEvent.click` on the `[data-sq]` element.
- Do NOT add drag input, board flip, resign/draw behaviour, clocks, or persistence — those are out of scope for B (spec "Out of scope").
- Keep `HintConsole`, `chessDemo`'s `HINT`/`HINT_LEGAL`, and the `Piece`/`PIECE_SVGS` code in place; B only makes the hint panel inert, it does not delete the hint feature.
