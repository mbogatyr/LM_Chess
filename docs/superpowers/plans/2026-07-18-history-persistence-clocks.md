# History + Persistence + Clocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist finished games to real match history, show them on the History screen (replacing demo data), and run a real chess clock with resignation — all pure frontend, no LLM.

**Architecture:** A pure-function persistence module (`gameHistory.ts`) owns the localStorage-backed record list and stats. A focused hook (`useChessClock.ts`) owns clock mechanics. `useGame` composes the clock, derives an app-level outcome (engine status ∪ timeout ∪ resignation), and appends one record per finished game. `GameScreen`/`MoveList`/`HistoryScreen` are wiring only. The engine stays the sole authority on chess rules; timeout and resignation are layered on top of engine state, never mutating it.

**Tech Stack:** React 18 + TypeScript 5 (strict), Vitest + @testing-library/react (jsdom), Vite 6.

## Global Constraints

- **No backend, no LLM in this cycle.** No `src/llm` changes, no network. (Copied from spec: "pure frontend, with no LLM involvement at all.")
- **Local quality gate must stay green** after every task: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
- **TypeScript strict.** No `any` without a justifying comment.
- **Prettier:** no semicolons, single quotes, trailing commas, 80-col. Run `npm run format` before committing.
- **All user-facing copy is bilingual RU + EN** via `src/ui/app/i18n.tsx` (`STRINGS.ru` / `STRINGS.en`, both `as const`; `TKey = keyof STRINGS['ru']`).
- **Tests live next to source** (`*.test.ts` / `*.test.tsx`), query by role/text, never hit a real model.
- **Human is White; the model is Black.** History results are from White's perspective.
- **Naming:** the history result union is `MatchResult` (`'win' | 'loss' | 'draw'`) to avoid colliding with the engine's existing `GameResult` (`'white' | 'black' | 'draw' | 'ongoing'`).
- **Commit messages:** conventional prefixes, imperative mood.

## File Structure

**New**

- `src/ui/history/gameHistory.ts` — `MatchResult`/`EndReason`/`GameRecord` types, `loadGames`/`appendGame`, `gameStats`. localStorage under key `nocturne-chess-games`, cap 50.
- `src/ui/history/gameHistory.test.ts`
- `src/ui/game/useChessClock.ts` — `useChessClock` hook + `formatClock` helper.
- `src/ui/game/useChessClock.test.ts`

**Modified**

- `src/ui/app/i18n.tsx` — 4 new keys (RU+EN) + parity test in `i18n.test.tsx`.
- `src/ui/game/useGame.ts` — clock composition, `resign`, `outcome`, recording effect, over-guards.
- `src/ui/game/useGame.test.ts` — new cases.
- `src/ui/game/MoveList.tsx` — enable Resign, two-step confirm, `onResign`/`gameOver` props.
- `src/ui/game/MoveList.test.tsx` — confirm-flow case.
- `src/ui/game/GameScreen.tsx` — real clocks, resign wiring, timeout/resign status.
- `src/ui/game/GameScreen.test.tsx` — wiring cases.
- `src/ui/history/HistoryScreen.tsx` — real data, empty state, drop opening column.
- `src/ui/history/HistoryScreen.test.tsx` — empty state + real records.
- `src/ui/app/demoData.ts` — remove `HISTORY`/`HistoryEntry`/`HistoryStats`/`historyStats`; keep `ELO_BANDS`/`EloBand`/`eloBand`.
- `src/ui/app/demoData.test.ts` — replace history-stats tests with an `eloBand` test.

---

### Task 1: Persistence module (`gameHistory.ts`)

**Files:**

- Create: `src/ui/history/gameHistory.ts`
- Test: `src/ui/history/gameHistory.test.ts`

**Interfaces:**

- Consumes: nothing (leaf module; uses `localStorage`).
- Produces:
  - `type MatchResult = 'win' | 'loss' | 'draw'`
  - `type EndReason = 'checkmate' | 'stalemate' | 'fifty-move' | 'threefold' | 'insufficient-material' | 'timeout' | 'resignation'`
  - `type GameRecord = { id: string; endedAt: number; opponent: string; elo: number; plies: number; result: MatchResult; reason: EndReason }`
  - `type GameStats = { played: number; winRate: number; streak: number; best: number }`
  - `loadGames(): GameRecord[]` (newest-first)
  - `appendGame(rec: GameRecord): void`
  - `gameStats(games: GameRecord[]): GameStats`

- [ ] **Step 1: Write the failing test**

