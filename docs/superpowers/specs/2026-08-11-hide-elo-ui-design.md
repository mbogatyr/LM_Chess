# Hide ELO in the game and history UI

Date: 2026-08-11
Status: Design (approved by user, pending spec review)

## Context

The ELO onboarding step was hidden earlier today
(`docs/superpowers/specs/2026-08-11-hide-elo-step-design.md`): the Prompt Lab
campaigns showed the strength dial does not measurably change play, so the
user can no longer set a rating. The number nevertheless keeps appearing in
the UI — on the game screen and in the match history — where it now reads as
a promise the app does not keep. One of those readings was never real at all:
the human player's strip has always shown a hardcoded `ELO 1280`.

This spec removes every ELO the user can see. It follows the same rule as the
onboarding change: **hide the UI, leave the data alone.**

### What exists today (visible ELO surfaces)

| Screen  | Location                                    | Renders                            |
| ------- | ------------------------------------------- | ---------------------------------- |
| Game    | `GameScreen.tsx:109` opponent `PlayerStrip` | `` `${t('opp')} · ELO ${elo}` ``   |
| Game    | `GameScreen.tsx:137` human `PlayerStrip`    | `` `ELO 1280 · ${t('yoursub')}` `` |
| History | `HistoryScreen.tsx:59,70` table column      | `t('col_elo')` header + `g.elo`    |
| History | `HistoryScreen.tsx:35-38` stat tile         | `t('st_best')` + `best`            |

`elo` also flows invisibly through `useGame` → `selectMove` → adapters,
through `useHint` → `src/llm/hint.ts`, and into each persisted `GameRecord`.
None of that is a user-visible mention.

## Decisions (from brainstorming)

1. **Hide the UI, keep the data.** `elo` stays in `appState`, keeps flowing
   into prompts and hints, and keeps being written to `GameRecord`. Already
   persisted games stay valid — no localStorage migration.
2. **No new i18n keys.** Both strips fall back to strings that already exist
   (`opp`, `yoursub`), so the copy shrinks rather than changing.
3. **The stat tile goes away rather than being replaced.** The history stats
   row becomes three tiles (Games / Win rate / Streak). `gameStats().best` is
   still computed — dead like `OnboardingElo`, not deleted.
4. **Dead i18n keys stay.** `st_best` and `col_elo` remain in the dictionary,
   unused, per "hide, don't delete".

## Changes

| File                               | Change                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/ui/game/GameScreen.tsx`       | Opponent strip `sub` → `t('opp')`; human strip `sub` → `t('yoursub')` (drops the hardcoded `ELO 1280`). The `elo` prop stays — it still feeds `useGame` and `useHint`.         |
| `src/ui/history/HistoryScreen.tsx` | Delete the `<th>{t('col_elo')}</th>` header cell and the `{g.elo}` body cell (table drops to 4 columns); delete the `st_best` stat tile (row drops to 3 tiles).                |
| `src/styles/app.css`               | `.lb-stats` `grid-template-columns: repeat(4, 1fr)` → `repeat(3, 1fr)`. Verified there is no media-query override for `.lb-stats`; without this the row keeps an empty column. |
| `src/ui/app/i18n.tsx`              | **No change.** `st_best` / `col_elo` become unused keys and stay.                                                                                                              |
| `src/ui/history/gameHistory.ts`    | **No change.** `GameRecord.elo` and `gameStats().best` stay.                                                                                                                   |
| `useGame`, `useHint`, `src/llm/*`  | **No change.**                                                                                                                                                                 |

## Error handling

None new — this is presentational. Records written before this change (and
after it) still carry `elo`; nothing reads it for display, so no missing-field
or stale-value path exists.

## Testing

- `src/ui/game/GameScreen.test.tsx` — assert the rendered screen contains no
  `/ELO/` text, and that both strips still show their subtitles (`Соперник`,
  `Белые ходят` in the test's language).
- `src/ui/history/HistoryScreen.test.tsx` — assert the `ELO` column header and
  a record's rating value are absent, and the header row has 4 cells.
- `src/ui/game/PlayerStrip.test.tsx` — no change: it passes `sub` in directly,
  so it tests the component, not the copy.
- `src/ui/history/gameHistory.test.ts` — no change: the data layer is untouched
  and must stay green as proof of that.
- Full local gate (`lint / format:check / typecheck / test / build`) before
  pushing; feature branch `feat/hide-elo-ui` + PR per project convention.

## Out of scope

- Removing `elo` from `GameRecord`, `appState`, prompts, hints, `ELO_BANDS` /
  `demoData`, or `OnboardingElo`.
- Deleting the `st_best` / `col_elo` i18n keys or the `gameStats().best` field.
- Any other history-screen rework (e.g. the unused `col_open` opening column).
- The Appearance screen (still deferred).
