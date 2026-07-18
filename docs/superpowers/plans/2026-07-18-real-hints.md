# Real Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the `HintConsole` with real LLM-generated hints — one recommended move revealed progressively (piece type → idea → exact move + board highlight).

**Architecture:** `src/llm/hint.ts` (`getHint`) asks the connected model for one best move + a one-sentence idea, validates the move against the engine, retries with correction, and errors (no random fallback) if it can't. `src/ui/game/useHint.ts` owns the panel's async lifecycle. `HintConsole` (panel) and `Board` (L3 highlight) present it, wired by `GameScreen`. The engine stays the sole authority on legality.

**Tech Stack:** React 18 + TypeScript 5 (strict), Vitest + @testing-library/react (jsdom), Vite 6.

## Global Constraints

- **No backend; the LLM is reached only via the existing `src/llm` transport.** No new adapter registry, no per-model hint formats. (Copied from spec.)
- **The engine is the sole authority on legality** — a hint's move is validated with `move(state, candidate)`; illegal/unparseable replies retry with correction, then error. **No random-move fallback** (unlike `selectMove`).
- **`src/llm` must not import from `src/ui`** (one-way layering).
- **Local quality gate must stay green** after every task: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`. (Prettier checks Markdown too — run `npm run format` before committing docs.)
- **TypeScript strict.** No `any` without a justifying comment.
- **Prettier:** no semicolons, single quotes, trailing commas, 80-col.
- **All user-facing copy is bilingual RU + EN** via `src/ui/app/i18n.tsx` (`STRINGS.ru` / `STRINGS.en`, both `as const`; `TKey = keyof STRINGS['ru']`).
- **Tests live next to source**, query by role/text, and **never hit a real model** — mock the `chat` dep (unit) or the `getHintFn` seam (hook/screen).
- **Human is White; the model is Black.** Hints are only offered on the human's live turn.
- **`MAX_HINT_ATTEMPTS = 3`** (mirrors `selectMove`'s `MAX_MOVE_ATTEMPTS`).
- **Commit messages:** conventional prefixes, imperative mood.

## File Structure

**New**

- `src/llm/hint.ts` — `getHint`, `Hint`, `HintUnavailableError`, `MAX_HINT_ATTEMPTS`.
- `src/llm/hint.test.ts`
- `src/ui/game/useHint.ts` — `useHint` hook + `HintErrorKind`.
- `src/ui/game/useHint.test.ts`

**Modified**

- `src/ui/app/i18n.tsx` — piece names + L1 template + loading/error/idea-fallback (+ parity test in `i18n.test.tsx`).
- `src/ui/game/Board.tsx` — optional `hintMove` prop → `hint1`/`hint-target` classes (+ test).
- `src/ui/game/HintConsole.tsx` — real props, readout states, no demo data (+ test rewrite).
- `src/ui/game/GameScreen.tsx` — compose `useHint`, wire panel + board, `getHintFn?` seam (+ test).
- `src/ui/game/chessDemo.ts` — remove demo `HINT` / `HINT_LEGAL`; keep `HintLevel` and board helpers (+ `chessDemo.test.ts` drops the HINT test).

---

### Task 1: LLM hint generation (`hint.ts`)

**Files:**

- Create: `src/llm/hint.ts`
- Test: `src/llm/hint.test.ts`

**Interfaces:**

- Consumes: `chatCompletion` from `./chat`; `parseSanCandidates` from `./adapters/genericFen`; `toFen`/`toSanMoveChain` from `./adapters/encoding`; `move` from `../engine/game`; `LMStudioError` from `./types`.
- Produces:
  - `type Hint = { san: string; from: SquareName; to: SquareName; pieceType: PieceType; idea: string }`
  - `class HintUnavailableError extends Error`
  - `const MAX_HINT_ATTEMPTS = 3`
  - `getHint(params: { baseUrl; model; state: GameState; elo; signal? }, deps?: { chat?: typeof chatCompletion }): Promise<Hint>`

- [ ] **Step 1: Write the failing test**

Create `src/llm/hint.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { getHint, HintUnavailableError, MAX_HINT_ATTEMPTS } from './hint'
import { newGame } from '../engine/game'
import { LMStudioError } from './types'
import type { chatCompletion } from './chat'

// A chat stub returning a fixed reply (ignores its arguments).
const replying = (reply: string): typeof chatCompletion =>
  (async () => reply) as unknown as typeof chatCompletion

