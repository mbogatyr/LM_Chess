# Live model clock — design

**Date:** 2026-07-18
**Status:** approved (short spec; implemented directly via TDD, no separate plan doc)

## Problem

By the D₁ decision, Black's (the model's) clock is **frozen** while the model
thinks — its whole turn is covered by the `thinking` flag, so the clock never
ticks and sits at `10:00`. This was to avoid the model flagging on slow local
hardware, but the practical effect is a clock that **reads as non-functional**.

## Decision

**Unfreeze the model's clock.** Both sides get symmetric `10:00`. The model's
clock ticks down while it is the model's move, and the **model can lose on
time** — a Black flag is a **win for the human** (reason `timeout`).

This **supersedes the D₁ decision** to freeze Black. The slow-hardware risk is
accepted as intended behavior: a symmetric real chess clock.

Confirmed choices during brainstorm:

- Meaning of the clock: a **real countdown that can flag** (not an
  elapsed-thinking stopwatch, not a no-flag soft limit).
- Budget: **symmetric 10:00** (no larger budget, no per-move increment/delay).
- Connection failures: the model's clock **pauses** while blocked on
  infrastructure — the `connectionError` banner (indefinite, waits for user
  retry) **and** the automatic retry backoff. "Thinking" ticks; "server is
  down / retrying" does not.

## Changes

### `src/ui/game/useChessClock.ts` — flag either side

- `flagged: 'w' | 'b' | null` (currently `'w' | null`). Return `'b'` when
  `blackMs <= 0`, `'w'` when `whiteMs <= 0`, else `null`.
- Tick mechanics unchanged — the hook already decrements whichever side `turn`
  names while `running`.

### `src/ui/game/useGame.ts` — compose the Black clock + Black-flag outcome

- **Clock running.** Broaden `clockRunning` so it is true when either:
  - White's live turn (as today: `turn==='w' && !over && !resigned &&
!pendingPromotion && !connectionError`), **or**
  - The model is genuinely thinking:
    `turn==='b' && thinking && !connectionError && !retrying`.
- **Pause on infrastructure.** Introduce a small `retrying` state, set `true`
  around the backoff `sleep` in the model-turn effect and cleared before the
  next attempt, so the Black clock does not tick during auto-retries. The
  `connectionError` banner already excludes ticking via the guard above.
- **Outcome generalised.** Replace `timedOut = flagged === 'w'` with handling
  for both sides:
  - `flagged === 'w'` → human `loss`, reason `timeout` (unchanged).
  - `flagged === 'b'` → human `win`, reason `timeout` (new).
- **Abort on Black flag.** When the model flags mid-`thinking`, bump
  `generation.current` and `abortRef.current?.abort()` so the in-flight
  `selectMove` result is discarded and the model-turn effect stops. The
  effect's guard/deps include the flag so it will not (re)start once flagged.

### Recording / history — no new types

`MatchResult` already has `'win'` and `EndReason` already has `'timeout'`, so a
Black-timeout win records through the existing once-guarded `appendGame` path
with `{ result: 'win', reason: 'timeout' }`.

### UI — no changes

`GameScreen` already passes `blackClock` and `active`; `PlayerStrip` already
renders them. The Black strip simply ticks now.

## Testing (TDD)

- `useChessClock.test.ts`: `flagged === 'b'` once `blackMs` is exhausted
  (drive with a small `initialMs` seam).
- `useGame.test.ts`:
  - The Black clock ticks down while `thinking` (was frozen).
  - A Black flag ends the game as a human **win** (`outcome.result === 'win'`,
    `reason === 'timeout'`), game over, recorded exactly once.
  - The Black clock **pauses** while `connectionError` is set.
  - The Black clock **pauses** during the auto-retry backoff.

## Out of scope

- Elapsed-thinking display / stopwatch mode.
- Per-move increment or delay time controls.
- Configurable or asymmetric budgets.

## Follow-up docs

After implementation, refresh `CLAUDE.md` and the backlog: remove the "model
clock is frozen" follow-up and note that the D₁ freeze decision is superseded.
