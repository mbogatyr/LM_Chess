# LM_Chess

A frontend-only chess app for playing and learning chess, using local LLM
models from LM Studio as the engine. Deployable to static hosting (Azure Blob
Storage / Azure Static Web Apps).

## Prerequisites

- Node.js 20+
- npm

## Getting Started

```bash
npm install
npm run dev
```

## Available Scripts

- `dev` - start the local development server
- `build` - type-check and build for production
- `preview` - preview the production build locally
- `test` - run the test suite
- `lint` - run ESLint
- `typecheck` - run the TypeScript compiler in check-only mode
- `format` - format the codebase with Prettier

## Status

The LM Studio connection (real HTTP client + connection hook) and the full
**NeuroChess / Nocturne** UI shell are implemented: onboarding wizard (connect
to a local LM Studio server, list and load models, pick an ELO level), a game
screen, and a history screen.

A real chess engine (`chess.js` wrapper in `src/engine`) owns the rules, and the
**game screen is a real game against the model**: you play **White**, a local
LM Studio model plays **Black** — click-to-move with legal-move highlighting, a
live move list, turn/check/checkmate/draw status, a promotion picker, New Game,
a "model is thinking" state, real per-side clocks, a **Resign** button, and a
connection banner with retry. The model only _proposes_ moves; the engine always
_judges_ legality (illegal or unparseable replies are retried, then fall back to
a random legal move). Move selection runs through a per-model adapter layer
(`src/llm/adapters`) with a generic default, so specialised chess models can be
added without touching the engine.

**Match history, persistence, and clocks are real.** Each finished game
(checkmate / draw / timeout / resignation) is recorded to a persistent
match-history list (stored in the browser via `localStorage`) and shown on the
history screen — no more demo data. Both clocks start at 10:00 per side and are
live and symmetric: the model's clock ticks down while it thinks and it can
flag — running the model out of time wins on time, just as running White out of
time loses. The model's clock pauses only on infrastructure (the
connection-error banner and the automatic retry backoff), so a server hiccup
doesn't burn its time.

**Hints are real too.** On your turn the hint panel asks the connected model for
one recommended move and reveals it progressively — which piece to move, the
idea behind it, then the exact move with the squares highlighted on the board.
The engine validates the suggestion (a hint is never a random move); if the
model can't produce a legal hint the panel says so rather than guessing.

**Winning is celebrated.** When you win — checkmate, or the model running out of
time — a canvas fireworks burst plays over the board with a short synthesized
fanfare (Web Audio, no audio files), once per win.

Not yet built: a commentary-model adapter (a model that _comments on_ a played
move). See `CLAUDE.md` for the full picture and what's next.