Create `src/ui/history/gameHistory.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  appendGame,
  gameStats,
  loadGames,
  type GameRecord,
  type MatchResult,
} from './gameHistory'

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  id: crypto.randomUUID(),
  endedAt: 1_000,
  opponent: 'test-model',
  elo: 1000,
  plies: 20,
  result: 'win',
  reason: 'checkmate',
  ...over,
})

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('loadGames returns [] when nothing is stored', () => {
  expect(loadGames()).toEqual([])
})

test('loadGames returns [] on corrupt storage', () => {
  localStorage.setItem('nocturne-chess-games', 'not json')
  expect(loadGames()).toEqual([])
})

test('appendGame prepends newest-first and round-trips', () => {
  appendGame(rec({ id: 'a' }))
  appendGame(rec({ id: 'b' }))
  expect(loadGames().map((g) => g.id)).toEqual(['b', 'a'])
})

test('appendGame caps the list at 50', () => {
  for (let i = 0; i < 55; i++) appendGame(rec({ id: `g${i}` }))
  const games = loadGames()
  expect(games).toHaveLength(50)
  expect(games[0].id).toBe('g54')
  expect(games[49].id).toBe('g5')
})

test('gameStats is all zeros for an empty list', () => {
  expect(gameStats([])).toEqual({
    played: 0,
    winRate: 0,
    streak: 0,
    best: 0,
  })
})

test('gameStats computes played/winRate/streak/best', () => {
  const r = (result: MatchResult, elo: number) => rec({ result, elo })
  // newest-first: two leading wins, then a loss
  const stats = gameStats([
    r('win', 1200),
    r('win', 900),
    r('loss', 1350),
    r('win', 1000),
  ])
  expect(stats.played).toBe(4)
  expect(stats.winRate).toBe(75)
  expect(stats.streak).toBe(2)
  expect(stats.best).toBe(1350)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/history/gameHistory.test.ts`
Expected: FAIL — cannot resolve `./gameHistory`.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/history/gameHistory.ts`:

```ts
// Real match-history persistence. Finished games are stored newest-first in
// localStorage; the History screen and its stats read from here. Pure module —
// no React, no LLM.

export type MatchResult = 'win' | 'loss' | 'draw' // human (White) perspective

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'fifty-move'
  | 'threefold'
  | 'insufficient-material'
  | 'timeout'
  | 'resignation'

export type GameRecord = {
  id: string
  endedAt: number // Date.now() epoch ms — date column + sort key
  opponent: string
  elo: number
  plies: number
  result: MatchResult
  reason: EndReason
}

export type GameStats = {
  played: number
  winRate: number
  streak: number
  best: number
}

const KEY = 'nocturne-chess-games'
const CAP = 50

export function loadGames(): GameRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GameRecord[]) : []
  } catch {
    return []
  }
}

export function appendGame(rec: GameRecord): void {
  const next = [rec, ...loadGames()].slice(0, CAP)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage full/unavailable — history is best-effort, drop silently
  }
}

export function gameStats(games: GameRecord[]): GameStats {
  const played = games.length
  if (played === 0) return { played: 0, winRate: 0, streak: 0, best: 0 }
  const wins = games.filter((g) => g.result === 'win').length
  const winRate = Math.round((wins / played) * 100)
  let streak = 0
  for (const g of games) {
    if (g.result === 'win') streak++
    else break
  }
  const best = Math.max(...games.map((g) => g.elo))
  return { played, winRate, streak, best }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/history/gameHistory.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/history/gameHistory.ts src/ui/history/gameHistory.test.ts
git commit -m "feat: game-history persistence module (records + stats)"
```

---

### Task 2: Clock hook (`useChessClock.ts`)

**Files:**

- Create: `src/ui/game/useChessClock.ts`
- Test: `src/ui/game/useChessClock.test.ts`

**Interfaces:**

- Consumes: `Color` from `../../engine/types`.
- Produces:
  - `formatClock(ms: number): string` — `mm:ss`, negatives clamp to `0:00`.
  - `type UseChessClock = { whiteMs: number; blackMs: number; flagged: 'w' | null; reset: () => void }`
  - `useChessClock(opts: { turn: Color; running: boolean; initialMs?: number }): UseChessClock` (default `initialMs = 600_000`).

- [ ] **Step 1: Write the failing test**

Create `src/ui/game/useChessClock.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { formatClock, useChessClock } from './useChessClock'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('formatClock renders mm:ss and clamps negatives', () => {
  expect(formatClock(600_000)).toBe('10:00')
  expect(formatClock(65_000)).toBe('1:05')
  expect(formatClock(-5)).toBe('0:00')
})

test('the side to move ticks down while running', () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: true, initialMs: 10_000 }),
  )
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current.whiteMs).toBe(9_000)
  expect(result.current.blackMs).toBe(10_000)
})

