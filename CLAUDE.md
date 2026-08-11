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
npm run prompt-lab -- <command>  # move-prompt evaluation harness (see tools/prompt-lab)
npm run prompt-lab -- race --model <id> --reasoning-effort none  # run a campaign for a new model
```

The **local quality gate mirrors CI exactly** — run this before pushing:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

## Project structure

```
src/
  engine/   # chess.js wrapper (rules/state) — DONE: types.ts, game.ts (newGame/move/legalMoves) (+ tests)
  llm/      # LM Studio I/O + move selection — DONE: client.ts (discovery/load), chat.ts (chat+completion transports), adapters/ (ModelAdapter strategy: types, encoding, genericFen default, index/resolveAdapter), selectMove.ts (parse→validate→retry→random fallback), types.ts, url.ts (+ tests)
  ui/
    app/        # i18n (RU/EN), app-state screen router, demo data (ELO_BANDS for onboarding)
    shell/      # window chrome + Topbar (brand, Game/History tabs, connection pill, RU/EN toggle)
    onboarding/ # wizard: Connect → Models (ELO step hidden 2026-08-11 — OnboardingElo stays in the tree unrendered; elo state still feeds prompts at its stored/default value)
    game/       # interactive game screen — human (White) vs local model (Black) via useGame over src/engine + src/llm/selectMove (Board[hintMove highlight], PromotionPicker, MoveList[Resign two-step confirm], PlayerStrip[real clocks], useChessClock, connection banner, fallback note, HintConsole[real LLM hints via useHint + src/llm/hint], VictoryOverlay[fireworks + fanfare on a win: fireworks.ts/fanfare.ts, sound always on], usePieceSlide[FLIP move animation via slideAnimation.ts]) (visible ELO hidden 2026-08-11 from both PlayerStrips — the elo prop stays wired into useGame/useHint prompts unchanged)
    history/    # History screen on real persisted games — gameHistory.ts (GameRecord list + gameStats in localStorage) (stat tiles + match table + empty state) (visible ELO hidden 2026-08-11 — the "Best ELO" stat tile and the table's ELO column are hidden; GameRecord.elo and gameStats().best stay computed)
    useConnection.ts  # LM Studio connection hook (wraps src/llm)
  App.tsx   # real app entry — routes screen state to the shell + screens above
  main.tsx
  App.test.tsx
  test/setup.ts   # registers jest-dom matchers
