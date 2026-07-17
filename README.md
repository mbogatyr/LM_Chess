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

A real chess engine (`chess.js` wrapper in `src/engine`) now owns the rules, and
the **game screen is playable**: you can play a full game in **hotseat** (one
person moving both sides) — click-to-move with legal-move highlighting, a live
move list, turn/check/checkmate/draw status, a promotion picker, and New Game.

Not yet built: the **LLM opponent** (the model choosing and playing moves), and
real match history / clocks / game persistence — so the history screen is still
**presentational on demo data**, and the game's hint panel and clocks are inert.
The appearance picker (board palette / piece style) is also not implemented yet.
See `CLAUDE.md` for the full picture and what's next.