test('the clock is frozen when not running', () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: false, initialMs: 10_000 }),
  )
  act(() => vi.advanceTimersByTime(2_000))
  expect(result.current.whiteMs).toBe(10_000)
})

test("White flags when White's time reaches zero", () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: true, initialMs: 500 }),
  )
  expect(result.current.flagged).toBeNull()
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current.whiteMs).toBe(0)
  expect(result.current.flagged).toBe('w')
})

test('reset restores both clocks and clears the flag', () => {
  const { result } = renderHook(() =>
    useChessClock({ turn: 'w', running: true, initialMs: 500 }),
  )
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current.flagged).toBe('w')
  act(() => result.current.reset())
  expect(result.current.whiteMs).toBe(500)
  expect(result.current.flagged).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/game/useChessClock.test.ts`
Expected: FAIL — cannot resolve `./useChessClock`.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/game/useChessClock.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Color } from '../../engine/types'

const TICK_MS = 250
const DEFAULT_INITIAL_MS = 600_000 // 10:00

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export type UseChessClock = {
  whiteMs: number
  blackMs: number
  flagged: 'w' | null
  reset: () => void
}

export function useChessClock(opts: {
  turn: Color
  running: boolean
  initialMs?: number
}): UseChessClock {
  const initialMs = opts.initialMs ?? DEFAULT_INITIAL_MS
  const { turn, running } = opts
  const [whiteMs, setWhiteMs] = useState(initialMs)
  const [blackMs, setBlackMs] = useState(initialMs)
  // Wall-clock timestamp of the last accounted tick; null while stopped.
  const lastRef = useRef<number | null>(null)

  const reset = useCallback(() => {
    setWhiteMs(initialMs)
    setBlackMs(initialMs)
    lastRef.current = null
  }, [initialMs])

  useEffect(() => {
    if (!running) {
      lastRef.current = null
      return
    }
    lastRef.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const delta = now - (lastRef.current ?? now)
      lastRef.current = now
      if (turn === 'w') setWhiteMs((ms) => Math.max(0, ms - delta))
      else setBlackMs((ms) => Math.max(0, ms - delta))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [running, turn])

  const flagged: 'w' | null = whiteMs <= 0 ? 'w' : null
  return { whiteMs, blackMs, flagged, reset }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/game/useChessClock.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/useChessClock.ts src/ui/game/useChessClock.test.ts
git commit -m "feat: useChessClock hook (per-side countdown, flag, reset)"
```

---

### Task 3: i18n keys for resign/timeout/empty-history

**Files:**

- Modify: `src/ui/app/i18n.tsx` (add 4 keys in both `STRINGS.ru` and `STRINGS.en`)
- Modify: `src/ui/app/i18n.test.tsx` (parity assertion)

**Interfaces:**

- Produces new `TKey`s: `resign_confirm`, `st_time_loss`, `st_resign_loss`, `lb_empty`.

- [ ] **Step 1: Write the failing test**

In `src/ui/app/i18n.test.tsx`, add this test at the end of the file:

```tsx
test('has the resign/timeout/empty-history keys in both languages', () => {
  const keys = [
    'resign_confirm',
    'st_time_loss',
    'st_resign_loss',
    'lb_empty',
  ] as const
  keys.forEach((k) => {
    expect(STRINGS.ru[k]).toBeTruthy()
    expect(STRINGS.en[k]).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/app/i18n.test.tsx`
Expected: FAIL — TypeScript/lookup error: `resign_confirm` is not a key of `STRINGS.ru`.

- [ ] **Step 3: Add the keys**

In `src/ui/app/i18n.tsx`, in the **`ru`** block, add these lines next to the existing `resign`/`st_draw` keys (anywhere inside the `ru` object literal):

```ts
    resign_confirm: 'Точно?',
    st_time_loss: 'Поражение — время',
    st_resign_loss: 'Поражение — сдача',
    lb_empty: 'Пока нет партий. Сыграйте первую — и она появится здесь.',
```

In the **`en`** block, add the parallel lines:

```ts
    resign_confirm: 'Sure?',
    st_time_loss: 'Loss — time',
    st_resign_loss: 'Loss — resigned',
    lb_empty: 'No games yet. Play your first and it will show up here.',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/app/i18n.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app/i18n.tsx src/ui/app/i18n.test.tsx
git commit -m "feat: i18n keys for resign confirm, timeout/resign status, empty history"
```

---

### Task 4: Wire clock, resignation, outcome & recording into `useGame`

**Files:**

- Modify: `src/ui/game/useGame.ts`
- Modify: `src/ui/game/useGame.test.ts`

**Interfaces:**

- Consumes: `useChessClock`, `formatClock` (Task 2); `appendGame`, `MatchResult`, `EndReason` (Task 1).
- Produces (additions to `UseGameOptions`): `initialClockMs?: number` (test seam, default 600 000), `opponentName?: string`.
- Produces (additions to `UseGame` return):
  - `whiteClock: string`, `blackClock: string`
  - `resign: () => void`
  - `outcome: { over: boolean; result: MatchResult | null; reason: EndReason | null }`

- [ ] **Step 1: Write the failing tests**

In `src/ui/game/useGame.test.ts`, add `beforeEach`/`afterEach` for storage isolation near the top imports and add the new cases. First extend the imports and add cleanup:

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { move } from '../../engine/game'
import { LMStudioError } from '../../llm/types'
import { loadGames } from '../history/gameHistory'
import { useGame, type UseGameOptions } from './useGame'
import type { selectMove } from '../../llm/selectMove'
```

Add after the `opts` helper:

```ts
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
```

Then add these tests at the end of the file:

```ts
test('both clocks are composed and start at 10:00', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  expect(result.current.whiteClock).toBe('10:00')
  expect(result.current.blackClock).toBe('10:00')
})
// (Tick-down mechanics are covered non-flakily in useChessClock.test.ts with
// fake timers; asserting the mm:ss string changes here would race the ~1s
// second-boundary against waitFor's default timeout.)

