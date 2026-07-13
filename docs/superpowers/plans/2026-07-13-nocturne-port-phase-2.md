# Nocturne Port — Phase 2 (Game screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Game placeholder with the ported game screen — a static board snapshot (starting position, White to move) with a fully interactive hint console, frozen clocks, and an empty move list — as presentational React on demo data.

**Architecture:** A new presentational `src/ui/game/` module. Pure data/helpers in `chessDemo.ts` + `pieceSvgs.ts`; small components (`Piece`, `Board`, `PlayerStrip`, `MoveList`, `HintConsole`) composed by `GameScreen`, which owns the only piece of state (`hintLevel`). Board styling comes from two new `appState` fields (`boardStyle`/`pieceStyle`). No chess rules, no network — everything renders in tests without mocks.

**Tech Stack:** React 18 + TypeScript 5 (strict), Vite 6, Vitest + @testing-library/react (jsdom), ESLint 9, Prettier 3.

## Global Constraints

- **Frontend-only, no backend.** Presentational components take data via props / module constants; no `fetch` in `src/ui/game`.
- **TypeScript strict**; no `any` without a justifying comment. Prefer precise types.
- **Prettier**: no semicolons, single quotes, trailing commas, 80-col. Run `npm run format` before committing.
- **Lint must pass** (`eslint .`), including react-hooks rules.
- **Chess rules are NOT owned here.** No legality, no move generation, no gameplay. The board is a fixed snapshot; hint interactions are visual only.
- **No new i18n keys** — every string key already exists in `src/ui/app/i18n.tsx` (`STRINGS`). Hint body text and the move-list empty string are demo content ported from the design source.
- **Source of truth for markup/copy:** `docs/design-reference/gambit-local/app/game.js` and `app/board.js` (vendored). Piece artwork = inline `PIECE_SVGS` in `board.js`.
- **Commit messages:** conventional prefixes (`feat:`, `docs:`…), imperative mood. End each with the Co-Authored-By trailer already used on this branch.
- **Per-file test command:** `npx vitest run <path>`. Full gate (mirrors CI): `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

Work happens on branch `feat/nocturne-port-phase-2` (already created; spec + vendored reference already committed).

---

## File Structure

```
src/ui/
  app/
    appState.tsx        # MODIFY: add boardStyle/pieceStyle (+ setters, persistence)
    appState.test.tsx   # MODIFY: cover the new fields
  game/
    chessDemo.ts        # CREATE: domain types, starting position, helpers, HINT data
    chessDemo.test.ts   # CREATE
    pieceSvgs.ts        # CREATE: 6 inline piece shapes (data)
    Piece.tsx           # CREATE: one piece span/svg
    Piece.test.tsx      # CREATE
    Board.tsx           # CREATE: 8×8 grid, coords, pieces, hint layers, arrow
    Board.test.tsx      # CREATE
    HintConsole.tsx     # CREATE: 3 level buttons + refresh + readout
    HintConsole.test.tsx# CREATE
    PlayerStrip.tsx     # CREATE: avatar + who + captured + clock
    MoveList.tsx        # CREATE: moves panel + empty state
    GameScreen.tsx      # CREATE: composition + hintLevel state
    GameScreen.test.tsx # CREATE
src/
  App.tsx               # MODIFY: route screen==='game' to <GameScreen/>
  App.test.tsx          # MODIFY: assert game route renders the screen
```

`src/ui/game/GamePlaceholder.tsx` stays (used by the `history` route until Phase 3).

---

### Task 1: App state — `boardStyle` / `pieceStyle`

**Files:**

- Modify: `src/ui/app/appState.tsx`
- Test: `src/ui/app/appState.test.tsx`

**Interfaces:**

- Consumes: existing `AppStateProvider`, `useAppState`, `STORAGE_KEY = 'nocturne-chess'`.
- Produces:
  - `export type BoardStyle = 'mono' | 'contrast' | 'accent'`
  - `export type PieceStyle = 'neon' | 'flat' | 'outline'`
  - `useAppState()` additionally returns `boardStyle: BoardStyle`, `setBoardStyle: (s: BoardStyle) => void`, `pieceStyle: PieceStyle`, `setPieceStyle: (s: PieceStyle) => void`. Defaults `'mono'` / `'neon'`, persisted into the `nocturne-chess` store.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/app/appState.test.tsx`:

```tsx
test('defaults boardStyle to mono and pieceStyle to neon', () => {
  const { result } = renderHook(() => useAppState(), { wrapper })
  expect(result.current.boardStyle).toBe('mono')
  expect(result.current.pieceStyle).toBe('neon')
})

test('setBoardStyle and setPieceStyle update and persist', () => {
  const { result } = renderHook(() => useAppState(), { wrapper })
  act(() => result.current.setBoardStyle('accent'))
  act(() => result.current.setPieceStyle('outline'))
  expect(result.current.boardStyle).toBe('accent')
  expect(result.current.pieceStyle).toBe('outline')
  const stored = JSON.parse(localStorage.getItem('nocturne-chess')!)
  expect(stored.boardStyle).toBe('accent')
  expect(stored.pieceStyle).toBe('outline')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/app/appState.test.tsx`
Expected: FAIL — `result.current.boardStyle` is `undefined`.

- [ ] **Step 3: Implement the new state**

In `src/ui/app/appState.tsx`, add the exported types near `Screen`:

```tsx
export type BoardStyle = 'mono' | 'contrast' | 'accent'
export type PieceStyle = 'neon' | 'flat' | 'outline'
```

Replace the `writeElo` helper with a generic persister and add readers:

```tsx
function persist(patch: Record<string, unknown>): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...readStore(), ...patch }),
  )
}
```

Extend `AppStateValue`:

```tsx
type AppStateValue = {
  screen: Screen
  setScreen: (s: Screen) => void
  elo: number
  setElo: (n: number) => void
  boardStyle: BoardStyle
  setBoardStyle: (s: BoardStyle) => void
  pieceStyle: PieceStyle
  setPieceStyle: (s: PieceStyle) => void
}
```

In `AppStateProvider`, add state initialised from the store and setters that persist, and update `setElo` to use `persist`:

