# Design: Environment & Test Infrastructure Setup

Date: 2026-07-11

## Context

LM_Chess is a new project: a frontend-only chess application for playing and
learning chess, deployable to any static host (Azure Blob Static Website,
Azure Static Web Apps). The "thinking engine" is a local LLM served by LM
Studio, reached over HTTP from the browser at `http://localhost:<port>`.
There is no backend.

This spec covers **only** the environment and test infrastructure setup: the
project skeleton, tooling, and a single passing test proving the toolchain
works end-to-end. Chess rules, board UI, and LLM integration are out of
scope and will be designed in a follow-up spec once this foundation is
verified.

## Decisions from clarifying questions

- **Primary MVP scenario** (informs future specs, not this one): play a full
  game against the LLM opponent. Teaching/explanation features come later.
- **Chess rules authority**: a battle-tested library (e.g. chess.js) will own
  move legality, check/checkmate/draw detection. The LLM only selects moves;
  it never adjudicates legality. (Implemented in a future spec — noted here
  because it shapes the `src/engine` boundary below.)
- **Frontend framework**: React 18 + TypeScript, built with Vite.
- **Unit test framework**: Vitest (shares Vite's config, no extra transform
  setup).
- **CI**: GitHub Actions (repo already hosted on GitHub: `mbogatyr/LM_Chess`),
  running lint + typecheck + test on every push/PR to `main`.
- **Repository layout**: single package at the repo root, folder-based
  separation of concerns — no monorepo tooling (pnpm workspaces etc.), since
  this is a single-developer, single-app project at this scale.

## Architecture / Project Structure

```
LM_Chess/
├── src/
│   ├── engine/       # placeholder — chess.js wrapper (future spec)
│   ├── llm/          # placeholder — LM Studio HTTP client (future spec)
│   ├── ui/           # placeholder — React components (future spec)
│   ├── App.tsx       # temporary stub component, replaced in the next spec
│   ├── App.test.tsx  # the one green test
│   └── main.tsx
├── .github/workflows/ci.yml
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts    # includes Vitest config (`test: {...}`)
├── eslint.config.js
├── .prettierrc
└── docs/superpowers/specs/
```

`engine/`, `llm/`, `ui/` are created empty (with a `.gitkeep` or short
README stub) purely to mark future module boundaries — no business logic is
written in this spec.

## Stack

| Layer                                  | Choice                                                                                              | Rationale                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Build/dev server                       | Vite                                                                                                | Fast, native TS support, minimal config                                    |
| UI framework                           | React 18 + TypeScript                                                                               | Wide ecosystem, chess-board components available for later                 |
| Tests                                  | Vitest + @testing-library/react                                                                     | Runs on the same Vite config, no extra transformer setup                   |
| Lint                                   | ESLint (typescript-eslint + eslint-plugin-react-hooks)                                              | De facto standard, catches issues before CI                                |
| Formatting                             | Prettier                                                                                            | Removes style debates, auto-fixable                                        |
| Package manager                        | npm                                                                                                 | Already available everywhere, no extra install needed for a single package |
| CI                                     | GitHub Actions                                                                                      | Repo is already on GitHub                                                  |
| Hosting target (not part of this spec) | Static files from `dist/` — compatible with Azure Blob Static Website and Azure SWA without changes |

## The First Green Test

Goal: prove the full chain (Vite + Vitest + TypeScript + React Testing
Library) actually works, without faking business logic.

- `src/App.tsx` — minimal stub component rendering `<h1>LM Chess</h1>`
  (temporary, replaced in the next spec).
- `src/App.test.tsx` — one test: renders `<App />` via
  `@testing-library/react` and asserts the text "LM Chess" appears.
- Runs via `npm test` (`vitest run`).

This is not a chess-logic test — it's an infrastructure test: if the build
breaks or the test config is wrong, CI turns red immediately.

## CI (GitHub Actions)

`.github/workflows/ci.yml`, triggered on `push` and `pull_request` to
`main`:

1. Checkout + Node.js setup (current LTS, e.g. 20.x) + `npm ci`
2. `npm run lint` (ESLint)
3. `npm run typecheck` (`tsc --noEmit`)
4. `npm test` (`vitest run`)

No deploy step at this stage — Azure SWA/Blob deployment is a separate task
once there is real content to ship.

## Error Handling / Known Constraints

There is no business logic yet, so there is little to handle. One
constraint is worth recording now because it shapes a future spec: calling
`http://localhost:<port>` (LM Studio) from an HTTPS-hosted static site
(Azure SWA/Blob) will require (a) LM Studio to send CORS headers allowing
the static site's origin, and (b) the browser not to block the call as
mixed content. Per spec, `http://localhost` is a "potentially trustworthy
origin", so modern browsers generally allow this — but it must be verified
explicitly in the LLM-integration spec, not assumed here.

## Out of Scope (this spec)

- Chess rules engine implementation
- Chessboard UI
- LM Studio HTTP client
- Any deployment/CI deploy step
- E2E tests (Playwright) — revisit once there's a real UI to drive