tools/prompt-lab/  # standalone move-prompt evaluation harness (sample/eval/race/compare), run via vite-node; committed 1000-position benchmark generated from karpov.pgn — see docs/superpowers/specs/2026-08-10-prompt-lab-design.md; two campaign reports live in docs/prompt-lab/
```

`engine/` has a real core: a pure `chess.js` wrapper (`newGame`/`move`/`legalMoves`, full game-status taxonomy) with its own test suite — no React, no UI wiring. `ui/game/` is now a **real game vs the model**: the human plays **White**, a local LM Studio model plays **Black**. `useGame` drives it over the engine + `src/llm/selectMove` — real legal-move highlighting, move list, turn/result status, check + last-move, a promotion picker, New Game, a "model is thinking" state, a connection-error banner with retry, and a fallback note when the model's move couldn't be parsed. Move selection goes through a universal `ModelAdapter` strategy (`src/llm/adapters`, injected by `resolveAdapter(modelId)` with a generic FEN-only default) so per-model prompt/parse formats can be added without touching the engine; the **engine always judges legality** (illegal/unparseable → retry with correction → random legal fallback). Keep the three responsibilities separate as the app grows: **rules/state** (`engine/`), **LLM I/O + move selection** (`llm/`), and **presentation** (`ui/`) must not bleed into each other (`llm` must not import `ui`). `ui/history/` now renders **real finished games** from `src/ui/history/gameHistory.ts` (localStorage-persisted `GameRecord`s under key `nocturne-chess-games`, cap 50; empty state; no demo data), and `ui/game/` has **live per-side clocks** (`useChessClock`, 10:00/side, symmetric — Black ticks while the model thinks and **can flag** → the human wins on time; the model's clock pauses on infrastructure, i.e. the connection-error banner and the retry backoff) plus a wired **Resign** button — `useGame` records each finished game (mate/draw/timeout/resignation) exactly once. This live model clock **supersedes the earlier D₁ decision** to freeze Black. The `HintConsole` is now **live**: `useHint` + `src/llm/hint.ts` ask the connected model for one best move (validated by the engine, never a random fallback), revealed progressively (piece type → idea → exact move + a `Board` `hintMove` highlight). When the human **wins** (`outcome.result === 'win'`), a `VictoryOverlay` fires once over the board — canvas fireworks (`src/ui/game/fireworks.ts`) + a synthesized Web Audio fanfare (`src/ui/game/fanfare.ts`, layered voices + a sustained chord through a compressor); sound is always on (no controls); frontend-only, no assets. Moves are **animated**: the moving piece slides from its old square to the new one via a FLIP (`src/ui/game/slideAnimation.ts` + `usePieceSlide` in `Board`) over the existing `.piece` CSS transition — no CSS changes; both the human's and the model's moves slide; honors `prefers-reduced-motion`. Sub-project D is complete — the once-planned commentary-model adapter (D₃) was **cancelled** (2026-08-10), so the gameplay track has nothing outstanding.

Move selection now has two real per-model adapters found with Prompt Lab: `gemma4` (legal-move-list prompt + `reasoningEffort: 'none'`; campaign: match 9.8% vs 7.8% baseline, legality 94.7% vs 60.5%) and `qwen35` (two-stage: PGN-completion first attempt, ELO-persona legal-list chat on retries; campaign: 10.7% vs 3.3% match) — see docs/prompt-lab/*.md.

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

A PR should not merge unless this is green.

## Deployment

A **separate** workflow, `.github/workflows/azure-swa.yml`, publishes the app to **Azure Static Web Apps** (`ci.yml` stays purely the quality gate):

- **Resource:** SWA `neuro-chess` (Free SKU, West Europe, resource group `neuro-chess-swa-rg`), created **disconnected** (Azure is not linked to the repo). Live at **https://ashy-rock-00119fc03.7.azurestaticapps.net**.
- **Auth:** a deployment token in the repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (set via `gh secret set`; not in the repo).
- **Flow:** the workflow builds with Node 20 (`npm ci && npm run build`, same as CI) and deploys the prebuilt `dist/` via `Azure/static-web-apps-deploy@v1` (`skip_app_build: true`, `app_location: dist`). **push → `main`** deploys production; a **pull_request** opens/updates a preview environment; **PR closed** closes it.
- Spec: `docs/superpowers/specs/2026-07-20-azure-static-web-apps-deploy-design.md`.

The deployed HTTPS site calls `http://localhost:<port>` in LM Studio — `localhost` is a potentially-trustworthy origin so mixed content isn't blocked, but LM Studio must send CORS headers for the site's origin (see the gotcha below).

## Non-obvious decisions & gotchas

