# Sub-project D₁ — Real history + persistence + clocks

Date: 2026-07-18
Status: Design (approved by user, pending spec review)

## Context

This is the first slice of the previously-scoped **sub-project D** ("real history +
persistence + real hints"). D was decomposed during
brainstorming. This cycle delivers **real match history, its persistence, and real
clocks** only. Two things are explicitly **out of scope** and deferred to their own
later cycles:

- **Real hints** (the `HintConsole` stays inert, exactly as today).
- **The commentary adapter** (`chess-gemma-commentary`) — dropped from D entirely for now.

This cycle is **pure frontend, with no LLM involvement at all.** No new `src/llm`
code, no model calls.

### What exists today (relevant surfaces)

- `src/ui/history/HistoryScreen.tsx` — purely presentational; reads `HISTORY` +
  `historyStats` from `src/ui/app/demoData.ts`. Table columns: date, opponent, ELO,
  length, result, **opening**.
- `src/ui/app/demoData.ts` — holds `ELO_BANDS` (used by onboarding) **and** the demo
  `HISTORY` / `HistoryEntry` / `historyStats` (used only by the History screen).
- `src/ui/app/appState.tsx` — already has a `localStorage` layer under key
  `nocturne-chess` (`readStore`/`persist`), storing `elo`/`boardStyle`/`pieceStyle`.
- `src/ui/game/useGame.ts` — human plays **White**, local model plays **Black**;
  owns game state, `thinking`, `connectionError`, `newGame`, promotion, etc.
- `src/ui/game/GameScreen.tsx` — hardcodes `clock="10:00"` on both `PlayerStrip`s.
- `src/ui/game/MoveList.tsx` — already renders **New Game**, **Offer Draw** (disabled),
  and **Resign** (disabled) buttons. The `resign` i18n key already exists
  (`Сдаться` / `Resign`).
- `src/engine` — owns chess rules/results (`state.status`: checkmate / draw taxonomy).
  It knows nothing about clocks, timeouts, or resignation.

## Decisions (from brainstorming)

1. **Scope:** history + persistence + clocks in one spec/plan/PR. Hints later.
2. **Opening column:** **removed** from the History table. No opening detection, no
   LLM call for it.
3. **Clocks while the model thinks:** Black's clock is **displayed but frozen** during
   inference/retry. In practice only White's clock ever ticks; the model cannot flag
   on slow hardware.
4. **Time control:** fixed **10:00** per side, **no increment**. No new picker UI.
   White running out of time = **loss**.
5. **Recording trigger:** a game is recorded on **checkmate / draw / timeout /
   resignation**. Starting a New Game mid-play (abandonment) is **not** recorded.
6. **Resign:** wire the existing (currently disabled) **Resign** button. Human resign
   = loss, recorded. **Offer Draw** stays disabled (out of scope).

## Architecture

Pure-frontend, three concerns kept separate:

- **Persistence + stats** — `src/ui/history/gameHistory.ts` (localStorage, pure funcs).
- **Clock mechanics** — `src/ui/game/useChessClock.ts` (a focused hook).
- **Orchestration** — `src/ui/game/useGame.ts` composes the clock, derives the
  app-level outcome (engine status ∪ timeout ∪ resignation), and appends a record
  once per finished game.

The engine remains the sole authority on chess rules. Timeout and resignation are
**app-level outcomes layered on top of** engine state — they never mutate `GameState`.

### 1. Data model — `GameRecord`

Defined in `src/ui/history/gameHistory.ts`:

```ts
export type GameResult = 'win' | 'loss' | 'draw' // human (White) perspective
export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'fifty-move'
  | 'threefold'
  | 'insufficient-material'
  | 'timeout'
  | 'resignation'
export type GameRecord = {
  id: string // crypto.randomUUID()
  endedAt: number // Date.now() epoch ms — date column + sort key
  opponent: string // model name (activeModel); fallback when empty
  elo: number
  plies: number // state.history.length at game end
  result: GameResult
  reason: EndReason
}
```

Displayed columns: **date** (from `endedAt`), **opponent**, **ELO**, **length**
(full moves = `Math.ceil(plies / 2)`), **result** badge. No opening column.

Result mapping (human is White):

- engine checkmate → `state.status.result === 'white'` ? `win` : `loss`
- engine draw → `draw`
- timeout (White flags) → `loss`, reason `timeout`
- resignation (human) → `loss`, reason `resignation`

Since only White can flag or resign, both are always `loss`.

### 2. Persistence — `src/ui/history/gameHistory.ts`

Pure functions over `localStorage`, mirroring the try/catch pattern in `appState.tsx`
but under a **separate key** `nocturne-chess-games` (history is its own concern):

- `loadGames(): GameRecord[]` — parse the stored array; newest-first; `[]` on any
  parse error or absence.
- `appendGame(rec: GameRecord): void` — prepend `rec`, cap the list to the **50**
  most recent, write back.
- `gameStats(games: GameRecord[]): { played: number; winRate: number; streak: number; best: number }`
  — same arithmetic as the old `historyStats`, but **guarded for `played === 0`**
  (returns all zeros; no `NaN`). `streak` counts leading `win`s from newest;
  `best` is the max ELO faced (0 when empty).

The demo `HISTORY`, `HistoryEntry`, and `historyStats` are **removed** from
`demoData.ts`; `ELO_BANDS` and `eloBand` stay. `demoData.test.ts`'s history-stats
tests move to `gameHistory.test.ts` (rewritten for `GameRecord`).

### 3. Clocks — `src/ui/game/useChessClock.ts`

```ts
useChessClock(opts: {
  turn: 'w' | 'b'
  running: boolean
  initialMs?: number // default 600_000 (10:00)
}): {
  whiteMs: number
  blackMs: number
  flagged: 'w' | null
  reset: () => void
}
```

- While `running`, decrements the side-to-move's remaining ms toward 0.
- Uses a wall-clock **timestamp delta** accumulated on an interval (~250 ms) rather
  than assuming exact tick spacing, so background-tab throttling doesn't distort the
  elapsed time. Clamps at 0.
- `flagged` becomes `'w'` when `whiteMs` reaches 0. (Black never flags because Black
  is frozen during thinking, which spans its whole turn.)
- `reset()` restores both clocks to `initialMs` and clears `flagged` (called by
  `newGame`).
- A `formatClock(ms): string` helper (`mm:ss`, clamps negatives to `0:00`) lives here
  and is used by the UI.

### 4. `useGame` extensions

- Compose `useChessClock`. `running = turn === 'w' && !outcome.over &&
  !pendingPromotion && !connectionError`. (On White's turn `thinking` is already
  false; Black's window is fully covered by `thinking`, so Black stays frozen.)
- New state `resigned: boolean`; consume the clock's `flagged`.
- Derive `outcome: { over: boolean; result: GameResult | null; reason: EndReason | null }`
  from `state.status` **or** `flagged === 'w'` (→ loss/timeout) **or** `resigned`
  (→ loss/resignation).
- `resign(): void` — aborts any in-flight model call (bump generation ref +
  `abortRef.current?.abort()`, as `newGame` does) and sets `resigned`. Exposed as an
  action; the UI enables it only while the game is live (`!outcome.over`).
- **Recording effect:** when `outcome.over` transitions to `true` and the game has not
  yet been recorded (a `recordedRef` guard), build a `GameRecord` (`opponent` from the
  `model` option with a non-empty fallback, `elo`, `plies = state.history.length`,
  `result`/`reason` from `outcome`) and call `appendGame`. Fires **once** per finished
  game.
- `newGame` additionally: `reset()` the clock, clear `resigned`, clear `recordedRef`.
- Expose to the view: `whiteClock`/`blackClock` (formatted strings), whichever side is
  active for the strip highlight, `resign`, and `outcome` (for status text).

### 5. `GameScreen` wiring

- Feed real formatted clock strings + `active` flags into both `PlayerStrip`s (remove
  the hardcoded `"10:00"`). White strip active on White's turn; Black strip active on
  Black's turn (frozen value, but the active styling still reflects whose turn it is).
- `statusView` gains two cases driven by `outcome.reason`:
  - `timeout` → e.g. «Поражение — время» / "Loss — time".
  - `resignation` → e.g. «Поражение — сдача» / "Loss — resigned".
  Existing mate/draw/turn/check text is unchanged.
- Pass `onResign` into `MoveList` and enable the Resign button while the game is live.
  **Two-step inline confirm:** first click flips the button label to a confirm state
  («Точно?» / "Sure?"); a second click within that state resigns; clicking elsewhere
  or a short timeout reverts. Keep **Offer Draw** disabled.

### 6. `HistoryScreen`

- Read `loadGames()` at mount (via a `useState` initializer / `useMemo`; the screen
  router remounts the History screen on navigation, so a mount-time read is fresh).
  Compute `gameStats(games)`.
- **Remove** the opening column (drop the `col_open` `<th>` and its `<td>`).
- **Empty state:** when `games.length === 0`, render a friendly panel (localized)
  instead of the table; the four stat tiles show `0` / `—`.
- Format `endedAt` with `toLocaleDateString('ru-RU' | 'en-US', { day: 'numeric',
  month: 'short' })`. Length column shows full moves (`Math.ceil(plies / 2)`). Result
  badge reuses the existing `res win|loss|draw` styling and `t(result)` labels.

### 7. i18n (`src/ui/app/i18n.tsx`)

- Reuse existing `resign`, `win`/`loss`/`draw`, `st_draw`, mate/draw-reason keys.
- **Add** (RU + EN): resign confirm label (`resign_confirm`), timeout-loss status
  (`st_time_loss`), resignation-loss status (`st_resign_loss`), and history empty
  state (`lb_empty`).
- Stop rendering `col_open` (the key may remain unused, or be removed — implementer's
  choice; prefer removing to avoid a dead key).
- Extend the i18n parity test to cover the new keys.

## Testing (TDD)

- **`gameHistory.test.ts`** — `loadGames` on empty/corrupt storage → `[]`; `appendGame`
  prepends and caps at 50; `gameStats` arithmetic incl. `played === 0` guard, streak
  from newest, best/empty.
- **`useChessClock.test.ts`** — ticks the active side down while `running`; pauses when
  `running` is false; flags `'w'` at 0; `reset` restores. (Use fake timers.)
- **`useGame.test.ts`** (extend) — resign → `outcome` loss/resignation, one record
  appended; timeout → loss/timeout recorded; mate/draw recorded exactly once;
  abandoned (newGame before end) → **no** record; clock frozen while `thinking`.
  Model calls mocked via the existing `selectMoveFn` seam; `localStorage` asserted or
  mocked.
- **`HistoryScreen.test.tsx`** (rewrite) — empty state when no games; renders real
  records; **no** opening column; stats reflect records.
- **`GameScreen.test.tsx`** (extend) — Resign button flow (two-step confirm); clock
  strings rendered; timeout/resign status text.
- **i18n parity** — new keys present in both languages.

Network is never hit; the LLM boundary stays mocked via `selectMoveFn`.

## Files

**New**

- `src/ui/history/gameHistory.ts` (+ `gameHistory.test.ts`)
- `src/ui/game/useChessClock.ts` (+ `useChessClock.test.ts`)

**Modified**

- `src/ui/game/useGame.ts` — clock composition, `resign`, outcome, recording effect
- `src/ui/game/GameScreen.tsx` — real clocks, resign wiring, timeout/resign status
- `src/ui/game/MoveList.tsx` — enable Resign, two-step confirm, `onResign` prop
- `src/ui/history/HistoryScreen.tsx` — real data, empty state, drop opening column
- `src/ui/app/i18n.tsx` — new keys (+ parity test)
- `src/ui/app/demoData.ts` — remove `HISTORY`/`HistoryEntry`/`historyStats`; keep
  `ELO_BANDS`/`eloBand`
- `src/ui/app/demoData.test.ts` — drop history-stats tests (moved to `gameHistory.test.ts`)

## Non-goals (this cycle)

- Real hints / `HintConsole` activation.
- Commentary adapter (`chess-gemma-commentary`).
- Configurable time control, increment, or Offer Draw.
- Draw offers, takebacks, or in-game clock pausing beyond the thinking freeze.
- Persisting an in-progress game across reloads (only finished games are stored).

## Accepted defaults

- Length = full moves (`Math.ceil(plies / 2)`).
- Resign confirmation = inline two-step (no modal).
- History cap = 50 games.
- Initial time = 10:00 (600 000 ms) per side.
