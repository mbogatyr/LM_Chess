# Design: Nocturne Design-System Port — Phase 3 (History + topbar tabs)

Date: 2026-07-13

## Context

Phases 1 and 2 of the Nocturne ("Gambit Local" / **NeuroChess**) design-system
port are merged on `main` (PR #3, PR #4). Phase 1 delivered the global Nocturne
CSS, local Inter, RU/EN i18n, the window-chrome + topbar shell, and the wired
onboarding wizard (Connect → Models → ELO → Game). Phase 2 delivered the static
presentational game screen (`src/ui/game/`) on demo data.

The overall port spec
(`docs/superpowers/specs/2026-07-11-nocturne-design-port-design.md`) scoped
**Phase 3 as "History + Appearance sheet"**. During brainstorming the user
**narrowed Phase 3**: build the **History screen** and the **topbar tabs** needed
to reach it; **defer the entire Appearance feature** (the `◧` button, the sheet,
and the board-palette / piece-style pickers) to a later phase.

## Source of truth

The mockup is vendored read-only under `docs/design-reference/gambit-local/`.
For Phase 3 the relevant sources are:

- `app/history.js` — the `History.render()` markup (fetched from Claude Design
  this session; the History object was not previously vendored).
- `app/data.js` — the `HISTORY` array and the RU/EN i18n table.
- `app/app.css` — the `.lb`, `.lb-stats`, `.stat`, `.res` styles, plus the DS
  utilities `.card`, `.elev-sm`, `.table`, `.text-muted` from the Nocturne
  token sheet (`_ds/styles.css`).
- `app/main.js` — the `Chrome.render()` topbar (brand, tabs, pill, style button,
  lang toggle) and its tab-sync logic.

All CSS classes and all i18n keys needed by Phase 3 were **already vendored** in
Phases 1–2 (`src/styles/nocturne.css`, `src/styles/app.css`, `src/ui/app/i18n.tsx`
keys `lb_h`, `lb_p`, `st_played`, `st_winrate`, `st_streak`, `st_best`,
`col_date`, `col_opp`, `col_elo`, `col_len`, `col_res`, `col_open`, `win`,
`loss`, `draw`, `tab_game`, `tab_history`). Phase 3 adds no CSS and no i18n keys.

## Decisions (from brainstorming)

- **Topbar tabs are shown only after onboarding** — i.e. only when the current
  screen is `game` or `history`, never during the `onb-*` screens. This differs
  from the prototype (where tabs are always visible); it is the user's explicit
  choice and removes the need for a separate `onboarded` flag — the current
  `screen` gates tab visibility. The "Game" tab always navigates to `game`.
- **No Appearance UI in Phase 3.** The `◧` Appearance button, the sheet, and the
  board/piece pickers are deferred. `appState.boardStyle` / `pieceStyle` and
  their setters (built in Phase 2, already read by the `Board`) stay in place but
  gain no UI to change them this phase.

## Work

### 1. `src/ui/app/demoData.ts` — add match-history data + stats helper

Add, alongside the existing `ELO_BANDS`:

```ts
export type HistoryEntry = {
  date: string   // RU short date, e.g. "11 июл"
  edate: string  // EN short date, e.g. "Jul 11"
  opp: string    // opponent model name
  elo: number
  len: number    // move count
  res: 'win' | 'loss' | 'draw'
  open: string   // RU opening name
  eopen: string  // EN opening name
}

export const HISTORY: HistoryEntry[] = [ /* 8 entries, verbatim from data.js */ ]

export type HistoryStats = {
  played: number
  winRate: number  // integer percent
  streak: number   // count of leading wins from the top of HISTORY
  best: number     // max elo
}

export function historyStats(entries: HistoryEntry[]): HistoryStats
```

`historyStats` mirrors `history.js` exactly:

- `played` = `entries.length`
- `winRate` = `Math.round(wins / entries.length * 100)` where `wins` = count of
  `res === 'win'`
- `streak` = number of consecutive `win`s counted from the **start** of the
  array until the first non-win
- `best` = `Math.max(...entries.map(e => e.elo))`

On the demo data this yields `played: 8`, `winRate: 63`, `streak: 1`,
`best: 1350`. Keeping this as a pure function makes the arithmetic unit-testable
independent of rendering.

### 2. `src/ui/history/HistoryScreen.tsx` — presentational History screen

New folder `src/ui/history/`, sibling to `game/` and `onboarding/`.
Structure ported 1:1 from `History.render()`, using existing class names:

- Root `<div className="lb">`.
- Header block: `<h2>{t('lb_h')}</h2>` (with `marginBottom: 4`) and
  `<p className="text-muted">{t('lb_p')}</p>` (with `margin: 0`).
- `<div className="lb-stats">` with four tiles, each
  `<div className="card stat elev-sm">` holding `<span className="k">` (label)
  and `<span className="v">` (value):
  - `st_played` → `played`
  - `st_winrate` → `` `${winRate}%` `` with `<span className="v pos">` (accent color)
  - `st_streak` → `streak > 0 ? '+' + streak : '0'`
  - `st_best` → `best`
- Table wrapper `<div className="card elev-sm" style="padding: var(--space-2) var(--space-4)">`
  containing `<table className="table">`:
  - `<thead>` row: `col_date`, `col_opp`, `col_elo`, `col_len`, `col_res`,
    `col_open`.
  - `<tbody>`: one `<tr>` per `HISTORY` entry:
    - date `<td className="text-muted">` — `lang === 'ru' ? e.date : e.edate`
    - opponent `<td>` — `e.opp`
    - ELO `<td style="font-variant-numeric: tabular-nums">` — `e.elo`
    - length `<td className="text-muted" style="font-variant-numeric: tabular-nums">` — `e.len`
    - result `<td>` → `<span className={'res ' + e.res}>{t(e.res)}</span>`
    - opening `<td className="text-muted">` — `lang === 'ru' ? e.open : e.eopen`

Data comes from imported `HISTORY` and `historyStats`; `t` / `lang` from
`useI18n`. No props, no network. A stable React `key` per row (index is fine —
the demo list is fixed).

### 3. `src/ui/shell/Topbar.tsx` — add Game/History tabs

The current `Topbar` renders brand + pill + lang toggle. Add a `.topbar-tabs`
block with two `.tab` buttons (`tab_game`, `tab_history`) **between the brand
and the pill**, matching `Chrome.render()` order.

- Topbar reads `screen` and `setScreen` from `useAppState` (it already uses
  `useI18n`). The `connected` prop stays.
- Tabs render **only** when `screen === 'game' || screen === 'history'`;
  otherwise the tabs block is omitted entirely (onboarding shows no tabs).
- `data-tab="game"` → `setScreen('game')`; `data-tab="history"` →
  `setScreen('history')`.
- `aria-current` is `"true"` on the tab matching the current screen, else
  `"false"` (mirrors the prototype's `syncTabs`).
- The `◧` Appearance button from `Chrome.render()` is **not** added.

### 4. `src/App.tsx` — route History to the real screen

Replace `{screen === 'history' && <GamePlaceholder />}` with
`{screen === 'history' && <HistoryScreen />}` and import `HistoryScreen`.
`GamePlaceholder` stays in the tree for other potential use but is no longer the
history route.

## Module boundaries

- New `src/ui/history/` (screen + test) is presentational only — no `fetch`, no
  chess.js, no LM Studio coupling. It depends on `src/ui/app` (`demoData`,
  `i18n`) only.
- `src/llm` and `useConnection` are untouched.
- No new global CSS, no new i18n keys.

## Testing strategy (Vitest + RTL, no network)

- **`historyStats` (pure)**: on the demo `HISTORY`, asserts
  `{ played: 8, winRate: 63, streak: 1, best: 1350 }`; plus small crafted arrays
  covering an all-loss streak (0), a leading multi-win streak, and rounding.
- **`HistoryScreen`**: renders the four stat tiles with the computed values
  (including `63%` and the `+`-prefixed streak); renders 8 body rows; result
  cells carry `res win` / `res loss` / `res draw` classes; toggling the language
  (via the i18n provider) swaps a date and an opening name RU↔EN.
- **`Topbar`**: tabs are present when `screen` is `game` / `history` and absent
  during `onb-connect`; clicking History calls `setScreen('history')` and Game
  calls `setScreen('game')`; the active tab has `aria-current="true"`.
- Existing `src/llm`, connection, onboarding, and game tests stay green.
- Visuals verified live in the browser against LM Studio (`google/gemma-4-e4b`,
  `localhost:1234`), not pixel-tested.

## Error handling

None new. The History screen is static demo data with no failure surface. Topbar
navigation is synchronous state changes.

## Out of scope (Phase 3)

- The Appearance feature in full: the `◧` topbar button, the appearance sheet,
  and the board-palette / piece-style pickers (deferred to a later phase; the
  `boardStyle` / `pieceStyle` state and setters already exist and are read by the
  `Board`, but gain no UI this phase).
- Real match history, persistence of games, or any real result computation.
- Always-visible tabs during onboarding (deliberately not ported).
- chess.js, real gameplay, real ELO enforcement, streaming — as in prior phases.