test('resign ends the game as a loss and records it once', async () => {
  const o = opts({ opponentName: 'Test Bot', elo: 1234 })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.resign())
  expect(result.current.outcome).toEqual({
    over: true,
    result: 'loss',
    reason: 'resignation',
  })
  await waitFor(() => expect(loadGames()).toHaveLength(1))
  const [rec] = loadGames()
  expect(rec.result).toBe('loss')
  expect(rec.reason).toBe('resignation')
  expect(rec.opponent).toBe('Test Bot')
  expect(rec.elo).toBe(1234)
})

test('White flagging on time is a recorded loss', async () => {
  // tiny clock so White flags almost immediately
  const o = opts({ initialClockMs: 200 })
  const { result } = renderHook(() => useGame(o))
  await waitFor(() => expect(result.current.outcome.reason).toBe('timeout'))
  expect(result.current.outcome.result).toBe('loss')
  await waitFor(() => expect(loadGames()).toHaveLength(1))
  expect(loadGames()[0].reason).toBe('timeout')
})

test('starting a new game after finishing does not double-record', async () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.resign())
  await waitFor(() => expect(loadGames()).toHaveLength(1))
  act(() => result.current.newGame())
  expect(result.current.outcome.over).toBe(false)
  expect(result.current.whiteClock).toBe('10:00')
  // abandoning the fresh game (New Game again) records nothing new
  act(() => result.current.newGame())
  expect(loadGames()).toHaveLength(1)
})

test('the human cannot move after resigning', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.resign())
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/ui/game/useGame.test.ts`
Expected: FAIL — `result.current.whiteClock` / `resign` / `outcome` undefined.

- [ ] **Step 3: Implement the changes in `useGame.ts`**

Add imports at the top:

```ts
import { formatClock, useChessClock } from './useChessClock'
import {
  appendGame,
  type EndReason,
  type MatchResult,
} from '../history/gameHistory'
```

Extend `UseGameOptions`:

```ts
export type UseGameOptions = {
  baseUrl: string
  model: string
  elo: number
  // test seams (defaults are the real dependency / production backoff)
  selectMoveFn?: typeof realSelectMove
  retryDelays?: number[]
  initialClockMs?: number
  opponentName?: string
}
```

Extend the `UseGame` type with the new fields:

```ts
export type UseGame = {
  state: GameState
  selected: SquareName | null
  legalTargets: LegalTarget[]
  pendingPromotion: PendingPromotion
  thinking: boolean
  connectionError: string | null
  lastMoveFallback: boolean
  whiteClock: string
  blackClock: string
  outcome: {
    over: boolean
    result: MatchResult | null
    reason: EndReason | null
  }
  onSquareClick: (sq: SquareName) => void
  choosePromotion: (p: PromotionPiece) => void
  cancelPromotion: () => void
  retryModelTurn: () => void
  resign: () => void
  newGame: () => void
}
```

Inside `useGame`, add resign state and the clock **before** `onSquareClick` (order matters — `onSquareClick` and the model effect reference `resigned`/`timedOut`). Add after the existing `const [retryNonce, setRetryNonce] = useState(0)` line:

```ts
const [resigned, setResigned] = useState(false)
const recordedRef = useRef(false)