```tsx
const [elo, setEloState] = useState<number>(() => {
  const stored = readStore().elo
  return typeof stored === 'number' ? stored : 1000
})
const [boardStyle, setBoardStyleState] = useState<BoardStyle>(() =>
  readStore().boardStyle === 'contrast' || readStore().boardStyle === 'accent'
    ? (readStore().boardStyle as BoardStyle)
    : 'mono',
)
const [pieceStyle, setPieceStyleState] = useState<PieceStyle>(() =>
  readStore().pieceStyle === 'flat' || readStore().pieceStyle === 'outline'
    ? (readStore().pieceStyle as PieceStyle)
    : 'neon',
)
const setElo = useCallback((n: number) => {
  setEloState(n)
  persist({ elo: n })
}, [])
const setBoardStyle = useCallback((s: BoardStyle) => {
  setBoardStyleState(s)
  persist({ boardStyle: s })
}, [])
const setPieceStyle = useCallback((s: PieceStyle) => {
  setPieceStyleState(s)
  persist({ pieceStyle: s })
}, [])
const value = useMemo(
  () => ({
    screen,
    setScreen,
    elo,
    setElo,
    boardStyle,
    setBoardStyle,
    pieceStyle,
    setPieceStyle,
  }),
  [screen, elo, setElo, boardStyle, setBoardStyle, pieceStyle, setPieceStyle],
)
```

Delete the old `writeElo` function.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/app/appState.test.tsx`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/app/appState.tsx src/ui/app/appState.test.tsx
git commit -m "feat: add boardStyle/pieceStyle to app state

Two persisted appearance fields (defaults mono/neon) that the Phase 2
board reads for its board--*/pieces--* classes; Phase 3's appearance
sheet will wire the picker to the setters.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Piece SVG data + `Piece` component

**Files:**

- Create: `src/ui/game/pieceSvgs.ts`
- Create: `src/ui/game/Piece.tsx`
- Create: `src/ui/game/Piece.test.tsx`

**Interfaces:**

- Consumes: `PieceType`, `Color` types (defined here in `pieceSvgs.ts`, re-used by `chessDemo.ts` in Task 3).
- Produces:
  - `export type Color = 'w' | 'b'`
  - `export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k'`
  - `export type PieceSvg = { vb: string; inner: string }`
  - `export const PIECE_SVGS: Record<PieceType, PieceSvg>`
  - `export function Piece({ color, type }: { color: Color; type: PieceType }): JSX.Element` — renders `<span class="piece {color}"><svg class="cp cp-{type}" viewBox=…>…</svg></span>`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/Piece.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Piece } from './Piece'

test('renders a white pawn span with the cp-p svg', () => {
  const { container } = render(<Piece color="w" type="p" />)
  const span = container.querySelector('span.piece.w')
  expect(span).not.toBeNull()
  const svg = container.querySelector('svg.cp.cp-p')
  expect(svg).not.toBeNull()
  expect(svg!.getAttribute('viewBox')).toBe('0 0 237.73 292.27')
  // the inline path artwork is present
  expect(svg!.querySelector('path')).not.toBeNull()
})

