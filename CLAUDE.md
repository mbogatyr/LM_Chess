# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository. Read this first in any new session.

## What this project is

**LM_Chess** is a **frontend-only** web app for **playing and learning chess**, where the "thinking" opponent/tutor is a **local LLM served by LM Studio**, reached over HTTP at `http://localhost:<port>`.

Hard product constraints (these shape every decision):

- **No backend.** The app is static files only, deployable to any static host (Azure Blob Static Website, Azure Static Web Apps). Do not introduce a server, serverless functions, or a database.
- **The LLM is local and user-supplied.** All model calls go to LM Studio on `localhost`. There are no cloud API keys, no secrets in the repo, and no per-user auth.
- **Chess rules are owned by a library, never by the LLM.** Move legality, check/checkmate/draw detection use a battle-tested library (`chess.js`, planned). The LLM only _selects_ and _explains_ moves; it never adjudicates legality.

Primary MVP scenario: a human plays a full game against the LLM. Teaching/explanation features come later.

## Tech stack

| Concern               | Choice                                                 |
| --------------------- | ------------------------------------------------------ |
| Build / dev server    | Vite 6                                                 |
| UI                    | React 18 + TypeScript 5 (strict)                       |
| Unit tests            | Vitest + @testing-library/react (jsdom)                |
| Lint                  | ESLint 9 (flat config) + typescript-eslint             |
| Format                | Prettier 3                                             |
| Package manager       | **npm** (commit `package-lock.json`; CI uses `npm ci`) |
| CI                    | GitHub Actions                                         |
| Chess rules (planned) | chess.js                                               |

Single package at the repo root — **no monorepo tooling**. Separation of concerns is by folder, not by package.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build  → static output in dist/
npm run preview    # preview the production build
npm test           # vitest run (one-shot)
npm run test:watch # vitest watch mode
npm run lint       # eslint .
npm run typecheck  # tsc -b   (see note below)
npm run format     # prettier --write .
npm run format:check
```

The **local quality gate mirrors CI exactly** — run this before pushing:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

## Project structure

```
src/
  engine/   # chess.js wrapper (rules/state) — DONE: types.ts, game.ts (newGame/move/legalMoves) (+ tests)
  llm/      # LM Studio HTTP client — DONE: client.ts, types.ts, url.ts (+ tests)
  ui/
    app/        # i18n (RU/EN), app-state screen router, demo data (ELO_BANDS, HISTORY, historyStats)
    shell/      # window chrome + Topbar (brand, Game/History tabs, connection pill, RU/EN toggle)
    onboarding/ # wizard: Connect → Models → ELO (Connect/Models wired to useConnection; ELO is presentational)
    game/       # static presentational game screen on demo data (Board, Piece, PlayerStrip, MoveList, HintConsole)
    history/    # static presentational History screen on demo data (stat tiles + match table)
    useConnection.ts  # LM Studio connection hook (wraps src/llm)
  App.tsx   # real app entry — routes screen state to the shell + screens above
  main.tsx
  App.test.tsx
  test/setup.ts   # registers jest-dom matchers
```

`engine/` now has a real core: a pure `chess.js` wrapper (`newGame`/`move`/`legalMoves`, full game-status taxonomy) with its own test suite — no React, no UI wiring. `llm/` and `ui/` are real and built too. Keep these three responsibilities separate as the app grows: **rules/state** (`engine/`), **LLM I/O** (`llm/`), and **presentation** (`ui/`) must not bleed into each other. Everything currently in `ui/game/` and `ui/history/` is still **presentational only, on hardcoded demo data** — wiring them up to the new `engine/` core (and dropping the demo data) is the next work, tracked as sub-projects B/C/D.

## Development standards

- **TypeScript strict is on.** No `any` escape hatches without a comment justifying them; prefer precise types.
- **Formatting is enforced by Prettier and checked in CI** (`format:check`). Config: no semicolons, single quotes, trailing commas, 80-col. Run `npm run format` before committing.
- **Lint must pass** (`eslint .`) — includes react-hooks rules.
- **Keep files focused.** One clear responsibility per file with a well-defined interface. When a file grows unwieldy, that's a signal to split by responsibility.
- **No secrets, ever.** There's nothing to authenticate against; don't add API keys or `.env` values that would need to ship.
- **Commit messages**: conventional prefixes (`feat:`, `fix:`, `chore:`, `ci:`), imperative mood.

### Testing

- Tests live next to source (`*.test.tsx` / `*.test.ts`) and run under Vitest with `globals: true` and the jsdom environment.
- Test **behavior**, not implementation — query by role/text via Testing Library, assert what the user observes.
- The existing `src/App.test.tsx` is an **infrastructure smoke test** proving the toolchain (transform → render → query → matchers) works. It stays green; replace/extend it as real UI arrives.
- When wiring the LM Studio client, do not hit a real model in unit tests — the network boundary must be mockable (isolate it behind the `src/llm` interface).

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`, on Node 20:

```
npm ci → lint → format:check → typecheck → test → build
```

