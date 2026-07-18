# Victory celebration (fireworks + fanfare) — design

**Date:** 2026-07-18
**Status:** approved (short spec; implemented directly via TDD, no separate plan doc)

## Problem

When the human wins there is no celebration. Add a fireworks animation over the
board and a short fanfare so a win feels rewarding.

## Decision

On a human **win** (`useGame` `outcome.result === 'win'` — checkmate by White,
or the model flagging on time), play a canvas fireworks burst over the board and
a synthesized fanfare, **once per win**, with a persistent sound-mute toggle.

Confirmed choices (brainstorm):

- **Sound:** synthesized with the Web Audio API (`OscillatorNode` arpeggio) — no
  asset, no dependency, no copyright. If the `AudioContext` is suspended
  (autoplay policy) it silently no-ops.
- **Fireworks:** a lightweight `<canvas>` particle overlay **over the board**
  (the board wrapper is already `position: relative`), `pointer-events: none`,
  self-terminating after ~2–3s.
- **Mute:** a small toggle on the overlay that mutes **sound only** (fireworks
  always play); default **on**; the choice **persists** in `localStorage`.

## Components (one responsibility each)

### `src/ui/game/fireworks.ts` — imperative, no React

`runFireworks(canvas: HTMLCanvasElement): () => void` — launches a few particle
bursts (gravity + fade) via `requestAnimationFrame`, returns a `stop()` that
cancels the animation and clears the canvas. Self-terminates after the last
burst fades. Not unit-tested (canvas); verified live.

### `src/ui/game/fanfare.ts` — imperative, no React

`playFanfare(): void` — lazily creates/resumes a shared `AudioContext` and plays
a short triad arpeggio through an `OscillatorNode` + `GainNode` envelope. Guards
everything: if Web Audio is unavailable or the context can't resume, it no-ops.
Not unit-tested (audio); verified live.

### `src/ui/game/useSoundPref.ts` — persisted mute (TDD)

`useSoundPref(): { muted: boolean; toggle: () => void }`. Backed by
`localStorage` key `lmchess.sound` (value `'off'` = muted; absent/other = on, so
the default is **on**). `toggle` flips and persists.

### `src/ui/game/VictoryOverlay.tsx` — React (TDD via seams)

Rendered only while the human has won. Props (all optional, real defaults):

```
VictoryOverlay({
  runFireworksFn = runFireworks,
  playFanfareFn = playFanfare,
})
```

On mount (once): render a `<canvas>` (`pointer-events: none`), call
`runFireworksFn(canvas)`, and call `playFanfareFn()` **iff** not muted (from
`useSoundPref`). Renders one interactive control — a sound toggle button
(`useSoundPref().toggle`) with an `aria-label` from i18n. On unmount, call the
`stop()` returned by `runFireworksFn`.

### `src/ui/game/GameScreen.tsx` — wire-in

Inside the board's existing `position: relative` wrapper, render
`{g.outcome.result === 'win' && <VictoryOverlay />}`. The overlay mounts once
when `result` becomes `'win'` and unmounts on New Game — this gives the
"once per win" behavior structurally (no per-render guard needed).

### `src/ui/app/i18n.tsx` — copy

Add RU/EN keys for the toggle's `aria-label`: `sound_on` / `sound_off`.

## Testing (TDD where meaningful)

- `useSoundPref.test.ts`: default is on; `toggle` mutes and persists to
  `localStorage`; a pre-set `'off'` is read back as muted.
- `VictoryOverlay.test.tsx` (with injected seams):
  - On mount, `runFireworksFn` is called once.
  - With sound on, `playFanfareFn` is called once; with sound muted, it is not.
  - The sound toggle flips the persisted preference.
- Canvas animation and real audio are verified **live**, not unit-tested.

## Out of scope

- A victory banner/text (the status panel already announces the result).
- Celebrating draws or losses.
- Configurable fanfare/animation; screen-wide fireworks.

## Follow-up docs

After implementation: mark the "Victory fireworks + fanfare" item done in
`CLAUDE.md`, the backlog, and memory.
