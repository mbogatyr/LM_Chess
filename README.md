# LM_Chess — NeuroChess

[![CI](https://github.com/mbogatyr/LM_Chess/actions/workflows/ci.yml/badge.svg)](https://github.com/mbogatyr/LM_Chess/actions/workflows/ci.yml)

**Play chess against a large language model running on your own machine.**
No backend, no API keys, no cloud — the app is static files in your browser,
and the opponent is whatever model you have loaded in
[LM Studio](https://lmstudio.ai/).

**Live app:** **https://chess.bogatyrev.uk**
(bring your own LM Studio — see [Using the hosted app](#using-the-hosted-app))

## The idea

An LLM is a strange chess opponent: it has read millions of games but has no
board in its head. It will happily suggest a move that is simply illegal.
LM_Chess is built around that fact, and three constraints follow from it:

1. **The engine owns the rules, never the model.** [chess.js](https://github.com/jhlywa/chess.js)
   decides what is legal and when the game is over. The model only _proposes_
   a move and explains it; every proposal is validated. An illegal or
   unparseable answer is retried with a correction, and only then falls back
   to a random legal move — so the game can never enter an impossible state.
2. **The model is yours and it is local.** Every request goes to LM Studio on
   `http://localhost:<port>`. Nothing leaves your machine, there is no
   account, and there are no secrets in this repo.
3. **No backend.** The build output is plain static files, deployable to any
   static host.

## Quick start

You need **Node.js 20+** and **LM Studio** with at least one chat model
downloaded.

**1 — Start the model server.** In LM Studio open the _Developer_ tab, load a
model, and start the server (default `http://localhost:1234`). Enable **CORS**
in the server settings — the browser will refuse the requests otherwise.

**2 — Run the app.**

```bash
npm install
npm run dev
```

Open the printed URL, confirm the server address, pick your model, and play.
You are White; the model is Black.

## How it works

Three responsibilities are kept strictly apart — `llm/` never imports `ui/`,
and neither of them decides chess rules:

| Layer        | Path          | Responsibility                                                          |
| ------------ | ------------- | ----------------------------------------------------------------------- |
| Rules/state  | `src/engine/` | A thin, pure `chess.js` wrapper: legal moves, check/mate/draw taxonomy. |
| Model I/O    | `src/llm/`    | LM Studio discovery, chat/completion transports, move selection, hints. |
| Presentation | `src/ui/`     | The NeuroChess interface: onboarding, game screen, match history.       |

A move is chosen like this:

```
position ─▶ ModelAdapter (per-model prompt) ─▶ LM Studio ─▶ parse
                                                              │
                     ┌── legal? ── yes ──▶ play ◀─────────────┘
                     │
                     └── no ──▶ retry with a correction ──▶ still no? ──▶ random legal move
```

The **`ModelAdapter`** layer (`src/llm/adapters/`) is what makes different
models workable. Each adapter owns one model family's prompt format, decoding
parameters, and parser; `resolveAdapter(modelId)` picks one, falling back to a
generic FEN-only adapter for unknown models. Adding support for a new model
means writing an adapter — the engine and the UI stay untouched.

### Prompt Lab

The adapters aren't guesswork. `tools/prompt-lab/` is a small evaluation
harness that races prompt variants against a benchmark of 1,000 positions
sampled from 2,305 Karpov games, scoring each variant on how often it matches
the master's move and how often it answers with a legal move at all.

Tuning with it moved the needle sharply — for `gemma-4-12b`, first-answer
legality went from 60.5% to 94.7%, so the random-move safety net now fires in
about 5% of positions instead of 40%. Reports:
[`docs/prompt-lab/`](docs/prompt-lab/).

```bash
npm run prompt-lab -- race --model <model-id> --reasoning-effort none
```

## Features

- **A real game.** Click-to-move with legal-move highlighting, promotion
  picker, check/checkmate/stalemate/draw status, live move list, resign,
  new game.
- **Live clocks.** 10:00 a side, symmetric: the model's clock ticks while it
  thinks and it _can_ flag — run it out of time and you win on time. Its
  clock pauses only for infrastructure (connection errors, retry backoff), so
  a server hiccup doesn't burn its time.
- **Hints from the model.** On your turn, ask for the best move and reveal it
  progressively: which piece → the idea → the exact move, highlighted on the
  board. The engine validates it, so a hint is never a random move; if the
  model can't produce a legal one, the panel says so.
- **Match history.** Every finished game is saved in your browser
  (`localStorage`, last 50) and listed with date, opponent, length, and
  result, plus win-rate and streak stats.
- **Animation and polish.** Pieces slide between squares (yours and the
  model's, honouring `prefers-reduced-motion`), captures and checks are
  highlighted, and a win triggers canvas fireworks with a synthesized
  fanfare — no image or audio assets.
- **Recommended models.** The model picker stars ★ the models that were
  actually tested in real games and a «Recommended models» popup ranks them
  with a one-line verdict each — curated in
  [`recommendedModels.json`](src/ui/onboarding/recommendedModels.json).
- **Bilingual.** Full RU/EN interface, switchable at any time.

## Using the hosted app

The deployed page is served over HTTPS but talks to LM Studio over plain HTTP
on `localhost`. Two things to know:

- **Enable CORS in LM Studio** so it accepts requests from the site's origin.
- **Safari does not work with the hosted app.** WebKit blocks
  `http://localhost` requests from an HTTPS page as mixed content; Chrome,
  Edge, and Firefox treat loopback as trustworthy and allow it. In Safari, run
  the app locally over `http://` (`npm run dev`) instead.

## Project layout

```
src/
  engine/            chess.js wrapper — rules and game state
  llm/               LM Studio client, transports, move selection, hints
    adapters/        per-model prompt/parse strategies + generic default
  ui/
    app/             i18n (RU/EN), app state, screen routing
    shell/           window chrome and topbar
    onboarding/      connect → choose model
    game/            board, clocks, move list, hints, victory overlay
    history/         persisted match history
tools/prompt-lab/    prompt evaluation harness (sample / eval / race / compare)
docs/
  prompt-lab/        campaign reports
  superpowers/       design specs and implementation plans
  design-reference/  the vendored Nocturne UI prototype (read-only)
```

## Development

```bash
npm run dev          # dev server
npm run build        # tsc -b && vite build → dist/
npm run preview      # preview the production build
npm test             # vitest run
npm run test:watch   # vitest in watch mode
npm run lint         # eslint .
npm run typecheck    # tsc -b
npm run format       # prettier --write .
npm run format:check
```

The quality gate below mirrors CI exactly — run it before pushing:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

**Stack:** Vite 6, React 18, TypeScript 5 (strict), Vitest +
@testing-library/react, ESLint 9, Prettier 3, chess.js. Single package, npm,
no monorepo tooling.

Features are developed spec → plan → implementation; the design documents live
in [`docs/superpowers/`](docs/superpowers/). Working conventions and the
non-obvious decisions behind the code are documented in
[`CLAUDE.md`](CLAUDE.md).

## Deployment

`.github/workflows/azure-swa.yml` publishes to **Azure Static Web Apps**: a
push to `main` builds with Node 20 and deploys `dist/` to production, and each
pull request gets its own preview environment that is torn down when the PR
closes. Authentication uses a deployment token in the repo secret
`AZURE_STATIC_WEB_APPS_API_TOKEN`. The quality gate in `ci.yml` is a separate
workflow.

Any static host works — the build has no server-side component.
