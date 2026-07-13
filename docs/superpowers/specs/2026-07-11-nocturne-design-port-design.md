# Design: Nocturne Design-System Port ("Gambit Local")

Date: 2026-07-11

## Context

The user designed a full chess-app UI in Claude Design — project "Дизайн-система
шахматного приложения", entry `Gambit Local.html` (product name **NeuroChess**).
It is a vanilla-JS multi-screen prototype on the **Nocturne** design system: a
dark, compact, blue-grey theme with a single blurple accent (`#9184d9`), Inter,
8px radii, outlined buttons, everything on CSS tokens.

The task: **port the mockup into our real React + TypeScript app** so LM_Chess
looks and is structured like the prototype, with the connection flow wired to
the real LM Studio client we already built.

The full prototype has been vendored read-only under
`docs/design-reference/gambit-local/` (shell HTML, `_ds/styles.css`,
`app/app.css`, `app/data.js`, `app/onboarding.js`, `app/main.js`; board/game/
history JS and piece SVGs are fetched per phase). Implementers read those files
from disk — they are the source of truth for markup, tokens and copy.

## Scope decision (from the user)

- **Full port of the mockup**, phased. Screens whose backing feature exists
  (connection) are wired to real behavior; screens whose feature does not exist
  yet (the chess game itself) are ported as **static, presentational** React on
  the prototype's demo data. Real chess (chess.js) and real gameplay remain a
  later spec.
- **Bilingual RU + EN** with the topbar language toggle, as in the prototype.

## What the prototype contains

- **App shell**: a browser-window "chrome" frame, a **topbar** (brand
  "NeuroChess" + subtitle, tabs Game/History, a connection **pill**,
  an Appearance button, an RU/EN toggle), and a screen host.
- **Onboarding wizard** (`onb-*`): Connect → Models → (Confirm) → ELO → Game.
  - Connect: server-URL field (default `http://localhost:1234`), "test
    connection" → success pill → "choose a model".
  - Models: list with RAM/context/quant meta, per-row Load (progress) / Play.
  - ELO: slider 500–1500 with a live band title + flavour quote (`ELO_BANDS`).
- **Game screen** (static): board (8×8, 3 palettes), Staunton SVG pieces
  (3 styles), player/opponent strips, clocks, move list, a 3-level hint console,
  status line.
- **History screen**: 4 stat tiles + a match-history table (`HISTORY`).
- **Appearance sheet**: board-palette and piece-style pickers.
- **State** (`APP`): `lang`, `boardStyle`, `pieceStyle`, `elo`, `connected`,
  `model`, `onboarded`; the first four persist to `localStorage`.
- **i18n** (`I18N`): full RU/EN string tables (`data.js`).

## Target architecture (React port)

**Global styling.** Vendor the Nocturne token sheet and the app CSS into the
repo as plain global CSS imported once:

- `src/styles/nocturne.css` — copy of `_ds/styles.css` **with the Google-Fonts
  `@import` removed** (see Fonts).
- `src/styles/app.css` — copy of `app/app.css`.
- Imported from `src/main.tsx`. Components use the existing class names
  (`.btn`, `.onb-card`, `.model-row`, `.topbar`, …); we do **not** invent a
  parallel styling system. Vite handles CSS imports natively.

**Fonts (offline/static constraint).** The app must deploy to static hosting
and run offline, so the remote Google-Fonts `@import` is removed and **Inter is
vendored locally** via the `@fontsource/inter` package (imported in
`src/main.tsx`). The `--font-*` tokens already name `"Inter"`.

**Icons.** The prototype uses only a couple of glyph characters (`◧`, `✳`) and
the inline logo SVG — no icon font is needed. Keep the inline `logoSVG()` markup
as a React component. (Phosphor is named in the DS readme but unused in these
screens; not adopted now.)

**App state + i18n.** A small `src/ui/app` layer:

- `i18n.ts` — the `I18N` RU/EN table (ported from `data.js`) + a `useI18n`
  hook exposing `t(key)` and `lang`/`setLang`; language persists to
  `localStorage` (`nocturne-chess` store, matching the prototype's persisted
  subset).
- `appState.ts` — the non-connection app state (`lang`, `boardStyle`,
  `pieceStyle`, `elo`, `onboarded`) via a context/reducer; the connection
  state stays in the existing `useConnection` hook and is composed in.
- `demoData.ts` — the static `ELO_BANDS`, `HISTORY`, and mock model meta used
  by presentational screens (ported from `data.js`).

**Screens & routing.** No router dependency — a `screen` enum in app state
drives a switch in `App.tsx` (`onb-connect | onb-models | onb-elo | game |
history`). The topbar and window chrome wrap the active screen.

**Wired vs static.**

- **Connect** and **Models** onboarding steps wire to the **real**
  `useConnection` (real `listModels`/`loadModel` against LM Studio). The
  prototype's fake per-row load **progress bar** is replaced by our real JIT
  load with a **spinner** (no progress events exist); USE selects the model and
  advances. This supersedes the plain `ConnectionDialog` from the previous spec.
- **ELO** step is new presentational UI (slider + band copy); the chosen ELO is
  stored but not yet enforced (no gameplay).
- **Game**, **History**, **Appearance sheet** are presentational React on demo
  data, matching the mockup. The board renders a fixed sample position; pieces
  use the vendored SVGs; hint/among interactions are visual only.

**Module boundaries.** `src/llm` unchanged (HTTP I/O). `src/ui` gains the
`app` layer, the onboarding wizard, and the screen components. No `fetch` in
`src/ui`. Presentational screens take data as props / from `demoData`, so they
render in tests without network.

## Phasing

Each phase is its own plan and merges green on the `feat/nocturne-design-port`
branch.

- **Phase 1 — Foundation + shell + wired onboarding.** Vendor CSS + Inter;
  i18n + app-state layer; window chrome + topbar (brand, tabs, connection pill,
  RU/EN toggle); the onboarding wizard (Connect + Models wired to
  `useConnection`; ELO step); routing to a placeholder Game screen. Replaces the
  old `ConnectionDialog`/`ConnectedView` as the app's entry.
- **Phase 2 — Game screen (static).** Board palettes, SVG pieces (vendored),
  players/clocks, move list, hint console, status — presentational on demo data.
- **Phase 3 — History + Appearance sheet.** Stat tiles + history table; the
  board/piece appearance pickers wired to `boardStyle`/`pieceStyle` state.

## Error handling

Connection errors keep the existing `useConnection` behavior (typed
`LMStudioError`, network/CORS message), rendered inside the onboarding cards.
No new error surfaces in the static screens.

## Testing strategy

- Existing `src/llm` and connection tests stay green (behavior unchanged).
- **i18n**: `t()` returns the right string per language; `setLang` persists.
- **Onboarding (RTL, mocked `src/llm`)**: Connect renders the URL field
  (default `http://localhost:1234`) and advances on success; the models step
  lists real models with Load/Play and the two-step load→use logic; ELO slider
  updates the band title/quote; USE→ELO→Game transitions.
- **Chrome**: RU/EN toggle switches visible copy; connection pill reflects
  connected state.
- **Presentational screens** (Phase 2–3): render on demo data and assert key
  text/structure; no network.
- Visuals are verified live in the browser against a running LM Studio
  (`google/gemma-4-e4b`), not unit-tested pixel-by-pixel.

## Out of scope

- Real chess rules / chess.js, legal-move generation, real gameplay and clocks.
- Real ELO enforcement, real move list, functional hints (LLM analysis).
- Streaming responses; sending positions to the model.
- Deploying to Azure. Piece drag-and-drop interactions (Phase 2 is visual only).