// Clock runs only on White's live turn. Black is frozen (its whole turn is
// covered by `thinking`), so the model never flags on slow hardware.
const engineOver = state.status.isGameOver
const clockRunning =
  state.turn === 'w' &&
  !engineOver &&
  !resigned &&
  !pendingPromotion &&
  !connectionError
const clock = useChessClock({
  turn: state.turn,
  running: clockRunning,
  initialMs: opts.initialClockMs,
})
const timedOut = clock.flagged === 'w'

const outcome = useMemo((): UseGame['outcome'] => {
  const s = state.status
  if (s.isCheckmate) {
    return {
      over: true,
      result: s.result === 'white' ? 'win' : 'loss',
      reason: 'checkmate',
    }
  }
  if (s.isDraw) {
    return {
      over: true,
      result: 'draw',
      reason: s.drawReason ?? 'insufficient-material',
    }
  }
  if (resigned) return { over: true, result: 'loss', reason: 'resignation' }
  if (timedOut) return { over: true, result: 'loss', reason: 'timeout' }
  return { over: false, result: null, reason: null }
}, [state.status, resigned, timedOut])
```

Add `if (outcome.over) return` to the top of `onSquareClick` (replacing the existing `if (state.status.isGameOver) return` line so timeout/resignation also block input), and add `outcome.over` to its dependency array:

```ts
const onSquareClick = useCallback(
  (sq: SquareName) => {
    if (pendingPromotion) return
    if (thinking || connectionError) return
    if (!humansTurn) return
    if (outcome.over) return
    // ...unchanged body...
  },
  [
    state,
    selected,
    pendingPromotion,
    thinking,
    connectionError,
    humansTurn,
    outcome.over,
  ],
)
```

Add the `resign` callback near `retryModelTurn`:

```ts
const resign = useCallback(() => {
  if (state.status.isGameOver) return
  generation.current += 1
  abortRef.current?.abort()
  setThinking(false)
  setResigned(true)
}, [state.status.isGameOver])
```

Extend `newGame` to reset the new state:

```ts
const newGame = useCallback(() => {
  generation.current += 1
  abortRef.current?.abort()
  setState(engineNewGame())
  setSelected(null)
  setPendingPromotion(null)
  setThinking(false)
  setConnectionError(null)
  setLastMoveFallback(false)
  setResigned(false)
  recordedRef.current = false
  clock.reset()
}, [clock])
```

Guard the model-turn effect against resignation/timeout and add them to its deps. Change the guard block at the top of the effect to:

```ts
if (state.turn !== 'b') return
if (state.status.isGameOver) return
if (resigned || timedOut) return
if (connectionError) return
```

and extend that effect's dependency array to include `resigned` and `timedOut`:

```ts
  }, [
    state,
    connectionError,
    retryNonce,
    baseUrl,
    model,
    elo,
    selectMoveFn,
    retryDelays,
    resigned,
    timedOut,
  ])
