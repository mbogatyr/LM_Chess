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
a "model is thinking" state, and a connection banner with retry. The model only
_proposes_ moves; the engine always _judges_ legality (illegal or unparseable
replies are retried, then fall back to a random legal move). Move selection runs
through a per-model adapter layer (`src/llm/adapters`) with a generic default,
so specialised chess models can be added without touching the engine.

Not yet built: real match history / clocks / game persistence and real hints —
so the history screen is still **presentational on demo data**, and the game's
hint panel and clocks are inert. The appearance picker (board palette / piece
style) is also not implemented yet. See `CLAUDE.md` for the full picture and
what's next.