test('applies the black class for black pieces', () => {
  const { container } = render(<Piece color="b" type="k" />)
  expect(container.querySelector('span.piece.b svg.cp.cp-k')).not.toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/Piece.test.tsx`
Expected: FAIL — cannot resolve `./Piece`.

- [ ] **Step 3: Create the data module**

Create `src/ui/game/pieceSvgs.ts` — copy the six shapes verbatim from `docs/design-reference/gambit-local/app/board.js` (`PIECE_SVGS`). The `inner` strings must be copied exactly:

```ts
export type Color = 'w' | 'b'
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
export type PieceSvg = { vb: string; inner: string }

// Ported verbatim from docs/design-reference/gambit-local/app/board.js (PIECE_SVGS).
// Six type-keyed shapes; side colour comes from CSS (.piece.w/.b .cp).
export const PIECE_SVGS: Record<PieceType, PieceSvg> = {
  p: {
    vb: '0 0 237.73 292.27',
    inner: `<path class="cls-1" d="M118.86,7C97.37,7,80,23.33,80,43.49a35.13,35.13,0,0,0,7.59,21.71c-19,10.22-31.91,29.29-31.91,51.27,0,18.52,9.14,35,23.44,45.89C49.9,172,7,213,7,285.27H230.73c0-72.26-42.9-113.22-72.08-122.9,14.3-10.86,23.44-27.37,23.44-45.89,0-22-12.94-41.06-31.91-51.27a35.13,35.13,0,0,0,7.59-21.71C157.77,23.33,140.36,7,118.86,7Z"/>`,
  },
  r: {
    vb: '0 0 296.93 328.37',
    inner: `<path class="cls-1" d="M7,321.37H289.93V289.93H7Z"/><path class="cls-1" d="M38.44,289.93V248H258.5v41.92Z"/><path class="cls-1" d="M28,59.39V7H69.87V28h52.39V7h52.39V28h52.39V7H269V59.39"/><path class="cls-2" d="M237.54,221.82,253.26,248H43.68l15.72-26.2"/><path class="cls-3" d="M237.54,90.83V217.51H59.39V90.83"/><path class="cls-2" d="M269,59.39,237.54,90.83H59.39L28,59.39"/><path class="cls-4" d="M28,59.39H269"/>`,
  },
  n: {
    vb: '0 0 309.81 346.95',
    inner: `<path class="cls-1" d="M148.85,40.06c15.28,1.46,15.64.12,29,4.22C261,69.74,307,150.44,302.51,339.95h-241c0-94.31,124.8-68.11,103.84-220.06"/><path class="cls-2" d="M102.69,51.39c2.65-12.69,7.79-27.94,15-38.65,1.5-2.25,3.34-4.6,5.8-5.11S128,8.5,129.87,10c9.25,7.32,15.66,18.62,17.68,31.13"/><path class="cls-1" d="M174.86,157.33c-11.75,13.12-25.34,24.55-39.6,34.83-17.39,12.53-34.63,23.47-48.89,40.07a96.93,96.93,0,0,1-14.74,13.7c-3.74,2.76-12.24,4.6-16.83,2.17-3.63-1.93-9-6.56-12.07-9s-6.1-1.09-9.78-1c-7.75.17-7.84-.74-13.9-6.07-19-16.74-13-48.16.49-64.81,8.35-10.31,22.36-33.39,36.73-55.5,3.31-5.08,4.37-11.14,5.6-17,1.3-6.14,4.19-10.29,8.42-14.95,13.51-14.86,57-37.93,66.06-41.47,2.58-1,4.16-1.33,5.41-3.77a64.24,64.24,0,0,1,5-8c5.72-8,13-15.12,21.78-19.62,10.46.61,10.29,38.1,10.29,38.1"/><path class="cls-1" d="M39.88,236.64a101.51,101.51,0,0,0,17.2-25.56"/><path class="cls-3" d="M37.17,204.3a5.24,5.24,0,1,1-4.93-5.53A5.24,5.24,0,0,1,37.17,204.3Z"/><path class="cls-4" d="M102.86,99c-5.39,6.8-11.6,10.86-13.87,9.07s.26-8.77,5.65-15.57,11.6-10.86,13.87-9.07S108.25,92.18,102.86,99Z"/><path class="cls-5" d="M181.38,82.16s-3.68-2,3.12,1.44c26.37,13.44,89.89,56.25,81.94,232.22"/>`,
  },
  b: {
    vb: '0 0 359.81 363.11',
    inner: `<path class="cls-1" d="M38.44,326.61c35.52-10.16,105.94,4.51,141.47-21,35.52,25.46,105.94,10.79,141.47,21a83,83,0,0,1,31.44,21c-7.13,10.16-17.29,10.37-31.44,5.24-35.52-10.16-105.94,4.82-141.47-10.48-35.52,15.3-105.94.31-141.47,10.48-14.19,5.13-24.34,4.93-31.44-5.24C21.19,327.24,38.44,326.61,38.44,326.61Z"/><path class="cls-1" d="M101.31,284.69c26.2,26.2,131,26.2,157.18,0,4.77-14.31.2-33.55-8.29-45.73a60.7,60.7,0,0,0-17.91-17.14c57.63-15.72,62.87-120.51-52.39-162.42-115.27,41.92-110,146.71-52.39,162.42-.77-.21-3.85,2.67-4.39,3.1a67.55,67.55,0,0,0-10,9.49C102.2,247.2,95.91,268.48,101.31,284.69Z"/><path class="cls-1" d="M206.1,33.2A26.2,26.2,0,1,1,179.9,7,26.2,26.2,0,0,1,206.1,33.2Z"/><path class="cls-2" d="M127.51,221.82H232.3m-131,41.92H258.5M179.9,111.79v52.39M153.71,138H206.1"/>`,
  },
  q: {
    vb: '0 0 381.71 347.65',
    inner: `<path class="cls-1" d="M49.39,201.81c89.07-15.72,220.06-15.72,282.93,0l21-125.75L279.93,191.33V44.62L222.29,186.09,190.85,28.9,159.42,186.09,101.78,39.38V191.33L28.43,76.06Z"/><path class="cls-1" d="M49.39,201.81c0,21,15.72,21,26.2,41.92,10.48,15.72,10.48,10.48,5.24,36.68-15.72,10.48-10.48,52.39-10.48,52.39,68.11,10.48,172.9,10.48,241,0,0,0,5.24-41.92-10.48-52.39-5.24-26.2-5.24-21,5.24-36.68,10.48-21,26.2-21,26.2-41.92C243.25,186.09,138.46,186.09,49.39,201.81Z"/><path class="cls-2" d="M75.59,243.72c36.68-10.48,193.86-10.48,230.54,0"/><path class="cls-2" d="M80.83,280.4c62.87-10.48,157.18-10.48,220.06,0"/><path class="cls-2" d="M48.92,75.11a21,21,0,1,1-21-21A21,21,0,0,1,48.92,75.11Z"/><path class="cls-2" d="M211.81,28a21,21,0,1,1-21-21A21,21,0,0,1,211.81,28Z"/><path class="cls-2" d="M374.71,75.11a21,21,0,1,1-21-21A21,21,0,0,1,374.71,75.11Z"/><path class="cls-2" d="M122.74,38.44a21,21,0,1,1-21-21A21,21,0,0,1,122.74,38.44Z"/><path class="cls-2" d="M300.88,43.68a21,21,0,1,1-21-21A21,21,0,0,1,300.88,43.68Z"/>`,
  },
  k: {
    vb: '0 0 384.66 388.26',
    inner: `<path class="cls-1" d="M192.67,85.17V22.48"/><polygon class="cls-1" points="193.37 132.5 190.37 132.5 177.2 127.33 177.2 70.89 154.58 70.73 147.18 63.28 147.18 48.19 155.71 39.61 177.2 39.48 177.2 21.17 187.37 7 197.37 7 208.54 21.17 208.54 39.67 229.96 40.13 238.56 47.9 238.56 64.13 228.02 70.89 208.54 71.54 208.54 127.33 196.37 132.5 193.37 132.5"/><path class="cls-1" d="M192.67,241.06s50.11-83.52,33.41-116.93c0,0-11.14-27.84-33.41-27.84s-33.41,27.84-33.41,27.84c-16.7,33.41,33.41,116.93,33.41,116.93"/><path class="cls-2" d="M70.18,352c61.25,39,172.61,39,233.85,0v-78S404.25,224,370.84,157.15c-44.54-72.38-150.33-39-178.17,44.54v0C153.69,118.17,47.9,84.76,14.5,157.15-18.91,224,70.18,268.51,70.18,268.51Z"/><path class="cls-2" d="M70.18,274.07c61.25-33.41,172.61-33.41,233.85,0"/><path class="cls-2" d="M70.18,313c61.25-33.41,172.61-33.41,233.85,0"/><path class="cls-2" d="M70.18,352c61.25-33.41,172.61-33.41,233.85,0"/>`,
  },
}
```

- [ ] **Step 4: Create the component**

Create `src/ui/game/Piece.tsx`:

```tsx
import { PIECE_SVGS, type Color, type PieceType } from './pieceSvgs'

export function Piece({ color, type }: { color: Color; type: PieceType }) {
  const s = PIECE_SVGS[type]
  return (
    <span className={`piece ${color}`}>
      <svg
        className={`cp cp-${type}`}
        viewBox={s.vb}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: s.inner }}
      />
    </span>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/game/Piece.test.tsx`
Expected: PASS.

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/ui/game/pieceSvgs.ts src/ui/game/Piece.tsx src/ui/game/Piece.test.tsx
git commit -m "feat: add inline piece SVGs and Piece component

Ports the six type-keyed PIECE_SVGS shapes from the design source and
renders them as .piece > svg.cp; side colour is CSS-driven.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `chessDemo.ts` — demo data + pure helpers

**Files:**

- Create: `src/ui/game/chessDemo.ts`
- Create: `src/ui/game/chessDemo.test.ts`

**Interfaces:**

- Consumes: `Color`, `PieceType` from `./pieceSvgs`.
- Produces:
  - `export type Square = { color: Color; type: PieceType } | null`
  - `export const FILES: string[]` = `['a','b','c','d','e','f','g','h']`
  - `export const START_POSITION: Square[][]` — 8×8, `START_POSITION[0]` = Black back rank, `START_POSITION[7]` = White back rank.
  - `export function sqName(r: number, c: number): string`
  - `export function nameToRC(name: string): [number, number]`
  - `export const HINT` with `piece: 'e2'`, `from: 'e2'`, `to: 'e4'`, `targets: ['e4', 'd4']`, and `ru`/`en` each `{ l1: [string, string]; l2: [...]; l3: [...] }`.
  - `export const HINT_LEGAL: string[]` = `['e3', 'e4']` (the hinted pawn's demo targets → level-3 dots).

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/chessDemo.test.ts`:

```ts
import { expect, test } from 'vitest'
import { START_POSITION, sqName, nameToRC, HINT, HINT_LEGAL } from './chessDemo'

test('sqName maps array indices to algebraic squares', () => {
  expect(sqName(0, 0)).toBe('a8')
  expect(sqName(7, 4)).toBe('e1')
  expect(sqName(6, 4)).toBe('e2')
})

test('nameToRC is the inverse of sqName', () => {
  expect(nameToRC('a8')).toEqual([0, 0])
  expect(nameToRC('e2')).toEqual([6, 4])
})

test('START_POSITION has the standard back ranks and pawns', () => {
  expect(START_POSITION[0][0]).toEqual({ color: 'b', type: 'r' })
  expect(START_POSITION[0][4]).toEqual({ color: 'b', type: 'k' })
  expect(START_POSITION[1][0]).toEqual({ color: 'b', type: 'p' })
  expect(START_POSITION[6][4]).toEqual({ color: 'w', type: 'p' })
  expect(START_POSITION[7][3]).toEqual({ color: 'w', type: 'q' })
  expect(START_POSITION[4][4]).toBeNull()
})

test('HINT points at the 1.e4 demo and exposes RU/EN text', () => {
  expect(HINT.piece).toBe('e2')
  expect(HINT.to).toBe('e4')
  expect(HINT.targets).toEqual(['e4', 'd4'])
  expect(HINT_LEGAL).toEqual(['e3', 'e4'])
  expect(HINT.ru.l3[0]).toBe('e2 → e4')
  expect(HINT.en.l1[0]).toBe('Move a centre pawn')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/chessDemo.test.ts`
Expected: FAIL — cannot resolve `./chessDemo`.

- [ ] **Step 3: Implement the module**

Create `src/ui/game/chessDemo.ts` (HINT text copied verbatim from `board.js`'s `HINT`):

```ts
import type { Color, PieceType } from './pieceSvgs'

export type Square = { color: Color; type: PieceType } | null

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

function parseFEN(fen: string): Square[][] {
  return fen.split('/').map((row) => {
    const squares: Square[] = []
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) squares.push(null)
      } else {
        squares.push({
          color: ch === ch.toUpperCase() ? 'w' : 'b',
          type: ch.toLowerCase() as PieceType,
        })
      }
    }
    return squares
  })
}

// board[rank0 = rank 8][file0 = a]
export const START_POSITION: Square[][] = parseFEN(START_FEN)

export const sqName = (r: number, c: number): string => FILES[c] + (8 - r)

export const nameToRC = (name: string): [number, number] => [
  8 - Number(name[1]),
  FILES.indexOf(name[0]),
]

type HintText = {
  l1: [string, string]
  l2: [string, string]
  l3: [string, string]
}

// Ported verbatim from docs/design-reference/gambit-local/app/board.js (HINT).
export const HINT: {
  piece: string
  from: string
  to: string
  targets: string[]
  ru: HintText
  en: HintText
} = {
  piece: 'e2',
  from: 'e2',
  to: 'e4',
  targets: ['e4', 'd4'],
  ru: {
    l1: [
      'Ходите центральной пешкой',
      'Начните с пешки e2 — сразу боритесь за центр.',
    ],
    l2: [
      'Захват центра',
      'Идея: e4 занимает центр и открывает дороги ферзю и слону f1. Дальше — вывод коней и рокировка.',
    ],
    l3: [
      'e2 → e4',
      'Двиньте пешку на e4. Самый популярный первый ход — пространство и быстрое развитие.',
    ],
  },
  en: {
    l1: [
      'Move a centre pawn',
      'Start with the e2 pawn — fight for the centre right away.',
    ],
    l2: [
      'Grab the centre',
      'Idea: e4 takes the centre and opens lines for the queen and the f1 bishop. Then develop the knights and castle.',
    ],
    l3: [
      'e2 → e4',
      'Push the pawn to e4. The most popular first move — space and quick development.',
    ],
  },
}

// The hinted pawn's demo targets (from MOVES.e2 in board.js) → level-3 dots.
export const HINT_LEGAL = ['e3', 'e4']
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/game/chessDemo.test.ts`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/chessDemo.ts src/ui/game/chessDemo.test.ts
git commit -m "feat: add chessDemo data and board helpers

Starting position, sqName/nameToRC, and the demo HINT (1.e4) text used
by the static game screen. No move-making logic.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `Board` component

**Files:**

- Create: `src/ui/game/Board.tsx`
- Create: `src/ui/game/Board.test.tsx`

**Interfaces:**

- Consumes: `START_POSITION`, `sqName`, `nameToRC`, `FILES`, `HINT`, `HINT_LEGAL` from `./chessDemo`; `Piece` from `./Piece`; `BoardStyle`, `PieceStyle` from `../app/appState`.
- Produces: `export function Board({ hintLevel, boardStyle, pieceStyle }: { hintLevel: number; boardStyle: BoardStyle; pieceStyle: PieceStyle }): JSX.Element` — renders `.board-wrap.pieces--{pieceStyle}` › `.board.board--{boardStyle}` with 64 `.sq`, and the `.arrows` overlay when `hintLevel === 3`.

Behaviour (pure function of `hintLevel`), ported from `board.js.render` / `renderArrows`:

- Each square `.sq` also gets `light`/`dark` by `(r + c) % 2 === 0`.
- `hint1` when `hintLevel >= 1 && name === HINT.piece`.
- `hint-target` when `hintLevel === 2 && HINT.targets.includes(name)`.
- `sel` when `hintLevel === 3 && name === HINT.piece`.
- `legal` + a `<span class="marker dot">` when `hintLevel === 3 && HINT_LEGAL.includes(name)`.
- Rank coord (`<span class="coord rank">{8 - r}</span>`) on `c === 0`; file coord (`<span class="coord file">{FILES[c]}</span>`) on `r === 7`.
- A `<Piece>` when the square is occupied.
- Arrow overlay: an inline `<svg class="arrows" viewBox="0 0 100 100" preserveAspectRatio="none">` with an accent-coloured path from the centre of `HINT.from` to just short of `HINT.to`, plus an arrowhead marker. Colours via `var(--color-accent)` in inline `style` (deterministic — no `getComputedStyle`).

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/Board.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Board } from './Board'

test('renders 64 squares with palette classes and coord labels', () => {
  const { container } = render(
    <Board hintLevel={0} boardStyle="mono" pieceStyle="neon" />,
  )
  expect(container.querySelectorAll('.sq')).toHaveLength(64)
  expect(container.querySelector('.board.board--mono')).not.toBeNull()
  expect(container.querySelector('.board-wrap.pieces--neon')).not.toBeNull()
  // 8 rank labels + 8 file labels
  expect(container.querySelectorAll('.coord.rank')).toHaveLength(8)
  expect(container.querySelectorAll('.coord.file')).toHaveLength(8)
  // all 32 pieces present at the start
  expect(container.querySelectorAll('.piece')).toHaveLength(32)
})

test('no hint classes or arrow at level 0', () => {
  const { container } = render(
    <Board hintLevel={0} boardStyle="mono" pieceStyle="neon" />,
  )
  expect(container.querySelector('.sq.hint1')).toBeNull()
  expect(container.querySelector('.sq.hint-target')).toBeNull()
  expect(container.querySelector('.arrows')).toBeNull()
})

test('level 1 highlights the hinted piece square only', () => {
  const { container } = render(
    <Board hintLevel={1} boardStyle="mono" pieceStyle="neon" />,
  )
  const hinted = container.querySelectorAll('.sq.hint1')
  expect(hinted).toHaveLength(1)
  expect(hinted[0].getAttribute('data-sq')).toBe('e2')
})

test('level 2 adds target-square highlights', () => {
  const { container } = render(
    <Board hintLevel={2} boardStyle="mono" pieceStyle="neon" />,
  )
  const targets = [...container.querySelectorAll('.sq.hint-target')].map((s) =>
    s.getAttribute('data-sq'),
  )
  expect(targets.sort()).toEqual(['d4', 'e4'])
})

test('level 3 selects the piece, shows legal dots and the arrow', () => {
  const { container } = render(
    <Board hintLevel={3} boardStyle="mono" pieceStyle="neon" />,
  )
  expect(container.querySelector('.sq.sel')!.getAttribute('data-sq')).toBe('e2')
  expect(container.querySelectorAll('.sq.legal .marker.dot')).toHaveLength(2)
  expect(container.querySelector('.arrows')).not.toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/Board.test.tsx`
Expected: FAIL — cannot resolve `./Board`.

- [ ] **Step 3: Implement the component**

Create `src/ui/game/Board.tsx`:

```tsx
import type { BoardStyle, PieceStyle } from '../app/appState'
import {
  START_POSITION,
  sqName,
  nameToRC,
  FILES,
  HINT,
  HINT_LEGAL,
} from './chessDemo'
import { Piece } from './Piece'

function Arrow() {
  const [fr, fc] = nameToRC(HINT.from)
  const [tr, tc] = nameToRC(HINT.to)
  const u = 12.5 // percent per square (100 / 8)
  const cx = (c: number) => (c + 0.5) * u
  const cy = (r: number) => (r + 0.5) * u
  const x1 = cx(fc)
  const y1 = cy(fr)
  const x2 = cx(tc)
  const y2 = cy(tr)
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const ex = x2 - (dx / len) * 4.5
  const ey = y2 - (dy / len) * 4.5
  const accent = 'var(--color-accent)'
  return (
    <svg className="arrows" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <marker
          id="ah"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
        >
          <polygon points="0,0 4,2 0,4" style={{ fill: accent }} />
        </marker>
      </defs>
      <path
        d={`M${x1},${y1} L${ex},${ey}`}
        markerEnd="url(#ah)"
        style={{
          stroke: accent,
          strokeWidth: 2.4,
          fill: 'none',
          strokeLinecap: 'round',
          filter: `drop-shadow(0 0 3px ${accent})`,
        }}
      />
    </svg>
  )
}

export function Board({
  hintLevel,
  boardStyle,
  pieceStyle,
}: {
  hintLevel: number
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
}) {
  return (
    <div className={`board-wrap pieces--${pieceStyle}`}>
      <div className={`board board--${boardStyle}`}>
        {START_POSITION.flatMap((row, r) =>
          row.map((piece, c) => {
            const name = sqName(r, c)
            const light = (r + c) % 2 === 0
            const isLegal = hintLevel === 3 && HINT_LEGAL.includes(name)
            const classes = ['sq', light ? 'light' : 'dark']
            if (hintLevel >= 1 && name === HINT.piece) classes.push('hint1')
            if (hintLevel === 2 && HINT.targets.includes(name))
              classes.push('hint-target')
            if (hintLevel === 3 && name === HINT.piece) classes.push('sel')
            if (isLegal) classes.push('legal')
            return (
              <div key={name} className={classes.join(' ')} data-sq={name}>
                {c === 0 && <span className="coord rank">{8 - r}</span>}
                {r === 7 && <span className="coord file">{FILES[c]}</span>}
                {isLegal && <span className="marker dot" />}
                {piece && <Piece color={piece.color} type={piece.type} />}
              </div>
            )
          }),
        )}
      </div>
      {hintLevel === 3 && <Arrow />}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/game/Board.test.tsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/Board.tsx src/ui/game/Board.test.tsx
git commit -m "feat: add static Board with hint layers

8x8 board on the fixed starting position; hint level 1/2/3 drives the
highlight classes, legal dots, and the accent arrow overlay. Pure render
from props — no move-making.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `HintConsole` component

**Files:**

- Create: `src/ui/game/HintConsole.tsx`
- Create: `src/ui/game/HintConsole.test.tsx`

**Interfaces:**

- Consumes: `useI18n` (+ `TKey`) from `../app/i18n`; `HINT` from `./chessDemo`.
- Produces: `export function HintConsole({ level, onSelect, onRefresh }: { level: number; onSelect: (lv: number) => void; onRefresh: () => void }): JSX.Element`. It is presentational: it renders the three `.hint-lv` buttons (with `aria-pressed={level === lv}`), the refresh `.btn-icon`, and the `.hint-readout`, and calls `onSelect(lv)` / `onRefresh()`. The parent owns `level` and the toggle/cycle logic.

Readout, ported from `game.js.renderHint`:

- `level === 0`: `<div class="hint-readout empty">{t('hint_empty')}</div>`.
- `level 1..3`: `<div class="hint-readout">` with a `.kicker` (`{t('hints_h')} · {level}/3`), the bold title, and the body — from `HINT[lang]['l' + level]`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/HintConsole.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HintConsole } from './HintConsole'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

test('level 0 shows the empty prompt and no button is pressed', () => {
  render(
    wrap(<HintConsole level={0} onSelect={() => {}} onRefresh={() => {}} />),
  )
  expect(
    screen.getByText('Застряли? Выберите уровень подсказки.'),
  ).toBeInTheDocument()
  screen
    .getAllByRole('button', { pressed: false })
    .forEach((b) => expect(b).toHaveAttribute('aria-pressed', 'false'))
})

test('level 2 marks the second button pressed and shows its readout', () => {
  render(
    wrap(<HintConsole level={2} onSelect={() => {}} onRefresh={() => {}} />),
  )
  expect(screen.getByText('Захват центра')).toBeInTheDocument()
  expect(screen.getByText('Подсказки · 2/3')).toBeInTheDocument()
})

test('clicking a level button reports the level', async () => {
  const onSelect = vi.fn()
  render(
    wrap(<HintConsole level={0} onSelect={onSelect} onRefresh={() => {}} />),
  )
  await userEvent.click(screen.getByRole('button', { name: /Фигура/ }))
  expect(onSelect).toHaveBeenCalledWith(1)
})

test('the refresh button calls onRefresh', async () => {
  const onRefresh = vi.fn()
  render(
    wrap(<HintConsole level={0} onSelect={() => {}} onRefresh={onRefresh} />),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Следующая подсказка' }),
  )
  expect(onRefresh).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/HintConsole.test.tsx`
Expected: FAIL — cannot resolve `./HintConsole`.

- [ ] **Step 3: Implement the component**

Create `src/ui/game/HintConsole.tsx`:

```tsx
import { useI18n, type TKey } from '../app/i18n'
import { HINT } from './chessDemo'

const REFRESH_PATH =
  'M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.33,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z'

export function HintConsole({
  level,
  onSelect,
  onRefresh,
}: {
  level: number
  onSelect: (lv: number) => void
  onRefresh: () => void
}) {
  const { t, lang } = useI18n()
  return (
    <div className="panel">
      <div className="phead">
        <h6>{t('hints_h')}</h6>
        <button
          type="button"
          className="btn btn-icon"
          onClick={onRefresh}
          title={lang === 'ru' ? 'Следующая подсказка' : 'Next hint'}
        >
          <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
            <path d={REFRESH_PATH} />
          </svg>
        </button>
      </div>
      <div className="hint-box">
        <div className="hint-levels">
          {[1, 2, 3].map((lv) => (
            <button
              key={lv}
              type="button"
              className="hint-lv"
              aria-pressed={level === lv}
              onClick={() => onSelect(lv)}
            >
              <b>{t(`hint${lv}_t` as TKey)}</b>
              <small>{t(`hint${lv}_s` as TKey)}</small>
            </button>
          ))}
        </div>
        {level === 0 ? (
          <div className="hint-readout empty">{t('hint_empty')}</div>
        ) : (
          <div className="hint-readout">
            <span className="kicker">
              {t('hints_h')} · {level}/3
            </span>
            <b style={{ fontFamily: 'var(--font-heading)' }}>
              {HINT[lang][`l${level}` as 'l1' | 'l2' | 'l3'][0]}
            </b>
            <br />
            {HINT[lang][`l${level}` as 'l1' | 'l2' | 'l3'][1]}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/game/HintConsole.test.tsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/HintConsole.tsx src/ui/game/HintConsole.test.tsx
git commit -m "feat: add HintConsole (levels + refresh + readout)

Presentational hint panel: three level buttons with aria-pressed, a
refresh button, and the RU/EN readout from the demo HINT. Parent owns the
level state.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `PlayerStrip` + `MoveList` components

**Files:**

- Create: `src/ui/game/PlayerStrip.tsx`
- Create: `src/ui/game/MoveList.tsx`
- Create: `src/ui/game/PlayerStrip.test.tsx`
- Create: `src/ui/game/MoveList.test.tsx`

**Interfaces:**

- `PlayerStrip` — Produces `export function PlayerStrip({ variant, name, sub, clock, active }: { variant: 'opp' | 'you'; name: string; sub: string; clock: string; active?: boolean }): JSX.Element`. Renders `.player` › avatar (`✳` for `opp`, the accent user glyph for `you`) + `.who` (`<b>{name}</b><small>{sub}</small>`) + empty `.captured` + `.clock` (`+ ' active'` when `active`).
- `MoveList` — Consumes `useI18n`. Produces `export function MoveList(): JSX.Element`. Renders the moves `.panel` with inert (disabled) `{offerdraw}` / `{resign}` buttons and a `.moves` table whose single row shows the empty-state text ("Сделайте первый ход" / "Make the first move").

- [ ] **Step 1: Write the failing tests**

Create `src/ui/game/PlayerStrip.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PlayerStrip } from './PlayerStrip'

test('renders name, subtitle and clock', () => {
  const { container, getByText } = render(
    <PlayerStrip
      variant="opp"
      name="gemma"
      sub="Соперник · ELO 1000"
      clock="10:00"
    />,
  )
  expect(getByText('gemma')).toBeInTheDocument()
  expect(getByText('Соперник · ELO 1000')).toBeInTheDocument()
  const clock = container.querySelector('.clock')!
  expect(clock.textContent).toBe('10:00')
  expect(clock.classList.contains('active')).toBe(false)
})

test('active adds the active class to the clock', () => {
  const { container } = render(
    <PlayerStrip variant="you" name="Вы" sub="x" clock="10:00" active />,
  )
  expect(container.querySelector('.clock.active')).not.toBeNull()
})
```

Create `src/ui/game/MoveList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { MoveList } from './MoveList'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

test('shows the empty state and inert action buttons', () => {
  render(wrap(<MoveList />))
  expect(screen.getByText('Сделайте первый ход')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Сдаться' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Ничья' })).toBeDisabled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/game/PlayerStrip.test.tsx src/ui/game/MoveList.test.tsx`
Expected: FAIL — cannot resolve the modules.

- [ ] **Step 3: Implement `PlayerStrip`**

Create `src/ui/game/PlayerStrip.tsx`:

```tsx
const USER_PATH =
  'M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z'

export function PlayerStrip({
  variant,
  name,
  sub,
  clock,
  active,
}: {
  variant: 'opp' | 'you'
  name: string
  sub: string
  clock: string
  active?: boolean
}) {
  return (
    <div className="player">
      <div
        className="avatar"
        style={variant === 'you' ? { color: 'var(--color-accent)' } : undefined}
      >
        {variant === 'you' ? (
          <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
            <path d={USER_PATH} />
          </svg>
        ) : (
          '✳'
        )}
      </div>
      <div className="who">
        <b>{name}</b>
        <small>{sub}</small>
      </div>
      <div className="captured" />
      <div className={`clock${active ? ' active' : ''}`}>{clock}</div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `MoveList`**

Create `src/ui/game/MoveList.tsx`:

```tsx
import { useI18n } from '../app/i18n'

export function MoveList() {
  const { t, lang } = useI18n()
  const empty = lang === 'ru' ? 'Сделайте первый ход' : 'Make the first move'
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="phead">
        <h6>{t('moves_h')}</h6>
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
            <tr>
              <td className="n">–</td>
              <td className="mv" colSpan={2} style={{ opacity: 0.5 }}>
                {empty}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/ui/game/PlayerStrip.test.tsx src/ui/game/MoveList.test.tsx`
Expected: PASS.

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/ui/game/PlayerStrip.tsx src/ui/game/MoveList.tsx src/ui/game/PlayerStrip.test.tsx src/ui/game/MoveList.test.tsx
git commit -m "feat: add PlayerStrip and MoveList

Presentational player strips (avatar/name/clock) and the moves panel with
its empty state and inert draw/resign buttons.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `GameScreen` composition

**Files:**

- Create: `src/ui/game/GameScreen.tsx`
- Create: `src/ui/game/GameScreen.test.tsx`

**Interfaces:**

- Consumes: `useI18n`; `BoardStyle`/`PieceStyle` from `../app/appState`; `Board`, `HintConsole`, `PlayerStrip`, `MoveList`.
- Produces: `export function GameScreen({ opponentName, elo, boardStyle, pieceStyle }: { opponentName: string; elo: number; boardStyle: BoardStyle; pieceStyle: PieceStyle }): JSX.Element`. Owns `hintLevel` via `useState<number>(0)`. `selectLevel(lv)` toggles (`cur === lv ? 0 : lv`); `cycleHint()` sets `(cur % 3) + 1`. Layout: `.game` › (`.board-col` with opponent strip, `Board`, you strip) + (`.side-col` with `.status`, `HintConsole`, `MoveList`). The you strip has `active`; the status line is fixed to `{yourmove}` / `{yoursub}`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/GameScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { GameScreen } from './GameScreen'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

const props = {
  opponentName: 'gemma',
  elo: 1200,
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
}

test('shows both players, frozen clocks and the your-move status', () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  expect(screen.getByText('gemma')).toBeInTheDocument()
  expect(screen.getByText('Соперник · ELO 1200')).toBeInTheDocument()
  expect(screen.getByText('Вы')).toBeInTheDocument()
  expect(container.querySelectorAll('.clock')).toHaveLength(2)
  container
    .querySelectorAll('.clock')
    .forEach((c) => expect(c.textContent).toBe('10:00'))
  expect(container.querySelector('.status .txt b')!.textContent).toBe('Ваш ход')
})

test('shows the empty move list', () => {
  render(wrap(<GameScreen {...props} />))
  expect(screen.getByText('Сделайте первый ход')).toBeInTheDocument()
})

test('clicking a hint level highlights the board; clicking it again clears', async () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  expect(container.querySelector('.sq.hint1')).toBeNull()
  const lvl1 = screen.getByRole('button', { name: /Фигура/ })
  await userEvent.click(lvl1)
  expect(container.querySelector('.sq.hint1')!.getAttribute('data-sq')).toBe(
    'e2',
  )
  expect(lvl1).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(lvl1)
  expect(container.querySelector('.sq.hint1')).toBeNull()
})

test('the refresh button cycles into level 1', async () => {
  const { container } = render(wrap(<GameScreen {...props} />))
  await userEvent.click(
    screen.getByRole('button', { name: 'Следующая подсказка' }),
  )
  expect(container.querySelector('.sq.hint1')).not.toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx`
Expected: FAIL — cannot resolve `./GameScreen`.

- [ ] **Step 3: Implement the component**

Create `src/ui/game/GameScreen.tsx`:

```tsx
import { useState } from 'react'
import { useI18n } from '../app/i18n'
import type { BoardStyle, PieceStyle } from '../app/appState'
import { Board } from './Board'
import { HintConsole } from './HintConsole'
import { PlayerStrip } from './PlayerStrip'
import { MoveList } from './MoveList'

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
  const [hintLevel, setHintLevel] = useState(0)
  const selectLevel = (lv: number) =>
    setHintLevel((cur) => (cur === lv ? 0 : lv))
  const cycleHint = () => setHintLevel((cur) => (cur % 3) + 1)

  return (
    <div className="game">
      <div className="board-col">
        <PlayerStrip
          variant="opp"
          name={opponentName}
          sub={`${t('opp')} · ELO ${elo}`}
          clock="10:00"
        />
        <Board
          hintLevel={hintLevel}
          boardStyle={boardStyle}
          pieceStyle={pieceStyle}
        />
        <PlayerStrip
          variant="you"
          name={t('you')}
          sub={`ELO 1280 · ${t('yoursub')}`}
          clock="10:00"
          active
        />
      </div>

      <div className="side-col">
        <div className="status">
          <span className="turn-dot" />
          <span className="txt">
            <b>{t('yourmove')}</b>
            <small>{t('yoursub')}</small>
          </span>
        </div>
        <HintConsole
          level={hintLevel}
          onSelect={selectLevel}
          onRefresh={cycleHint}
        />
        <MoveList />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/game/GameScreen.tsx src/ui/game/GameScreen.test.tsx
git commit -m "feat: compose the static GameScreen

Two-column game layout wiring player strips, the board, the hint console,
and the move list; owns the hintLevel state and its toggle/cycle logic.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Route `game` to `GameScreen`

**Files:**

- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**

- Consumes: `GameScreen`; `useAppState` (now exposing `boardStyle`/`pieceStyle`); `useConnection` (`state.activeModel`).
- Produces: on `screen === 'game'`, renders `<GameScreen opponentName={conn.state.activeModel ?? 'Qwen2.5 14B'} elo={elo} boardStyle={boardStyle} pieceStyle={pieceStyle} />`. `screen === 'history'` still renders `<GamePlaceholder />`.

- [ ] **Step 1: Update the existing failing test**

`src/App.test.tsx` already has a `renderApp()` helper and a test named
`'connect → choose model → ELO → game'` that navigates the full onboarding path
and, at the end, asserts the placeholder text `'Модель думает…'`. Once the game
route renders `GameScreen`, that placeholder text is gone, so this test must be
updated to assert the real game screen instead (this doubles as the routing
test). The mocked model id `'google/gemma-4-e4b'` becomes `activeModel`, so it is
also the opponent-strip name — asserting it proves the wiring.

In that test, replace the final block:

```tsx
// game placeholder
await waitFor(() =>
  expect(screen.getByText('Модель думает…')).toBeInTheDocument(),
)
```

with:

```tsx
// game screen: board rendered, your-move status, opponent = chosen model
expect(await screen.findByText('Ваш ход')).toBeInTheDocument()
expect(screen.getByText('google/gemma-4-e4b')).toBeInTheDocument()
expect(document.querySelector('.game .board')).not.toBeNull()
```

The now-unused `waitFor` import may be removed if no other test uses it (check
first; leave it if still referenced).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — the game route still renders the placeholder, so `'Ваш ход'`
is never found and `.game .board` is null.

- [ ] **Step 3: Wire the route**

In `src/App.tsx`, import `GameScreen` and read the new state, then split the combined game/history branch:

```tsx
import { GameScreen } from './ui/game/GameScreen'
```

```tsx
const { screen, setScreen, elo, boardStyle, pieceStyle } = useAppState()
```

Replace:

```tsx
{
  ;(screen === 'game' || screen === 'history') && <GamePlaceholder />
}
```

with:

```tsx
{
  screen === 'game' && (
    <GameScreen
      opponentName={conn.state.activeModel ?? 'Qwen2.5 14B'}
      elo={elo}
      boardStyle={boardStyle}
      pieceStyle={pieceStyle}
    />
  )
}
{
  screen === 'history' && <GamePlaceholder />
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: route the game screen to GameScreen

The game route now renders the ported static game screen (opponent name
from the selected model, falling back to a demo label); history keeps the
placeholder until Phase 3.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (not a TDD task)

1. **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` — all green.
2. **Live check** (requires LM Studio on `http://localhost:1234`, model `google/gemma-4-e4b`): `npm run dev`, complete onboarding to the game screen, and visually compare against the prototype (`docs/design-reference/gambit-local/index.html`):
   - Board in the starting position, three palettes reachable by editing `boardStyle` default; pieces render in the neon style.
   - Hint level 1 pulses `e2`; level 2 rings `e4`/`d4`; level 3 shows the `e2` selection, the legal dots, and the accent arrow to `e4`; the refresh button cycles; clicking the active level clears.
   - Clocks read `10:00`, the White clock is highlighted; the move list shows the empty state; draw/resign are inert.
   - RU/EN toggle switches all game-screen copy.
3. **Push and open a PR** to `main`; confirm CI is green before merging (per project workflow).

## Self-review notes

- **Spec coverage:** board snapshot (Task 4), live hints (Tasks 4–5, 7), frozen clocks + empty move list (Tasks 6–7), players/ELO/opponent name (Tasks 6–8), pieces from inline SVGs (Task 2), demo data (Task 3), `boardStyle`/`pieceStyle` state (Task 1), routing (Task 8), tests without network (all), no new i18n keys (used existing `STRINGS`). Out-of-scope items (gameplay, History, Appearance picker, chess.js) are intentionally absent.
- **Type consistency:** `Color`/`PieceType` defined in `pieceSvgs.ts` and reused by `chessDemo.ts`; `BoardStyle`/`PieceStyle` defined in `appState.tsx` and consumed by `Board`/`GameScreen`/`App`; `hintLevel: number` and the `{ level, onSelect, onRefresh }` `HintConsole` contract are consistent across Tasks 5 and 7.