```

Add the recording effect (place it after the model-turn effect, before the unmount effect):

```ts
// Record each finished game exactly once (guarded so re-renders don't
// double-write). Reset on newGame via recordedRef.
useEffect(() => {
  if (!outcome.over || recordedRef.current) return
  recordedRef.current = true
  appendGame({
    id: crypto.randomUUID(),
    endedAt: Date.now(),
    opponent: opts.opponentName?.trim() || model.trim() || 'Local model',
    elo,
    plies: state.history.length,
    result: outcome.result as MatchResult,
    reason: outcome.reason as EndReason,
  })
}, [outcome, opts.opponentName, model, elo, state.history.length])
```

Extend the returned object with the new fields:

```ts
return {
  state,
  selected,
  legalTargets,
  pendingPromotion,
  thinking,
  connectionError,
  lastMoveFallback,
  whiteClock: formatClock(clock.whiteMs),
  blackClock: formatClock(clock.blackMs),
  outcome,
  onSquareClick,
  choosePromotion,
  cancelPromotion,
  retryModelTurn,
  resign,
  newGame,
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/ui/game/useGame.test.ts`
Expected: PASS (all existing + 5 new).

- [ ] **Step 5: Run the full test suite (guards against regressions in existing useGame consumers)**

Run: `npm test`
Expected: PASS. (`GameScreen` still compiles — it uses only the previously-existing fields; new return fields are additive.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/game/useGame.ts src/ui/game/useGame.test.ts
git commit -m "feat: clocks, resignation, outcome and game recording in useGame"
```

---

### Task 5: Enable the Resign button with two-step confirm (`MoveList`)

**Files:**

- Modify: `src/ui/game/MoveList.tsx`
- Modify: `src/ui/game/MoveList.test.tsx`

**Interfaces:**

- Consumes: `resign` / `resign_confirm` i18n keys (Task 3).
- Produces (new `MoveList` props): `onResign?: () => void`, `gameOver?: boolean`. The button is disabled unless `onResign` is provided and `!gameOver`. First click shows `resign_confirm`; second click within the confirm state calls `onResign`.

- [ ] **Step 1: Write the failing test**

`MoveList.test.tsx` already imports `userEvent` and `vi` and defines a `wrap` helper (`(n) => <I18nProvider>{n}</I18nProvider>`). Add these two tests (keep the existing tests unchanged) — use `wrap`, since `MoveList` calls `useI18n`:

```tsx
test('Resign uses a two-step confirm and fires onResign on the second click', async () => {
  const onResign = vi.fn()
  render(
    wrap(<MoveList history={[]} onNewGame={() => {}} onResign={onResign} />),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
  expect(onResign).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Точно?' }))
  expect(onResign).toHaveBeenCalledTimes(1)
})

test('Resign is disabled when the game is over', () => {
  render(
    wrap(
      <MoveList
        history={[]}
        onNewGame={() => {}}
        onResign={() => {}}
        gameOver
      />,
    ),
  )
  expect(screen.getByRole('button', { name: 'Сдаться' })).toBeDisabled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/game/MoveList.test.tsx`
Expected: FAIL — clicking Resign does nothing / label stays `Сдаться`.

- [ ] **Step 3: Implement**

Rewrite `src/ui/game/MoveList.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useI18n } from '../app/i18n'

export function MoveList({
  history,
  onNewGame,
  onResign,
  gameOver,
}: {
  history: string[]
  onNewGame: () => void
  onResign?: () => void
  gameOver?: boolean
}) {
  const { t, lang } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const canResign = !!onResign && !gameOver
  // Drop the confirm state whenever resigning stops being available
  // (game ended, or a new game reset the props).
  useEffect(() => {
    if (!canResign) setConfirming(false)
  }, [canResign])

  const handleResign = () => {
    if (!onResign) return
    if (confirming) {
      setConfirming(false)
      onResign()
    } else {
      setConfirming(true)
    }
  }

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
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canResign}
          onClick={handleResign}
        >
          {confirming ? t('resign_confirm') : t('resign')}
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/game/MoveList.test.tsx`
Expected: PASS (existing + 2 new). The existing "draw/resign disabled" test still passes because it renders without `onResign`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/MoveList.tsx src/ui/game/MoveList.test.tsx
git commit -m "feat: enable Resign button with two-step confirm"
```

---

### Task 6: Wire real clocks, resign & end-state status into `GameScreen`

**Files:**

- Modify: `src/ui/game/GameScreen.tsx`
- Modify: `src/ui/game/GameScreen.test.tsx`

**Interfaces:**

- Consumes: `useGame` fields `whiteClock`/`blackClock`/`outcome`/`resign` (Task 4); `MoveList` props `onResign`/`gameOver` (Task 5); i18n `st_time_loss`/`st_resign_loss` (Task 3).
- Produces: passes `opponentName` into `useGame`; renders real clocks + status text; enables Resign.

- [ ] **Step 1: Write the failing tests**

`GameScreen.test.tsx` already has `beforeEach(() => localStorage.clear())`, a `wrap` helper, a `baseProps` object (`opponentName: 'gemma'`, …), an `idleOpponent` stub, and imports `fireEvent`/`render`/`screen`. Add two imports at the top:

```tsx
import userEvent from '@testing-library/user-event'
import { loadGames } from '../history/gameHistory'
```

Then add these two tests (matching the file's existing `wrap(<GameScreen {...baseProps} … />)` style):

```tsx
test('both clocks start frozen at 10:00', () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  const clocks = container.querySelectorAll('.clock')
  expect(clocks).toHaveLength(2)
  expect([...clocks].map((c) => c.textContent)).toEqual(['10:00', '10:00'])
})