A PR should not merge unless this is green. There is **no deploy step** yet — static hosting (Azure) deployment is a separate future task.

## Non-obvious decisions & gotchas

- **`typecheck` is `tsc -b`, not `tsc --noEmit`.** The project uses composite project references (`tsconfig.json` → `tsconfig.node.json`), and TypeScript's build mode rejects `--noEmit` (TS6310). `tsc -b` still type-checks fully and fails on any error. Don't "fix" it back to `--noEmit`.
- **TS build artifacts are redirected out of the repo root.** `tsBuildInfoFile` and the vite-config declaration output go to `node_modules/.tmp/` (gitignored), plus `*.tsbuildinfo` is in `.gitignore`. If you touch the tsconfig topology, keep build output from leaking into the repo root.
- **Calling `http://localhost` from an HTTPS static host** (Azure) will need LM Studio to send CORS headers for the site's origin, and relies on browsers treating `http://localhost` as a "potentially trustworthy origin". Verify this explicitly when the LLM integration is built — don't assume.
- `.superpowers/` is agent scratch (gitignored, excluded from Prettier). Not part of the product.

## How we work: Superpowers methodology

This project is developed with the **Superpowers** plugin. For any non-trivial change, follow the process — don't jump straight to code:

1. **Brainstorm** (`superpowers:brainstorming`) — explore intent and design _before_ implementation. Produces a spec.
2. **Spec** → saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, committed, and reviewed by the user.
3. **Plan** (`superpowers:writing-plans`) — a bite-sized, TDD-oriented implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`.
4. **Execute** (`superpowers:subagent-driven-development`) — fresh implementer subagent per task, spec+quality review after each, final whole-branch review before finishing.
5. **Finish** (`superpowers:finishing-a-development-branch`) — merge locally or open a PR; verify CI green.

Other standing rules:

- **Feature branches, not `main`.** Implementation work happens on a branch (e.g. `feat/<topic>`); integrate via PR or explicit merge.
- **TDD by default** for features and bugfixes (`superpowers:test-driven-development`).
- Invoke a relevant skill _before_ acting on a task, not after.

### Existing design docs

- Environment/test/CI foundation — spec: `docs/superpowers/specs/2026-07-11-environment-setup-design.md`, plan: `docs/superpowers/plans/2026-07-11-environment-setup.md`.
- LM Studio connection engine (`src/llm`, `useConnection`) — spec: `docs/superpowers/specs/2026-07-11-lm-studio-connection-design.md`, plan: `docs/superpowers/plans/2026-07-11-lm-studio-connection.md`.
- Nocturne design-system port ("Gambit Local" prototype → NeuroChess UI), overall spec: `docs/superpowers/specs/2026-07-11-nocturne-design-port-design.md`. Phased:
  - Phase 1 (shell + wired onboarding) — plan: `docs/superpowers/plans/2026-07-11-nocturne-port-phase-1.md`.
  - Phase 2 (static game screen) — spec: `docs/superpowers/specs/2026-07-13-nocturne-port-phase-2-game-screen-design.md`, plan: `docs/superpowers/plans/2026-07-13-nocturne-port-phase-2.md`.
  - Phase 3 (History screen + topbar tabs) — spec: `docs/superpowers/specs/2026-07-13-nocturne-port-phase-3-history-design.md`, plan: `docs/superpowers/plans/2026-07-13-nocturne-port-phase-3.md`.

- Real gameplay track (chess.js). Decomposed into sub-projects A→B→C→D.
  - Sub-project A — engine core (`src/engine`, chess.js wrapper) — spec: `docs/superpowers/specs/2026-07-16-engine-core-chess-js-design.md`, plan: `docs/superpowers/plans/2026-07-16-engine-core.md`. **DONE.**

The full Nocturne prototype (markup/copy source of truth) is vendored read-only at `docs/design-reference/gambit-local/`.

## What's next (not yet built)

- **Appearance feature** (deferred from Phase 3): the `◧` topbar button, the appearance sheet, and the board-palette / piece-style pickers. `appState.boardStyle`/`pieceStyle` and their setters already exist and are read by `Board`, but there is no UI to change them yet. Needs its own brainstorm → spec → plan cycle.
- **Real gameplay** (`chess.js`), decomposed into sub-projects, of which **A is done**:
  - **A — engine core** (`src/engine`): pure chess.js wrapper — `newGame`/`move`/`legalMoves`, full check/checkmate/stalemate/draw taxonomy, engine-owned board matrix and types. **DONE** (this is rules/state only; no UI, no LLM).
  - **B — interactive human play**: wire `ui/game` to the engine (click select→move, legal-move highlighting, real move list, game-over). Not built.
  - **C — LLM opponent**: chat-completion call in `src/llm` + a move-selection layer that validates the model's move against the engine's legal set and retries. Not built.
  - **D — real history + persistence**: finished game → History entry (replacing demo data), real hints, clocks. Not built.
  - `ui/game` and `ui/history` remain **presentational, on demo data** until B/C/D wire them to the engine.
- Each of the above gets its own spec → plan → implementation cycle, per the Superpowers methodology below.
