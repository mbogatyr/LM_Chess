# Hide ELO in the game and history UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every user-visible ELO rating from the game screen and the match history, without touching the data layer that still carries it.

**Architecture:** Purely presentational. Two React components lose the ELO fragments from their JSX (`GameScreen`'s two `PlayerStrip` subtitles; `HistoryScreen`'s table column and one stat tile), and one CSS grid shrinks from four columns to three. Nothing changes in `appState`, `useGame`, `useHint`, `src/llm/*`, or `gameHistory.ts` — `elo` keeps flowing into prompts and keeps being written to each `GameRecord`.

**Tech Stack:** React 18 + TypeScript 5 (strict), Vitest + @testing-library/react (jsdom), Prettier 3, ESLint 9, Vite 6, npm.

Spec: `docs/superpowers/specs/2026-08-11-hide-elo-ui-design.md`

## Global Constraints

- **Hide, don't delete.** No file, i18n key, type field, or exported function is removed. `st_best` and `col_elo` stay in `src/ui/app/i18n.tsx`; `GameRecord.elo` and `gameStats().best` stay in `src/ui/history/gameHistory.ts`. Only JSX that renders them goes away.
- **No new i18n keys.** Both player subtitles reuse existing keys: `opp` (`'Соперник'` / `'Opponent'`) and `yoursub` (`'Белые ходят'` / `'White to play'`).
- **The `elo` prop of `GameScreen` stays.** It still feeds `useGame` and `useHint`; do not remove it from the props type or the destructuring, or the model will stop receiving its persona and hints will break.
- **Prettier config:** no semicolons, single quotes, trailing commas, 80-column. Run `npm run format` before each commit; CI runs `format:check` on Markdown too.
- **Tests assert Russian copy** — `I18nProvider` defaults to `ru` in these suites. Match the existing style: query by role/text, assert what the user sees.
- **Branch:** all work happens on `feat/hide-elo-ui`, never on `main`.
- **Commits:** conventional prefixes, imperative mood.

---

### Task 1: Drop ELO from both player strips on the game screen

**Files:**

- Modify: `src/ui/game/GameScreen.tsx:109` and `src/ui/game/GameScreen.tsx:137`
- Test: `src/ui/game/GameScreen.test.tsx` (add one test at the end)

**Interfaces:**

- Consumes: `PlayerStrip({ variant, name, sub, clock, active })` from `src/ui/game/PlayerStrip.tsx` — renders `sub` inside `.who > small`. Unchanged by this task.
- Produces: nothing new. `GameScreen`'s props type is untouched, so Task 2 and every existing caller keep compiling.

- [ ] **Step 1: Create the feature branch**

```bash
git checkout main && git pull && git checkout -b feat/hide-elo-ui
```

- [ ] **Step 2: Write the failing test**

Append to `src/ui/game/GameScreen.test.tsx`:

```tsx
test('neither player strip mentions ELO', () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  const subs = [...container.querySelectorAll('.who small')].map(
    (s) => s.textContent,
  )
  expect(subs).toEqual(['Соперник', 'Белые ходят'])
  expect(container.textContent).not.toMatch(/ELO/)
})
```

The regex is deliberately case-sensitive: a case-insensitive `/elo/i` would
match ordinary words and give a false failure.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx -t 'neither player strip'`

Expected: FAIL — received `['Соперник · ELO 1200', 'ELO 1280 · Белые ходят']`
(`baseProps.elo` is 1200; the `1280` is hardcoded in the component).

- [ ] **Step 4: Remove the ELO fragments**

In `src/ui/game/GameScreen.tsx`, the opponent strip (line 109):

```tsx
sub={`${t('opp')} · ELO ${elo}`}
```

becomes:

```tsx
sub={t('opp')}
```

and the human strip (line 137):

```tsx
sub={`ELO 1280 · ${t('yoursub')}`}
```

becomes:

```tsx
sub={t('yoursub')}
```

Leave everything else in the file alone — in particular keep `elo` in the
props type, in the destructuring, and in the `useGame({ … elo … })` and
`useHint({ … elo … })` calls.

- [ ] **Step 5: Run the file's whole suite to verify it passes**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx`