test('resigning shows the resignation status and records the game', async () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
  await userEvent.click(screen.getByRole('button', { name: 'Точно?' }))
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Поражение — сдача',
  )
  expect(loadGames()).toHaveLength(1)
  expect(loadGames()[0].opponent).toBe('gemma')
})
```

Note: the file's pre-existing "shows players, frozen clocks and the white-to-move status" test still passes — it only asserts two `.clock` elements and the White-to-move status, both still true at game start.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/ui/game/GameScreen.test.tsx`
Expected: FAIL — only the hardcoded status renders; Resign is disabled; clocks may show but resignation flow does nothing.

- [ ] **Step 3: Implement the `GameScreen` changes**

`GameScreen.tsx` needs **no new imports** — all the wiring uses `useGame` fields and the already-imported `MoveList`/`PlayerStrip`/`useI18n`/`TKey`. (`loadGames` is only imported by the _test_ file, per Step 1.)

Pass `opponentName` into `useGame`:

```tsx
const g = useGame({ baseUrl, model, elo, selectMoveFn, opponentName })
```

Update `statusView` to accept the outcome and handle timeout/resignation. Change its signature and add the two cases after the mate/draw checks and before the turn fallback:

```tsx
function statusView(
  state: GameState,
  t: (k: TKey) => string,
  outcome: { over: boolean; reason: string | null },
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
  if (outcome.reason === 'timeout') {
    return { text: t('st_time_loss'), theirs: false }
  }
  if (outcome.reason === 'resignation') {
    return { text: t('st_resign_loss'), theirs: false }
  }
  const base = state.turn === 'w' ? t('turn_w') : t('turn_b')
  return {
    text: s.isCheck ? `${base} — ${t('st_check')}` : base,
    theirs: state.turn === 'b',
  }
}
```

Update the call site:

```tsx
const status = statusView(state, t, g.outcome)
```

Use real clocks and `active` on both strips (replace the two hardcoded `clock="10:00"`), gating `active` on `!g.outcome.over`:

```tsx
<PlayerStrip
  variant="opp"
  name={opponentName}
  sub={`${t('opp')} · ELO ${elo}`}
  clock={g.blackClock}
  active={state.turn === 'b' && !g.outcome.over}
/>
```

```tsx
<PlayerStrip
  variant="you"
  name={t('you')}
  sub={`ELO 1280 · ${t('yoursub')}`}
  clock={g.whiteClock}
  active={state.turn === 'w' && !g.outcome.over}
/>
```

Wire the status "small" line so it no longer shows a "your move" hint once the game is over. The existing ternary already guards `state.status.isGameOver`; change that guard to `g.outcome.over`:

```tsx
<small>
  {g.outcome.over
    ? ''
    : g.thinking
      ? t('theirsub')
      : status.theirs
        ? t('theirmove')
        : t('yourmove')}
</small>
```

Pass resign wiring into `MoveList`:

```tsx
<MoveList
  history={state.history}
  onNewGame={g.newGame}
  onResign={g.resign}
  gameOver={g.outcome.over}
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/ui/game/GameScreen.test.tsx`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/GameScreen.tsx src/ui/game/GameScreen.test.tsx
git commit -m "feat: real clocks, resign wiring and end-state status in GameScreen"
```

---

### Task 7: Real History screen + remove demo history

**Files:**

- Modify: `src/ui/history/HistoryScreen.tsx`
- Modify: `src/ui/history/HistoryScreen.test.tsx`
- Modify: `src/ui/app/demoData.ts`
- Modify: `src/ui/app/demoData.test.ts`

**Interfaces:**

- Consumes: `loadGames`, `gameStats`, `GameRecord` (Task 1); i18n `lb_empty` (Task 3); existing `res`/`win`/`loss`/`draw` styling + keys.
- Produces: History screen reads real records; `demoData.ts` no longer exports history symbols.

- [ ] **Step 1: Write the failing tests**

Rewrite `src/ui/history/HistoryScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { I18nProvider } from '../app/i18n'
import { appendGame, type GameRecord } from './gameHistory'
import { HistoryScreen } from './HistoryScreen'

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  id: crypto.randomUUID(),
  endedAt: Date.UTC(2026, 6, 18),
  opponent: 'Test Bot',
  elo: 1200,
  plies: 40,
  result: 'win',
  reason: 'checkmate',
  ...over,
})

