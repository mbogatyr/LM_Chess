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
screen, and a history screen. The game and history screens are currently
**presentational, running on hardcoded demo data** — there is no real chess
engine yet, so moves, the board position, and match history don't reflect
actual play. Real chess rules (`chess.js`) and the appearance picker (board
palette / piece style) are not implemented yet. See `CLAUDE.md` for the full
picture and what's next.