Expected: PASS — all tests in the file, including the pre-existing ones
(`shows players, frozen clocks…`, the Fool's Mate game, the resignation test).

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/ui/game/GameScreen.tsx src/ui/game/GameScreen.test.tsx
git commit -m "feat: hide ELO on the game screen player strips"
```

---

### Task 2: Drop the ELO column and the Best-ELO tile from History

**Files:**

- Modify: `src/ui/history/HistoryScreen.tsx:35-38` (stat tile), `:59` (header cell), `:69-71` (body cell)
- Modify: `src/styles/app.css:955-959` (`.lb-stats` grid)
- Test: `src/ui/history/HistoryScreen.test.tsx` (rewrite one test, add one)

**Interfaces:**

- Consumes: `gameStats(games)` from `src/ui/history/gameHistory.ts`, which returns `{ played: number; winRate: number; streak: number; best: number }`. `best` stays in the return type and stays computed — this task only stops destructuring and rendering it.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

In `src/ui/history/HistoryScreen.test.tsx`, replace the existing
`renders stored games without an opening column` test with the version below,
and add the second test after it:

```tsx
test('renders stored games without an ELO or opening column', () => {
  appendGame(rec({ opponent: 'Test Bot', elo: 1350, plies: 41 }))
  renderHistory()
  const table = screen.getByRole('table')
  expect(within(table).getByText('Test Bot')).toBeInTheDocument()
  // full-move count = ceil(41 / 2) = 21
  expect(within(table).getByText('21')).toBeInTheDocument()
  // the ELO column — header and value — must be gone
  expect(within(table).getAllByRole('columnheader')).toHaveLength(4)
  expect(within(table).queryByText('ELO')).not.toBeInTheDocument()
  expect(within(table).queryByText('1350')).not.toBeInTheDocument()
  // opening column header must be gone
  expect(screen.queryByText('Дебют')).not.toBeInTheDocument()
})

test('the stats row has three tiles and no Best ELO', () => {
  appendGame(rec({ elo: 1350 }))
  const { container } = renderHistory()
  expect(container.querySelectorAll('.lb-stats .stat')).toHaveLength(3)
  expect(screen.queryByText('Лучший ELO')).not.toBeInTheDocument()
  expect(screen.getByText('Партий')).toBeInTheDocument()
  expect(screen.getByText('Побед')).toBeInTheDocument()
  expect(screen.getByText('Серия')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/history/HistoryScreen.test.tsx`

Expected: FAIL — 5 column headers not 4, `ELO` header found, `1350` found in
the table, 4 stat tiles not 3, and `Лучший ELO` present.

- [ ] **Step 3: Remove the tile and the column**

In `src/ui/history/HistoryScreen.tsx`, stop destructuring `best` (line 8):

```tsx
const { played, winRate, streak } = gameStats(games)
```

Delete the fourth stat tile (lines 35-38):

```tsx
<div className="card stat elev-sm">
  <span className="k">{t('st_best')}</span>
  <span className="v">{best}</span>
</div>
```

Delete the header cell (line 59):

```tsx
<th>{t('col_elo')}</th>
```

Delete the matching body cell (lines 69-71) — the whole element, as Prettier
currently wraps it across three lines:

```tsx
<td style={{ fontVariantNumeric: 'tabular-nums' }}>{g.elo}</td>
```

Leave `gameStats` itself, `GameRecord.elo`, and the `st_best` / `col_elo` i18n
keys untouched.

- [ ] **Step 4: Shrink the stats grid**

In `src/styles/app.css:957`, inside `.lb-stats`:

```css
grid-template-columns: repeat(4, 1fr);
```

becomes:

```css
grid-template-columns: repeat(3, 1fr);
```

There is no media-query override for `.lb-stats`; this is the only occurrence
in `src/`. (`docs/design-reference/gambit-local/app/app.css` also has one — it
is the vendored read-only prototype and must NOT be edited.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui/history/HistoryScreen.test.tsx src/ui/history/gameHistory.test.ts`

Expected: PASS — including `gameHistory.test.ts` unchanged, which proves the
data layer (and `gameStats().best`) still works.

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/ui/history/HistoryScreen.tsx src/ui/history/HistoryScreen.test.tsx src/styles/app.css
git commit -m "feat: hide ELO in the match history"
```

---

### Task 3: Verify the whole app and open the PR

**Files:**

- No production changes expected. If the gate turns something up, fix it here.

**Interfaces:**

- Consumes: the working tree from Tasks 1-2.
- Produces: a green PR against `main`.

- [ ] **Step 1: Confirm no user-visible ELO is left in the app**

Run: `grep -rn "ELO" src/ui/game/GameScreen.tsx src/ui/history/HistoryScreen.tsx`

Expected: no matches. (Hits in `i18n.tsx`, `OnboardingElo.tsx`, `demoData.ts`,
`gameHistory.ts`, and `src/llm/` are intentional — see the spec's Out of scope.)

- [ ] **Step 2: Run the full local quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`

Expected: every step exits 0. Watch specifically for an unused-variable lint
error on `elo` in `GameScreen.tsx` — if it appears, `elo` was wrongly dropped
from `useGame`/`useHint` in Task 1 and must be restored, not silenced.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/hide-elo-ui
gh pr create --title "feat: hide ELO in the game and history UI" --body "$(cat <<'EOF'
Removes every user-visible ELO rating from the game screen and the match
history. The data layer is untouched: `elo` still flows into prompts and
hints and is still written to each `GameRecord`.

- game screen: both player strips lose their ELO fragment (including the
  hardcoded, never-real `ELO 1280` on the human strip)
- history: the ELO table column and the "Best ELO" stat tile are gone;
  `.lb-stats` shrinks to three columns

Spec: `docs/superpowers/specs/2026-08-11-hide-elo-ui-design.md`
Plan: `docs/superpowers/plans/2026-08-11-hide-elo-ui.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Confirm CI is green**

Run: `gh pr checks --watch`

Expected: the `ci` workflow passes (lint → format:check → typecheck → test →
build). Do not merge until it does.
