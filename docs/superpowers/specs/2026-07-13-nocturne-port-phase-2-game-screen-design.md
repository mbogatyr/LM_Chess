# Design: Nocturne Port — Phase 2 (Game screen, static + live hints)

Date: 2026-07-13

## Context

Phase 1 of the Nocturne design-system port (PR #3, merged) delivered the shell,
i18n, app-state layer, and the wired onboarding wizard (Connect → Models → ELO →
placeholder Game). This is **Phase 2**: replace the Game placeholder with the
real game screen, ported from the prototype as **presentational React on demo
data**. Real chess rules (chess.js), move-making, and gameplay remain a later
spec.

The overall port design lives in
`docs/superpowers/specs/2026-07-11-nocturne-design-port-design.md`; this document
refines the "Phase 2 — Game screen (static)" bullet into an implementable spec.

Design source of truth (vendored read-only under
`docs/design-reference/gambit-local/`):

- `app/game.js` — game-screen markup, panels, players/clocks, moves, hints.
- `app/board.js` — board rendering, the inline piece artwork (`PIECE_SVGS`), the
  demo `HINT`/`MOVES` data, and (not ported) the fake move/interaction logic.
- `uploads/*_svg_NoShadow.svg` — the 12 raw piece exports (provenance only; see
  Pieces).
- `app/app.css` — already copied verbatim into `src/styles/app.css` in Phase 1;
  all game/board/piece/moves/hint/clock/status classes already exist.

## Scope decision (from the user)

Interactivity level: **snapshot + live hints**.

- The board shows a **fixed starting position, White to move**. Pieces do **not**
  move — no click-to-move, no drag-and-drop, no canned opponent replies.
- The **hint console is fully interactive** (three levels + a refresh button).
  This is pure presentation — board highlights and readout text — and involves
  **no chess rules**.
- Clocks are **frozen** at `10:00 / 10:00`; the White clock carries `.active`.
- The move list shows its **empty state**.

Rejected alternatives: a fully frozen snapshot (screen feels dead) and porting
the prototype's full fake interactivity (throwaway code that chess.js will
replace, and it blurs the "no gameplay yet" boundary).

## What the screen contains (ported from `game.js`)

Two-column `.game` layout inside the existing shell's `.screen` host:

- **`.board-col`**: opponent player strip, the board, the "you" player strip.
- **`.side-col`**: a status line, a hints panel, a moves panel.

Details, matching the prototype:

- **Opponent strip** — `✳` avatar, model name, `{opp} · ELO {elo}`, empty
  captured strip, frozen clock `10:00`.
- **Board** — `.board-wrap.pieces--{pieceStyle}` › `.board.board--{boardStyle}`
  with 64 `.sq` cells. Rank labels on file a, file labels on rank 1. Pieces from
  the starting position. Hint-driven classes layered on top (see Hints).
- **You strip** — the accent user-glyph avatar, `{you}`, demo `ELO 1280 ·
  {yoursub}`, empty captured strip, clock `10:00 .active`.
- **Status line** — turn dot + `{yourmove}` / `{yoursub}` (fixed; White to
  move).
- **Hints panel** — heading `{hints_h}`, a refresh icon-button, three
  `.hint-lv` buttons (`{hint1_t}/{hint1_s}` … `{hint3_t}/{hint3_s}`), and a
  `.hint-readout` region (empty state = `{hint_empty}`).