test('parses Move/Idea and returns a validated Hint', async () => {
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: replying('Move: e4\nIdea: Grab the centre.') },
  )
  expect(hint.san).toBe('e4')
  expect(hint.from).toBe('e2')
  expect(hint.to).toBe('e4')
  expect(hint.pieceType).toBe('p')
  expect(hint.idea).toBe('Grab the centre.')
})

test('picks the first legal candidate from a chatty reply', async () => {
  // Qh5 is illegal from the start; Nf3 is legal and mentioned last.
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: replying('Maybe Qh5? No. Move: Nf3\nIdea: Develop.') },
  )
  expect(hint.san).toBe('Nf3')
  expect(hint.pieceType).toBe('n')
})

test('empty idea line yields an empty idea string', async () => {
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: replying('Move: d4') },
  )
  expect(hint.idea).toBe('')
})

test('retries with a correction after an illegal move, then succeeds', async () => {
  const chat = vi
    .fn()
    .mockResolvedValueOnce('Move: e5') // illegal for White at the start
    .mockResolvedValueOnce('Move: e4\nIdea: ok')
  const hint = await getHint(
    { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
    { chat: chat as unknown as typeof chatCompletion },
  )
  expect(hint.san).toBe('e4')
  expect(chat).toHaveBeenCalledTimes(2)
})

test('throws HintUnavailableError after MAX_HINT_ATTEMPTS of nonsense', async () => {
  const chat = vi.fn().mockResolvedValue('no idea, sorry')
  await expect(
    getHint(
      { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
      { chat: chat as unknown as typeof chatCompletion },
    ),
  ).rejects.toBeInstanceOf(HintUnavailableError)
  expect(chat).toHaveBeenCalledTimes(MAX_HINT_ATTEMPTS)
})

test('propagates LMStudioError from the transport', async () => {
  const chat = (async () => {
    throw new LMStudioError('network', 'down')
  }) as unknown as typeof chatCompletion
  await expect(
    getHint(
      { baseUrl: 'http://x', model: 'm', state: newGame(), elo: 1200 },
      { chat },
    ),
  ).rejects.toBeInstanceOf(LMStudioError)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/llm/hint.test.ts`
Expected: FAIL — cannot resolve `./hint`.

- [ ] **Step 3: Write the implementation**

Create `src/llm/hint.ts`:

```ts
// Real hints: ask the connected model for one best move + a one-sentence idea,
// validate the move against the engine, retry with correction, and error
// (never a random fallback) if no legal move comes back. Pure of React/UI.
import { chatCompletion } from './chat'
import { parseSanCandidates } from './adapters/genericFen'
import { toFen, toSanMoveChain } from './adapters/encoding'
import { move } from '../engine/game'
import type { GameState, PieceType, SquareName } from '../engine/types'

export const MAX_HINT_ATTEMPTS = 3
const TEMPERATURE = 0.4
const MAX_TOKENS = 96
const IDEA_MAX = 240

export type Hint = {
  san: string
  from: SquareName
  to: SquareName
  pieceType: PieceType
  idea: string
}

export class HintUnavailableError extends Error {
  constructor(message = 'No legal hint could be generated') {
    super(message)
    this.name = 'HintUnavailableError'
  }
}

export type GetHintParams = {
  baseUrl: string
  model: string
  state: GameState
  elo: number
  signal?: AbortSignal
}

export type GetHintDeps = { chat?: typeof chatCompletion }

const sideName = (turn: GameState['turn']): string =>
  turn === 'w' ? 'White' : 'Black'

// Board is rank-8-first, file-a-first (see engine/types GameState.board).
function pieceTypeAt(state: GameState, sq: SquareName): PieceType | null {
  const file = sq.charCodeAt(0) - 97 // 'a' -> 0
  const rank = 8 - Number(sq[1]) // '8' -> 0
  const cell = state.board[rank]?.[file]
  return cell ? cell.type : null
}

function systemPrompt(elo: number, turn: GameState['turn']): string {
  return (
    `You are a chess coach helping the ${sideName(turn)} player at ` +
    `approximately ${elo} Elo. Recommend the single best move and explain the ` +
    `idea in ONE short sentence. Answer with EXACTLY two lines:\n` +
    `Move: <the move in Standard Algebraic Notation, e.g. Nf3>\n` +
    `Idea: <one short sentence>`
  )
}

function userPrompt(state: GameState, correction?: string): string {
  const moves = toSanMoveChain(state)
  const history = moves.length > 0 ? `Moves so far: ${moves}\n` : ''
  return (
    `${history}Position (FEN): ${toFen(state)}\n` +
    `It is ${sideName(state.turn)}'s turn.${correction ?? ''}`
  )
}

function extractIdea(reply: string): string {
  const m = reply.match(/idea\s*:\s*(.+)/i)
  return (m ? m[1] : '').trim().slice(0, IDEA_MAX)
}

export async function getHint(
  params: GetHintParams,
  deps: GetHintDeps = {},
): Promise<Hint> {
  const { baseUrl, model, state, elo, signal } = params
  const chat = deps.chat ?? chatCompletion

  let correction: string | undefined
  for (let attempt = 0; attempt < MAX_HINT_ATTEMPTS; attempt++) {
    // LMStudioError from the transport propagates — a connection failure is
    // the caller's concern, not something we mask with a made-up hint.
    const reply = await chat(baseUrl, {
      model,
      messages: [
        { role: 'system', content: systemPrompt(elo, state.turn) },
        { role: 'user', content: userPrompt(state, correction) },
      ],
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      signal,
    })
    for (const candidate of parseSanCandidates(reply)) {
      const next = move(state, candidate)
      if (next && next.lastMove) {
        const pieceType = pieceTypeAt(state, next.lastMove.from)
        // from came from a legal move, so a piece is always present.
        if (pieceType) {
          return {
            san: next.lastMove.san,
            from: next.lastMove.from,
            to: next.lastMove.to,
            pieceType,
            idea: extractIdea(reply),
          }
        }
      }
    }
    correction =
      `\nYour previous reply was not a legal move here. Reply with a single ` +
      `legal move in SAN on the "Move:" line.`
  }
  throw new HintUnavailableError()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/llm/hint.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/hint.ts src/llm/hint.test.ts
git commit -m "feat: getHint — LLM move hint validated by the engine"
```

---

### Task 2: Hint lifecycle hook (`useHint.ts`)

**Files:**

- Create: `src/ui/game/useHint.ts`
- Test: `src/ui/game/useHint.test.ts`

**Interfaces:**

- Consumes: `getHint`, `HintUnavailableError`, `Hint` from `../../llm/hint`; `LMStudioError` from `../../llm/types`; `HintLevel` from `./chessDemo`; `GameState`/`SquareName` from `../../engine/types`.
- Produces:
  - `type HintErrorKind = 'unavailable' | 'connection'`
  - `useHint(opts): { level: HintLevel; hint: Hint | null; loading: boolean; errorKind: HintErrorKind | null; hintMove: { from: SquareName; to: SquareName } | null; reveal: (lv: HintLevel) => void; refresh: () => void }`
  - `opts = { baseUrl; model; elo; state: GameState; enabled: boolean; getHintFn?: typeof getHint }`

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/useHint.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { newGame, move } from '../../engine/game'
import { HintUnavailableError } from '../../llm/hint'
import { LMStudioError } from '../../llm/types'
import { useHint } from './useHint'
import type { getHint, Hint } from '../../llm/hint'

const HINT: Hint = {
  san: 'e4',
  from: 'e2',
  to: 'e4',
  pieceType: 'p',
  idea: 'Grab the centre.',
}
const resolving = (h: Hint): typeof getHint => vi.fn(async () => h)

const base = (over: Partial<Parameters<typeof useHint>[0]> = {}) => ({
  baseUrl: 'http://x',
  model: 'm',
  elo: 1200,
  state: newGame(),
  enabled: true,
  getHintFn: resolving(HINT),
  ...over,
})

test('the first reveal fetches a hint and sets the level', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  expect(result.current.level).toBe(1)
  expect(o.getHintFn).toHaveBeenCalledTimes(1)
})

test('switching level with a hint present does not refetch', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  act(() => result.current.reveal(3))
  expect(result.current.level).toBe(3)
  expect(result.current.hintMove).toEqual({ from: 'e2', to: 'e4' })
  expect(o.getHintFn).toHaveBeenCalledTimes(1)
})

test('hintMove is null below level 3', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(2))
  await waitFor(() => expect(result.current.level).toBe(2))
  expect(result.current.hintMove).toBeNull()
})

test('refresh fetches a new hint', async () => {
  const o = base()
  const { result } = renderHook(() => useHint(o))
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  act(() => result.current.refresh())
  await waitFor(() => expect(o.getHintFn).toHaveBeenCalledTimes(2))
})

test('a position change clears the hint', async () => {
  const o = base()
  const { result, rerender } = renderHook((p) => useHint(p), {
    initialProps: o,
  })
  act(() => result.current.reveal(3))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  rerender(base({ state: move(newGame(), 'e4')!, getHintFn: o.getHintFn }))
  expect(result.current.hint).toBeNull()
  expect(result.current.level).toBe(0)
})

test('disabling clears the hint', async () => {
  const o = base()
  const { result, rerender } = renderHook((p) => useHint(p), {
    initialProps: o,
  })
  act(() => result.current.reveal(1))
  await waitFor(() => expect(result.current.hint).toEqual(HINT))
  rerender(base({ enabled: false, getHintFn: o.getHintFn }))
  expect(result.current.hint).toBeNull()
})

test('HintUnavailableError and LMStudioError set errorKind', async () => {
  const unavailable = renderHook(() =>
    useHint(
      base({
        getHintFn: vi.fn(async () => {
          throw new HintUnavailableError()
        }),
      }),
    ),
  )
  act(() => unavailable.result.current.reveal(1))
  await waitFor(() =>
    expect(unavailable.result.current.errorKind).toBe('unavailable'),
  )

  const conn = renderHook(() =>
    useHint(
      base({
        getHintFn: vi.fn(async () => {
          throw new LMStudioError('network', 'down')
        }),
      }),
    ),
  )
  act(() => conn.result.current.reveal(1))
  await waitFor(() => expect(conn.result.current.errorKind).toBe('connection'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/game/useHint.test.ts`
Expected: FAIL — cannot resolve `./useHint`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/game/useHint.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, SquareName } from '../../engine/types'
import {
  getHint as realGetHint,
  HintUnavailableError,
  type Hint,
} from '../../llm/hint'
import { LMStudioError } from '../../llm/types'
import type { HintLevel } from './chessDemo'

export type HintErrorKind = 'unavailable' | 'connection'

export type UseHint = {
  level: HintLevel
  hint: Hint | null
  loading: boolean
  errorKind: HintErrorKind | null
  hintMove: { from: SquareName; to: SquareName } | null
  reveal: (lv: HintLevel) => void
  refresh: () => void
}

export function useHint(opts: {
  baseUrl: string
  model: string
  elo: number
  state: GameState
  enabled: boolean
  getHintFn?: typeof realGetHint
}): UseHint {
  const getHintFn = opts.getHintFn ?? realGetHint
  const { baseUrl, model, elo, state, enabled } = opts

  const [level, setLevel] = useState<HintLevel>(0)
  const [hint, setHint] = useState<Hint | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorKind, setErrorKind] = useState<HintErrorKind | null>(null)

  // Bumped on clear/unmount so stale async results are ignored.
  const generation = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // A hint is position-specific: drop it whenever the position changes or
  // hints become unavailable (not the human's live turn).
  useEffect(() => {
    generation.current += 1
    abortRef.current?.abort()
    setLevel(0)
    setHint(null)
    setLoading(false)
    setErrorKind(null)
  }, [state.fen, enabled])

  useEffect(
    () => () => {
      generation.current += 1
      abortRef.current?.abort()
    },
    [],
  )

  const fetchHint = useCallback(
    (lv: HintLevel) => {
      const myGen = (generation.current += 1)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setErrorKind(null)
      getHintFn({ baseUrl, model, state, elo, signal: controller.signal })
        .then((h) => {
          if (myGen !== generation.current) return
          setHint(h)
          setLevel(lv)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (myGen !== generation.current) return
          setLoading(false)
          if (err instanceof LMStudioError) setErrorKind('connection')
          else if (err instanceof HintUnavailableError)
            setErrorKind('unavailable')
          else throw err
        })
    },
    [baseUrl, model, elo, state, getHintFn],
  )

  const reveal = useCallback(
    (lv: HintLevel) => {
      if (!enabled || lv === 0) return
      if (hint) {
        setLevel(lv)
        return
      }
      if (loading) return
      fetchHint(lv)
    },
    [enabled, hint, loading, fetchHint],
  )

  const refresh = useCallback(() => {
    if (!enabled) return
    setHint(null)
    fetchHint(level === 0 ? 1 : level)
  }, [enabled, level, fetchHint])

  const hintMove = level === 3 && hint ? { from: hint.from, to: hint.to } : null

  return { level, hint, loading, errorKind, hintMove, reveal, refresh }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/game/useHint.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/useHint.ts src/ui/game/useHint.test.ts
git commit -m "feat: useHint hook — progressive hint lifecycle"
```

---

### Task 3: i18n keys for hints

**Files:**

- Modify: `src/ui/app/i18n.tsx` (add keys in both `STRINGS.ru` and `STRINGS.en`)
- Modify: `src/ui/app/i18n.test.tsx` (parity assertion)

**Interfaces:**

- Produces new `TKey`s: `hint_piece_p`, `hint_piece_n`, `hint_piece_b`, `hint_piece_r`, `hint_piece_q`, `hint_piece_k`, `hint_l1`, `hint_loading`, `hint_error`, `hint_error_conn`, `hint_idea_empty`.

- [ ] **Step 1: Write the failing test**

In `src/ui/app/i18n.test.tsx`, add at the end of the file:

```tsx
test('has the hint keys in both languages', () => {
  const keys = [
    'hint_piece_p',
    'hint_piece_n',
    'hint_piece_b',
    'hint_piece_r',
    'hint_piece_q',
    'hint_piece_k',
    'hint_l1',
    'hint_loading',
    'hint_error',
    'hint_error_conn',
    'hint_idea_empty',
  ] as const
  keys.forEach((k) => {
    expect(STRINGS.ru[k]).toBeTruthy()
    expect(STRINGS.en[k]).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/app/i18n.test.tsx`
Expected: FAIL — `hint_piece_p` is not a key of `STRINGS.ru`.

- [ ] **Step 3: Add the keys**

In `src/ui/app/i18n.tsx`, in the **`ru`** block, next to the existing `hint_off` key, add:

```ts
    hint_piece_p: 'пешкой',
    hint_piece_n: 'конём',
    hint_piece_b: 'слоном',
    hint_piece_r: 'ладьёй',
    hint_piece_q: 'ферзём',
    hint_piece_k: 'королём',
    hint_l1: 'Подумайте о ходе',
    hint_loading: 'Подбираю подсказку…',
    hint_error: 'Не удалось получить подсказку.',
    hint_error_conn: 'Модель недоступна.',
    hint_idea_empty: 'Модель не пояснила ход.',
```

In the **`en`** block, next to its `hint_off`, add:

```ts
    hint_piece_p: 'pawn',
    hint_piece_n: 'knight',
    hint_piece_b: 'bishop',
    hint_piece_r: 'rook',
    hint_piece_q: 'queen',
    hint_piece_k: 'king',
    hint_l1: 'Consider moving your',
    hint_loading: 'Thinking of a hint…',
    hint_error: "Couldn't get a hint.",
    hint_error_conn: 'The model is unavailable.',
    hint_idea_empty: 'The model gave no explanation.',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/app/i18n.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app/i18n.tsx src/ui/app/i18n.test.tsx
git commit -m "feat: i18n keys for hint piece names, L1 template and states"
```

---

### Task 4: `Board` hint highlight prop

**Files:**

- Modify: `src/ui/game/Board.tsx`
- Modify: `src/ui/game/Board.test.tsx`

**Interfaces:**

- Produces: new optional `Board` prop `hintMove?: { from: SquareName; to: SquareName } | null`. When set, the `from` square gets the `hint1` class and the `to` square gets the `hint-target` class (both already styled in `app.css`). Absent/null → no hint classes.

- [ ] **Step 1: Write the failing test**

In `src/ui/game/Board.test.tsx`, add a test (the existing "no hint classes" test already covers the null case):

```tsx
test('hintMove highlights the from and to squares', () => {
  const { container } = render(
    <Board
      {...base}
      board={newGame().board}
      hintMove={{ from: 'g1', to: 'f3' }}
    />,
  )
  expect(
    container.querySelector('[data-sq="g1"]')!.classList.contains('hint1'),
  ).toBe(true)
  expect(
    container
      .querySelector('[data-sq="f3"]')!
      .classList.contains('hint-target'),
  ).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/game/Board.test.tsx`
Expected: FAIL — `hintMove` is not a prop / no `hint1` class applied.

- [ ] **Step 3: Implement**

In `src/ui/game/Board.tsx`, add `hintMove` to the props type (after `checkSquare`):

```tsx
  checkSquare,
  hintMove,
  onSquareClick,
```

```tsx
  checkSquare: SquareName | null
  hintMove?: { from: SquareName; to: SquareName } | null
  onSquareClick: (sq: SquareName) => void
```

Then, in the per-square class logic (after the `check` line), add:

```tsx
if (name === checkSquare) classes.push('check')
if (hintMove && name === hintMove.from) classes.push('hint1')
if (hintMove && name === hintMove.to) classes.push('hint-target')
if (target) classes.push('legal')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/game/Board.test.tsx`
Expected: PASS (existing + 1 new; the "no hint classes" test still passes because `hintMove` defaults to undefined).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/Board.tsx src/ui/game/Board.test.tsx
git commit -m "feat: Board hintMove prop highlights the recommended move"
```

---

### Task 5: `HintConsole` rewrite (real props)

**Files:**

- Modify: `src/ui/game/HintConsole.tsx`
- Modify: `src/ui/game/HintConsole.test.tsx`

**Interfaces:**

- Consumes: `Hint` from `../../llm/hint`; `HintErrorKind` from `./useHint`; `HintLevel` from `./chessDemo`; the i18n keys from Task 3; `PieceType`/`TKey` types.
- Produces (new `HintConsole` props): `level: HintLevel`, `hint: Hint | null`, `loading: boolean`, `errorKind: HintErrorKind | null`, `onSelectLevel: (lv: HintLevel) => void`, `onRefresh: () => void`, `disabled?: boolean`. (The old `onSelect` prop is renamed `onSelectLevel`; the demo `HINT` import is removed.)

**Note:** this task changes `HintConsole`'s prop contract, so `GameScreen` (its only caller, updated in Task 6) will not type-check until Task 6. That is expected — `HintConsole.test.tsx` passes in this task; the project-wide `typecheck`/`build` go green again at the end of Task 6.

- [ ] **Step 1: Write the failing tests**

Replace `src/ui/game/HintConsole.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HintConsole } from './HintConsole'
import { I18nProvider } from '../app/i18n'
import type { Hint } from '../../llm/hint'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

const HINT: Hint = {
  san: 'Nf3',
  from: 'g1',
  to: 'f3',
  pieceType: 'n',
  idea: 'Develop and control the centre.',
}
const props = (over: Partial<Parameters<typeof HintConsole>[0]> = {}) => ({
  level: 0 as const,
  hint: null,
  loading: false,
  errorKind: null,
  onSelectLevel: () => {},
  onRefresh: () => {},
  ...over,
})

test('level 0 shows the empty prompt', () => {
  render(wrap(<HintConsole {...props()} />))
  expect(
    screen.getByText('Застряли? Выберите уровень подсказки.'),
  ).toBeInTheDocument()
})

test('loading shows the loading readout', () => {
  render(wrap(<HintConsole {...props({ loading: true })} />))
  expect(screen.getByText('Подбираю подсказку…')).toBeInTheDocument()
})

test('errorKind connection shows the connection message', () => {
  render(wrap(<HintConsole {...props({ errorKind: 'connection' })} />))
  expect(screen.getByText('Модель недоступна.')).toBeInTheDocument()
})

test('L1 names the piece to move', () => {
  render(wrap(<HintConsole {...props({ level: 1, hint: HINT })} />))
  expect(screen.getByText('Подумайте о ходе конём')).toBeInTheDocument()
})

test('L2 shows the model idea, L3 shows the exact move', () => {
  const { rerender } = render(
    wrap(<HintConsole {...props({ level: 2, hint: HINT })} />),
  )
  expect(
    screen.getByText('Develop and control the centre.'),
  ).toBeInTheDocument()
  rerender(wrap(<HintConsole {...props({ level: 3, hint: HINT })} />))
  expect(screen.getByText('g1 → f3')).toBeInTheDocument()
})

test('an empty idea falls back to a placeholder at L2', () => {
  render(
    wrap(<HintConsole {...props({ level: 2, hint: { ...HINT, idea: '' } })} />),
  )
  expect(screen.getByText('Модель не пояснила ход.')).toBeInTheDocument()
})

test('clicking a level button reports it; refresh fires', async () => {
  const onSelectLevel = vi.fn()
  const onRefresh = vi.fn()
  render(wrap(<HintConsole {...props({ onSelectLevel, onRefresh })} />))
  await userEvent.click(screen.getByRole('button', { name: /Фигура/ }))
  expect(onSelectLevel).toHaveBeenCalledWith(1)
  await userEvent.click(
    screen.getByRole('button', { name: 'Следующая подсказка' }),
  )
  expect(onRefresh).toHaveBeenCalledTimes(1)
})

test('disabled disables every button and shows the empty prompt', () => {
  render(wrap(<HintConsole {...props({ disabled: true })} />))
  screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled())
  expect(
    screen.getByText('Застряли? Выберите уровень подсказки.'),
  ).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/game/HintConsole.test.tsx`
Expected: FAIL — new props / readouts don't exist yet.

- [ ] **Step 3: Rewrite `HintConsole.tsx`**

```tsx
import { useI18n, type TKey } from '../app/i18n'
import type { PieceType } from '../../engine/types'
import type { Hint } from '../../llm/hint'
import type { HintErrorKind } from './useHint'
import type { HintLevel } from './chessDemo'

const REFRESH_PATH =
  'M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.33,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z'

const PIECE_KEY: Record<PieceType, TKey> = {
  p: 'hint_piece_p',
  n: 'hint_piece_n',
  b: 'hint_piece_b',
  r: 'hint_piece_r',
  q: 'hint_piece_q',
  k: 'hint_piece_k',
}

export function HintConsole({
  level,
  hint,
  loading,
  errorKind,
  onSelectLevel,
  onRefresh,
  disabled,
}: {
  level: HintLevel
  hint: Hint | null
  loading: boolean
  errorKind: HintErrorKind | null
  onSelectLevel: (lv: HintLevel) => void
  onRefresh: () => void
  disabled?: boolean
}) {
  const { t, lang } = useI18n()

  const renderReadout = () => {
    if (disabled)
      return <div className="hint-readout empty">{t('hint_empty')}</div>
    if (loading) return <div className="hint-readout">{t('hint_loading')}</div>
    if (errorKind)
      return (
        <div className="hint-readout">
          {errorKind === 'connection' ? t('hint_error_conn') : t('hint_error')}
        </div>
      )
    if (level === 0 || !hint)
      return <div className="hint-readout empty">{t('hint_empty')}</div>

    const body =
      level === 1
        ? `${t('hint_l1')} ${t(PIECE_KEY[hint.pieceType])}`
        : level === 2
          ? hint.idea || t('hint_idea_empty')
          : `${hint.from} → ${hint.to}`
    return (
      <div className="hint-readout">
        <span className="kicker">
          {t('hints_h')} · {level}/3
        </span>
        <b style={{ fontFamily: 'var(--font-heading)' }}>
          {t(`hint${level}_t`)}
        </b>
        <br />
        {body}
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="phead">
        <h6>{t('hints_h')}</h6>
        <button
          type="button"
          className="btn btn-icon"
          onClick={onRefresh}
          disabled={disabled}
          title={lang === 'ru' ? 'Следующая подсказка' : 'Next hint'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d={REFRESH_PATH} />
          </svg>
        </button>
      </div>
      <div className="hint-box">
        <div className="hint-levels">
          {([1, 2, 3] as const satisfies readonly HintLevel[]).map((lv) => (
            <button
              key={lv}
              type="button"
              className="hint-lv"
              aria-pressed={level === lv}
              onClick={() => onSelectLevel(lv)}
              disabled={disabled}
            >
              <b>{t(`hint${lv}_t`)}</b>
              <small>{t(`hint${lv}_s`)}</small>
            </button>
          ))}
        </div>
        {renderReadout()}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/game/HintConsole.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/HintConsole.tsx src/ui/game/HintConsole.test.tsx
git commit -m "feat: HintConsole renders real hint state (piece/idea/move)"
```

(Project-wide `typecheck`/`build` are expected red on `GameScreen.tsx` until Task 6, which updates the only caller. The focused `HintConsole.test.tsx` passes.)

---

### Task 6: Wire hints into `GameScreen` and drop demo `HINT`

**Files:**

- Modify: `src/ui/game/GameScreen.tsx`
- Modify: `src/ui/game/GameScreen.test.tsx`
- Modify: `src/ui/game/chessDemo.ts`
- Modify: `src/ui/game/chessDemo.test.ts`

**Interfaces:**

- Consumes: `useHint` (Task 2), `HintConsole` new props (Task 5), `Board` `hintMove` (Task 4), i18n (Task 3).
- Produces: `GameScreen` gains an optional `getHintFn?: typeof getHint` test seam (passed to `useHint`); the hint panel is live. `chessDemo.ts` no longer exports `HINT` / `HINT_LEGAL`.

- [ ] **Step 1: Write the failing tests**

In `src/ui/game/GameScreen.test.tsx`, add these imports at the top:

```tsx
import type { getHint, Hint } from '../../llm/hint'
```

and add two tests (the file already has `wrap`, `baseProps`, `idleOpponent`, and a `click` helper):

```tsx
const HINT_E4: Hint = {
  san: 'e4',
  from: 'e2',
  to: 'e4',
  pieceType: 'p',
  idea: 'Grab the centre.',
}
const hintReturning =
  (h: Hint): typeof getHint =>
  async () =>
    h

test('the hint panel is enabled on the human turn', () => {
  render(wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />))
  expect(screen.getByRole('button', { name: /Фигура/ })).toBeEnabled()
})

test('revealing L3 highlights the recommended move on the board', async () => {
  const { container } = render(
    wrap(
      <GameScreen
        {...baseProps}
        selectMoveFn={idleOpponent}
        getHintFn={hintReturning(HINT_E4)}
      />,
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: /Ход/ }))
  await waitFor(() =>
    expect(
      container.querySelector('[data-sq="e2"]')!.classList.contains('hint1'),
    ).toBe(true),
  )
  expect(
    container
      .querySelector('[data-sq="e4"]')!
      .classList.contains('hint-target'),
  ).toBe(true)
})
```

Ensure `userEvent` and `waitFor` are imported in the file (the file already imports `waitFor` from `@testing-library/react`; add `import userEvent from '@testing-library/user-event'` if not present).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/ui/game/GameScreen.test.tsx`
Expected: FAIL — the panel is still hardcoded `disabled`; no `getHintFn` prop.

- [ ] **Step 3: Wire `GameScreen.tsx`**

Add imports:

```tsx
import { useHint } from './useHint'
import type { getHint } from '../../llm/hint'
```

Add `getHintFn` to the props type and destructuring:

```tsx
  baseUrl,
  model,
  selectMoveFn,
  getHintFn,
}: {
  opponentName: string
  elo: number
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
  baseUrl: string
  model: string
  selectMoveFn?: typeof selectMove
  getHintFn?: typeof getHint
}) {
```

After `const g = useGame(...)` and `const { state } = g`, compose the hint hook:

```tsx
const hintEnabled =
  state.turn === 'w' &&
  !g.thinking &&
  !g.outcome.over &&
  !g.connectionError &&
  !!model
const hint = useHint({
  baseUrl,
  model,
  elo,
  state,
  enabled: hintEnabled,
  getHintFn,
})
```

Pass `hintMove` into `Board`:

```tsx
            checkSquare={checkSquare}
            hintMove={hint.hintMove}
            onSquareClick={g.onSquareClick}
```

Replace the inert `HintConsole` render with the wired one:

```tsx
<HintConsole
  level={hint.level}
  hint={hint.hint}
  loading={hint.loading}
  errorKind={hint.errorKind}
  onSelectLevel={hint.reveal}
  onRefresh={hint.refresh}
  disabled={!hintEnabled}
/>
```

- [ ] **Step 4: Remove demo `HINT` from `chessDemo.ts`**

Delete the `HintText` type, the `HINT` constant, and the `HINT_LEGAL` constant from `src/ui/game/chessDemo.ts` (everything under the `// Ported verbatim … (HINT).` comment through `export const HINT_LEGAL = ['e3', 'e4']`). **Keep** `HintLevel`, `FILES`, `START_POSITION`, `sqName`, `nameToRC`, and `parseFEN`.

- [ ] **Step 5: Drop the demo-HINT test in `chessDemo.test.ts`**

In `src/ui/game/chessDemo.test.ts`, remove `HINT` and `HINT_LEGAL` from the import on line 2 (keep `START_POSITION`, `sqName`, `nameToRC`), and delete the whole `test('HINT points at the 1.e4 demo and exposes RU/EN text', …)` block. Leave the other tests unchanged.

- [ ] **Step 6: Run the full local quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green. (This is the first point since Task 5 where `typecheck`/`build` pass project-wide — it confirms `GameScreen` now matches `HintConsole`'s new contract and nothing else imports the removed demo `HINT`.)

- [ ] **Step 7: Commit**

```bash
git add src/ui/game/GameScreen.tsx src/ui/game/GameScreen.test.tsx src/ui/game/chessDemo.ts src/ui/game/chessDemo.test.ts
git commit -m "feat: wire real hints into GameScreen; drop demo HINT"
```

---

## Final verification

- [ ] **Run the full local quality gate** (mirrors CI):

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Manual smoke (optional, via `preview_start` "dev"):** on the human's turn, click hint level 1 → the panel names a piece type; click level 2 → a one-sentence idea; click level 3 → an exact `from → to` line and the board highlights those squares; click refresh → a new recommendation; disconnect LM Studio and confirm the panel shows the connection error instead of a move; confirm the panel is disabled while the model is thinking and after the game ends.

## Notes for the implementer

- `getHint` mirrors `selectMove`'s validate-with-`move()` loop, but **errors** instead of returning a random legal move — a misleading hint is worse than none.
- `parseSanCandidates` (reused from `adapters/genericFen`) already prefers the last-mentioned SAN token, which suits a "Move: <SAN>" reply where the move is on the second-to-last line.
- Do not add an arrow overlay (`.arrows`) — the `hint1`/`hint-target` outline is the whole board treatment for this cycle.
- Do not touch `src/engine`; `pieceType` is read from `state.board` with inline index math (no `ui` import in `src/llm`).
- The `getHintFn` seam on `GameScreen` mirrors the existing `selectMoveFn` seam; `App.tsx` needs no change (the prop is optional and defaults to the real `getHint`).