- **`typecheck` is `tsc -b`, not `tsc --noEmit`.** The project uses composite project references (`tsconfig.json` → `tsconfig.node.json`), and TypeScript's build mode rejects `--noEmit` (TS6310). `tsc -b` still type-checks fully and fails on any error. Don't "fix" it back to `--noEmit`.
- **TS build artifacts are redirected out of the repo root.** `tsBuildInfoFile` and the vite-config declaration output go to `node_modules/.tmp/` (gitignored), plus `*.tsbuildinfo` is in `.gitignore`. If you touch the tsconfig topology, keep build output from leaking into the repo root.
- **Calling `http://localhost` from an HTTPS static host** (Azure) needs LM Studio to send CORS headers for the site's origin, and relies on the browser treating `http://localhost` as a "potentially trustworthy origin". **Verified 2026-08-11:** it works in Chromium-based browsers (deployed site → `GET http://localhost:1234/api/v0/models` → 200) and LM Studio's `--cors` answers with `Access-Control-Allow-Origin: *`, but **Safari blocks it** — WebKit does not exempt loopback from mixed-content blocking, so the hosted app is unusable there. Workaround: run the app locally over `http://` (or put a locally-trusted HTTPS proxy in front of LM Studio). Note LM Studio binds `127.0.0.1` only — `http://[::1]:1234` does not answer.
- `.superpowers/` is agent scratch (gitignored, excluded from Prettier). Not part of the product.
- **Local reasoning models (gemma-4, qwen3.5) return empty `content`** with a small `max_tokens` because tokens go to `reasoning_content` instead. The transports accept an optional `reasoningEffort` (`'none'` disables thinking via LM Studio's `reasoning_effort` param); per-model adapters must set it or `selectMove` degrades to its random fallback.

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
  - Sub-project B — interactive human play (`ui/game` ← engine, hotseat) — spec: `docs/superpowers/specs/2026-07-17-interactive-human-play-design.md`, plan: `docs/superpowers/plans/2026-07-17-interactive-human-play.md`. **DONE.**
  - Sub-project C — LLM opponent (`src/llm` chat/completion transports + `ModelAdapter` layer + `selectMove`, orchestrated by `useGame`) — spec: `docs/superpowers/specs/2026-07-17-llm-opponent-design.md`, plan: `docs/superpowers/plans/2026-07-17-llm-opponent.md`. **DONE.**
  - Sub-project D₁ — real history + persistence + clocks (`src/ui/history/gameHistory.ts`, `src/ui/game/useChessClock.ts`, `useGame` recording + resignation, `HistoryScreen` on real data) — spec: `docs/superpowers/specs/2026-07-18-history-persistence-clocks-design.md`, plan: `docs/superpowers/plans/2026-07-18-history-persistence-clocks.md`. **DONE.**
  - Sub-project D₂ — real hints (`src/llm/hint.ts`, `src/ui/game/useHint.ts`, `HintConsole` rewrite, `Board` `hintMove`) — spec: `docs/superpowers/specs/2026-07-18-real-hints-design.md`, plan: `docs/superpowers/plans/2026-07-18-real-hints.md`. **DONE.** (This closes sub-project D; the commentary-model adapter D₃ was cancelled.)

The full Nocturne prototype (markup/copy source of truth) is vendored read-only at `docs/design-reference/gambit-local/`.

## Roadmap

Nothing is queued right now — the gameplay track is finished end to end. New work starts with its own spec → plan → implementation cycle, per the Superpowers methodology below.

- **Real gameplay** (`chess.js`), decomposed into sub-projects **A → D₂, all done**:
  - **A — engine core** (`src/engine`): pure chess.js wrapper — `newGame`/`move`/`legalMoves`, full check/checkmate/stalemate/draw taxonomy, engine-owned board matrix and types. **DONE** (this is rules/state only; no UI, no LLM).
  - **B — interactive human play**: `ui/game` wired to the engine (hotseat click select→move, legal-move highlighting, real move list, promotion picker, turn/result status, New Game). **DONE** (superseded by C: the human now plays White only, the model plays Black).
  - **C — LLM opponent**: `src/llm` chat/completion transports + a universal `ModelAdapter` strategy layer (per-model prompt/parse, generic FEN-only default via `resolveAdapter`) + `selectMove` (validates the model's move against the engine's legal set, retries with correction, random-legal fallback), orchestrated by `useGame` (model plays Black; thinking state; connection auto-retry + banner). **DONE.**
  - **D₁ — real history + persistence + clocks**: finished game (mate/draw/timeout/resignation) → persisted `GameRecord` (localStorage `nocturne-chess-games`, cap 50) → History entry replacing demo data (empty state, no opening column); real per-side clocks (`useChessClock`, 10:00, White timeout = loss; Black was frozen while the model thinks — **later superseded by the live model clock**, which lets Black tick and flag); wired Resign button (two-step confirm). **DONE.**
  - **D₂ — real hints**: `HintConsole` is live — `src/llm/hint.ts` (`getHint`, engine-validated, no random fallback) + `useHint` progressive reveal (piece → idea → exact move + a `Board` `hintMove` highlight); reuses the connected opponent model. **DONE.**
  - **D₃ — commentary-model adapter**: **CANCELLED (2026-08-10).** A `CommentaryAdapter` for a model that _comments on_ a played move (e.g. `chess-gemma-commentary`) is no longer planned. Older specs that mention it (`2026-07-17-llm-opponent-design.md`, `2026-07-18-*`) are historical records — don't treat them as a backlog.
  - `ui/game` and `ui/history` are real (sub-projects B+C+D₁+D₂); the gameplay track is closed.
- Deferred, not scheduled: the **Appearance** screen.