const renderHistory = () =>
  render(
    <I18nProvider>
      <HistoryScreen />
    </I18nProvider>,
  )

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('shows an empty state when no games are stored', () => {
  renderHistory()
  expect(screen.getByText(/Пока нет партий/)).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('renders stored games without an opening column', () => {
  appendGame(rec({ opponent: 'Test Bot', elo: 1350, plies: 41 }))
  renderHistory()
  expect(screen.getByText('Test Bot')).toBeInTheDocument()
  expect(screen.getByText('1350')).toBeInTheDocument()
  // full-move count = ceil(41 / 2) = 21
  expect(screen.getByText('21')).toBeInTheDocument()
  // opening column header must be gone
  expect(screen.queryByText('Дебют')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/history/HistoryScreen.test.tsx`
Expected: FAIL — screen still renders demo rows / the "Дебют" header.

- [ ] **Step 3: Rewrite `HistoryScreen.tsx`**

```tsx
import { useMemo } from 'react'
import { useI18n } from '../app/i18n'
import { gameStats, loadGames } from './gameHistory'

export function HistoryScreen() {
  const { t, lang } = useI18n()
  const games = useMemo(() => loadGames(), [])
  const { played, winRate, streak, best } = gameStats(games)
  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
    })
  return (
    <div className="lb">
      <div>
        <h2 style={{ marginBottom: 4 }}>{t('lb_h')}</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          {t('lb_p')}
        </p>
      </div>
      <div className="lb-stats">
        <div className="card stat elev-sm">
          <span className="k">{t('st_played')}</span>
          <span className="v">{played}</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_winrate')}</span>
          <span className="v pos">{winRate}%</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_streak')}</span>
          <span className="v">{streak > 0 ? `+${streak}` : '0'}</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_best')}</span>
          <span className="v">{best}</span>
        </div>
      </div>
      {games.length === 0 ? (
        <div
          className="card elev-sm"
          style={{ padding: 'var(--space-6)', textAlign: 'center' }}
        >
          <p className="text-muted" style={{ margin: 0 }}>
            {t('lb_empty')}
          </p>
        </div>
      ) : (
        <div
          className="card elev-sm"
          style={{ padding: 'var(--space-2) var(--space-4)' }}
        >
          <table className="table">
            <thead>
              <tr>
                <th>{t('col_date')}</th>
                <th>{t('col_opp')}</th>
                <th>{t('col_elo')}</th>
                <th>{t('col_len')}</th>
                <th>{t('col_res')}</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td className="text-muted">{fmtDate(g.endedAt)}</td>
                  <td>{g.opponent}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {g.elo}
                  </td>
                  <td
                    className="text-muted"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {Math.ceil(g.plies / 2)}
                  </td>
                  <td>
                    <span className={`res ${g.result}`}>{t(g.result)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Remove demo history from `demoData.ts`**

Delete the `HistoryEntry` type, the `HISTORY` constant, the `HistoryStats` type, and the `historyStats` function from `src/ui/app/demoData.ts`. **Keep** `EloBand`, `ELO_BANDS`, and `eloBand`. After the edit the file ends at the `eloBand` function.

- [ ] **Step 5: Replace `demoData.test.ts` with an `eloBand` test**

Rewrite `src/ui/app/demoData.test.ts`:

```ts
import { expect, test } from 'vitest'
import { ELO_BANDS, eloBand } from './demoData'

test('eloBand returns the first band whose max covers the rating', () => {
  expect(eloBand(600).en[0]).toBe('Beginner')
  expect(eloBand(1000).en[0]).toBe('Steady')
})

test('eloBand clamps to the top band above the highest max', () => {
  expect(eloBand(9999)).toBe(ELO_BANDS[ELO_BANDS.length - 1])
})
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/ui/history/HistoryScreen.test.tsx src/ui/app/demoData.test.ts`
Expected: PASS.

- [ ] **Step 7: Full gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green. (This confirms nothing else imported the removed `HISTORY`/`historyStats`.)

- [ ] **Step 8: Commit**

```bash
git add src/ui/history/HistoryScreen.tsx src/ui/history/HistoryScreen.test.tsx src/ui/app/demoData.ts src/ui/app/demoData.test.ts
git commit -m "feat: History screen on real persisted games; drop demo history + opening column"
```

---

## Final verification

- [ ] **Run the full local quality gate** (mirrors CI):

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Manual smoke (optional, via `preview_start` "dev"):** play a short game to mate or resign, confirm the clock ticks for White and is frozen for Black while the model thinks, then open History and confirm the finished game appears with the correct result and no opening column; reload the page and confirm it persists.

## Notes for the implementer

- The `col_open` i18n key is left in place but no longer rendered; it is now dead and may be removed in a later cleanup (out of scope here to avoid churn).
- `crypto.randomUUID()` is available in the Node 20 test runtime and in modern browsers; no polyfill needed.
- Only White can flag (Black is frozen during thinking), so timeout and resignation both always map to a `loss`.
- Do not touch `src/llm` or the engine — this cycle is pure frontend.