- **Moves panel** — heading `{moves_h}`, inert `{offerdraw}` / `{resign}`
  buttons, and a `.moves` table showing the empty-state row ("Сделайте первый
  ход" / "Make the first move").

All copy comes from the existing `STRINGS` table (`src/ui/app/i18n.tsx`) — every
required key (`you`, `opp`, `yourmove`, `yoursub`, `hints_h`, `hint1_t`…`hint3_s`,
`hint_empty`, `hint_off`, `moves_h`, `resign`, `offerdraw`, …) was already ported
in Phase 1. **Phase 2 adds no new i18n keys.** The hint bodies themselves (level
1–3 title + text, RU/EN) are demo content and live in `chessDemo.ts`, ported from
the `HINT` object in `board.js`.

## Pieces

The prototype does **not** load the `uploads/*.svg` files at runtime. It renders
**six type-keyed shapes** inlined in `board.js` (`PIECE_SVGS` for `p r n b q k`)
and colours them per side entirely via CSS (`.piece.w .cp` / `.piece.b .cp`,
plus the `pieces--neon|flat|outline` palettes). The `b_*` uploads differ from the
`w_*` ones only in class assignment (and a slightly different bishop mitre) and
are unused by the prototype.

Therefore the runtime source of truth is the inline `PIECE_SVGS` data, ported to
`pieceSvgs.ts`. The 12 `uploads/*.svg` files are vendored for provenance only.

Rendering approach (chosen over `<img>`/`<use>` and hand-written JSX): a `Piece`
component emits `<span class="piece {color}"><svg class="cp cp-{type}"
viewBox="…">{inner}</svg></span>`, where `inner` is the ported path markup. This
preserves the CSS `.cls-*` / `.cp-n` selectors that give side-colouring and the
three piece styles for free, and keeps everything offline (no asset pipeline).

## Target architecture (React port)

New module `src/ui/game/` (presentational; no `fetch`, renders in tests without
network):

- **`chessDemo.ts`** — demo data + pure helpers ported from `board.js`:
  - the starting position parsed to an 8×8 array of `Piece | null`
    (`Piece = { color: 'w' | 'b'; type: 'p'|'r'|'n'|'b'|'q'|'k' }`),
  - `FILES`, `sqName(r,c)`, `nameToRC(name)`,
  - `HINT` (`piece`, `from`, `to`, `targets`, and `ru`/`en` level text),
  - `MOVES` for the hinted piece (`e2`) so level 3 can show legal-dot markers.
  - No move-making, no material, no opponent logic.
- **`pieceSvgs.ts`** — the six `PIECE_SVGS` shapes (`{ vb, inner }`) as data.
- **`Piece.tsx`** — renders one piece span/svg (see Pieces).
- **`Board.tsx`** — pure render of the 8×8 grid from props
  (`hintLevel`, `boardStyle`, `pieceStyle`): squares, coord labels, pieces, and
  the hint classes/markers; renders the `.arrows` overlay when `hintLevel === 3`.
- **`PlayerStrip.tsx`** — avatar + who + captured (empty) + clock; used twice.
- **`MoveList.tsx`** — the moves panel and its empty state.
- **`HintConsole.tsx`** — the three level buttons, the refresh button, and the
  readout; reports level changes upward.
- **`GameScreen.tsx`** — composes the layout, owns `hintLevel` React state, wires
  `HintConsole` ↔ `Board`, and renders the fixed status line. Takes presentational
  props: `opponentName`, `elo`, `boardStyle`, `pieceStyle` (and reads `t`/`lang`
  from `useI18n`).

**Hint behaviour (ported, no chess rules).** `hintLevel` is `0..3`.

- Clicking a level button sets that level; clicking the already-active level
  toggles back to `0`. The refresh button cycles `0/3 → 1 → 2 → 3`.
- Board reaction: level ≥ 1 marks `HINT.piece` (`e2`) with `.hint1`; level 2 marks
  `HINT.targets` (`e4`, `d4`) with `.hint-target`; level 3 pre-selects `e2`
  (`.sel` + legal-dot markers from `MOVES.e2`) and draws the accent arrow
  `e2 → e4` in the `.arrows` overlay.
- Readout: level 0 shows the empty/off text; levels 1–3 show a kicker
  (`{hints_h} · N/3`), the level title, and its body from `HINT[lang]`.

The arrow overlay is a small inline `<svg class="arrows" viewBox="0 0 100 100">`
positioned over the board, with the path computed from square-centre percentages
(as in `board.js.renderArrows`); the stroke uses the `--color-accent` token.

**State additions.** `src/ui/app/appState.tsx` gains `boardStyle` and
`pieceStyle` (types `'mono'|'contrast'|'accent'` and `'neon'|'flat'|'outline'`,
defaults `'mono'` / `'neon'`), persisted into the existing `nocturne-chess`
localStorage store alongside `elo`, each with a setter mirroring `setElo`. Phase 2
only **reads** these to style the board; Phase 3's Appearance sheet wires the
picker UI to the setters.

**Routing.** `App.tsx`: `screen === 'game'` renders `<GameScreen …>` (passing the
selected model name when `useConnection` exposes it, otherwise a demo fallback
label; `elo`, `boardStyle`, `pieceStyle` from app state). `screen === 'history'`
keeps rendering `GamePlaceholder` until Phase 3.

**Module boundaries.** `src/llm` unchanged. `src/ui/game` is presentational and
takes data via props / `chessDemo`, so it renders in tests without network. No
`fetch` in `src/ui`.

## Error handling

None new. The screen is static demo content; there are no network calls or
failure surfaces in Phase 2. Connection state continues to be reflected only by
the topbar pill (Phase 1 behaviour, unchanged).

## Testing strategy

Vitest + Testing Library, no network:

- **`chessDemo`** — `parseFEN`/`sqName`/`nameToRC` are correct; `HINT` and
  `MOVES` have the expected shape.
- **`Board`** — renders 64 squares, coord labels `a`–`h` and `1`–`8`, pieces on
  their starting squares; the hint classes/markers appear for the right
  `hintLevel` (`hint1` at level ≥ 1, `hint-target` at level 2, arrow at level 3).
- **`HintConsole`** — clicking levels 1/2/3 sets `aria-pressed` and shows the
  matching readout in the active language (RU and EN); the refresh button cycles;
  clicking the active level toggles it off.
- **`GameScreen`** — shows the opponent name and ELO, both clocks at `10:00`, the
  empty move-list message, and the "your move" status.
- **`appState`** — `boardStyle`/`pieceStyle` defaults and persistence (mirroring
  the existing `elo` test).

Visual parity with the prototype is verified live in the browser against a
running LM Studio (`google/gemma-4-e4b`), not asserted pixel-by-pixel.

## Out of scope (Phase 2)

- Real chess rules / chess.js, legal-move generation, actual move-making,
  click-to-move, drag-and-drop.
- Canned opponent replies, ticking clocks, captured-piece tracking, material
  count.
- The History screen and the Appearance picker UI (Phase 3).
- Sending positions to the model, streaming, real hint analysis by the LLM.
